import { McpServer,isInitializeRequest,WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/server';
import { Query, Client, Databases } from 'node-appwrite';
import { z } from 'zod';
import {
  DATABASE_ID,
  DOCTOR_COLLECTION_ID,
  APPOINTMENT_COLLECTION_ID,
  PATIENT_COLLECTION_ID,
  databases,
  users
} from "@/lib/actions/appwrite.config";
import { NextRequest, NextResponse } from "next/server";
import { Redis } from '@upstash/redis';


// REDIS CONNECTION SETUP
// Ensure these environment variables are defined in your deployment environment
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

/**
 * Optimized Distributed Event Store utilizing Redis
 * Keeps multi-instance or serverless layers fully synchronized
 */
class RedisEventStore {
  private getRedisKey(sid: string): string {
    return `mcp:events:${sid}`;
  }

  async getEvents(sid: string): Promise<any[]> {
    try {
      const data = await redis.get<any[]>(this.getRedisKey(sid));
      return data || [];
    } catch (e) {
      console.error("[Redis Error] Failed to read events:", e);
      return [];
    }
  }

  async storeEvent(sid: string, ev: any): Promise<void> {
    try {
      const key = this.getRedisKey(sid);
      const currentEvents = await this.getEvents(sid);
      currentEvents.push(ev);
      
      // Store back to Redis with a sliding window expiry window of 1 hour
      await redis.set(key, currentEvents, { ex: 3600 });
    } catch (e) {
      console.error("[Redis Error] Failed to write event:", e);
    }
  }

  async clear(sid: string): Promise<void> {
    try {
      await redis.del(this.getRedisKey(sid));
    } catch (e) {
      console.error("[Redis Error] Failed to drop key:", e);
    }
  }
}


// Create the MCP Server
const mcpServer = new McpServer({
  name: "hospital-production-db",
  version: "1.0.0"
});


const eventStore = new RedisEventStore();

// Prevent local runtime instances from dropping context during fast-refresh compilation loops
const globalMcpCache = global as unknown as {
  _activeTransports?: Map<string, WebStandardStreamableHTTPServerTransport>;
};

if (!globalMcpCache._activeTransports) {
  globalMcpCache._activeTransports = new Map();
}

const activeTransports = globalMcpCache._activeTransports;

/**
 * TOOL 1: validate_rag_appointment
 * Validates a cached RAG appointment reference against the live Appointment table.
 * Resolves patient text queries to live records without altering database states.
 */
mcpServer.registerTool(
  "validate_rag_appointment",
  {
    description: "Validates a cached RAG appointment reference by resolving patient identity to live relational appointment records.",
    inputSchema: z.object({
      name: z.string().optional().describe("The name string of the patient (e.g., 'naren')"),
      email: z.string().optional().describe("The unique email address of the patient"),
    })
  },
  async ({ name, email }) => {
    // 1. Log incoming arguments passed from Groq / context parsing
    console.error("\n=================== [MCP INBOUND PARAMETERS] ===================");
    console.error(`▶ raw name:  "${name}"`);
    console.error(`▶ raw email: "${email}"`);
    console.error("================================================================\n");

    try {
      const targetEmail = email?.toLowerCase().trim();
      console.error(`[MCP DB Query] Listing documents from PATIENT_COLLECTION_ID where email == "${targetEmail}"...`);

      // Step 1: Query the Patient Collection first to get the true Relational ID
      const patientResponse = await databases.listDocuments(
        DATABASE_ID,
        PATIENT_COLLECTION_ID,
        [Query.equal("email", targetEmail)]
      );

      // 2. Log full payload returned by Appwrite for the Patient Collection
      console.error("\n=================== [APPWRITE PATIENT RESPONSE] ===================");
      console.error(`▶ total matched docs: ${patientResponse.total}`);
      console.error("▶ full raw response payload:", JSON.stringify(patientResponse, null, 2));
      console.error("===================================================================\n");

      if (patientResponse.total === 0) {
        console.error(`[MCP State] Verification short-circuited: No document found matching email: ${targetEmail}`);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              isRagAppointmentValid: false,
              reasoningMeta: `Verification aborted: No patient profile exists for email ${email}.`
            })
          }]
        };
      }

      const livePatientDoc = patientResponse.documents[0];
      const patientId = livePatientDoc.$id; 
      
      console.error(`[MCP State] Resolved patient document link -> ID: "${patientId}", Name attribute: "${livePatientDoc.name}"`);
      console.error(`[MCP DB Query] Listing documents from APPOINTMENT_COLLECTION_ID where relational attribute "patient" == "${patientId}"...`);

      // Step 2: Query the Appointments collection using the relational link
      const appointmentResponse = await databases.listDocuments(
        DATABASE_ID,
        APPOINTMENT_COLLECTION_ID,
        [Query.equal("patient", patientId)] 
      );

      // 3. Log full payload returned by Appwrite for the Appointments Collection
      console.error("\n=================== [APPWRITE APPOINTMENT RESPONSE] ===================");
      console.error(`▶ total matched docs: ${appointmentResponse.total}`);
      console.error("▶ full raw response payload:", JSON.stringify(appointmentResponse, null, 2));
      console.error("========================================================================\n");

      if (appointmentResponse.total === 0) {
        console.error(`[MCP State] Patient exists, but live Appointments table returned 0 rows for patient relational ID: ${patientId}`);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              isRagAppointmentValid: false,
              reasoningMeta: `Patient profile verified, but no active appointments found in the live schedule table.`,
              patientProfile: { id: patientId, name: livePatientDoc.name }
            })
          }]
        };
      }

      // Step 3: Map data out using exact schema columns
      const validatedRecords = appointmentResponse.documents.map((doc: any) => ({
        appointmentId: doc.$id,
        schedule: doc.schedule,             
        status: doc.status,                 
        primaryPhysician: doc.primaryPhysician, 
        reason: doc.reason,
        note: doc.note,
        patientSnapshot: {
          id: livePatientDoc.$id,
          name: livePatientDoc.name,
          email: livePatientDoc.email
        }
      }));

      console.error(`[MCP Success] Successfully mapped ${validatedRecords.length} synchronized records back to the pipeline.`);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            isRagAppointmentValid: true,
            reasoningMeta: "Successfully verified relational vector context against live table joins.",
            appointments: validatedRecords
          })
        }]
      };

    } catch (error: any) {
      console.error("\n❌ =================== [APPWRITE EXCEPTION CRASH] ===================");
      console.error("▶ Error Message:", error.message);
      console.error("▶ Complete Error Stack:", error);
      console.error("===================================================================\n");
      return {
        content: [{ type: "text", text: `Relational Query Failure: ${error.message}` }],
        isError: true,
      };
    }
  }
);
/**
 * TOOL 2: validate_rag_patient
 * Cross-references patient registration parameters extracted from a RAG chunk 
 * against the live Appwrite Patient collection table to find conflicts or stale states.
 * Pure Read-Only validation gate. DOES NOT execute an database insert.
 */
mcpServer.registerTool(
  "validate_rag_patient",
  {
    description: "Cross-references patient registration parameters extracted from a RAG chunk against the live Appwrite Patient collection table to find conflicts or stale states.",
    //  FIX: Wrap properties inside a proper inputSchema z.object
    inputSchema: z.object({
      name: z.string().optional().describe("The patient's full name string extracted from the semantic RAG context chunk"),
      email: z.string().optional().describe("The patient's email address string extracted from the semantic RAG context chunk"),
      phone: z.string().optional().describe("The patient's phone number string extracted from the semantic RAG context chunk"),
    })
  },
  async ({ name, email, phone }) => {
    //  Added clear debugging logs to trace incoming LLM arguments
    console.error(`\n📥 [MCP TOOL RUNNING: validate_rag_patient]`);
    console.error(`   -> Parsed Name:  "${name || 'undefined'}"`);
    console.error(`   -> Parsed Email: "${email || 'undefined'}"`);
    console.error(`   -> Parsed Phone: "${phone || 'undefined'}"`);

    try {
      const patientFilters = [];

      // Flexible matching fallback hierarchy
      if (email && email.trim() !== "") {
        console.error(`   -> Filtering Appwrite by email: ${email.trim().toLowerCase()}`);
        patientFilters.push(Query.equal("email", email.trim().toLowerCase()));
      } else if (phone && phone.trim() !== "") {
        console.error(`   -> Filtering Appwrite by phone: ${phone.trim()}`);
        patientFilters.push(Query.equal("phone", phone.trim()));
      } else if (name && name.trim() !== "") {
        //  FIX: Changed to Query.contains to handle partial name matches gracefully
        console.error(`   -> Filtering Appwrite by name contains: ${name.trim()}`);
        patientFilters.push(Query.contains("name", name.trim()));
      } else {
        console.error(`   ❌ Tool invocation aborted: Missing query identifiers.`);
        return {
          content: [{ type: "text", text: "Error: You must provide at least one identity parameter (email, phone, or name) to validate against the Patient Table." }],
          isError: true,
        };
      }

      // Query the live Appwrite Patient database collection
      const response = await databases.listDocuments(
        DATABASE_ID,
        PATIENT_COLLECTION_ID,
        patientFilters
      );

      console.error(`   📥 Appwrite returned total rows: ${response.total}`);

      if (response.total === 0) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                isRagPatientValid: false,
                reasoningMeta: "No registered profile matching these semantic parameters exists in the live Patient table.",
                matchedPatients: []
              }),
            },
          ],
        };
      }

      // Explicit schema alignment with your patient table layout
      const validatedPatients = response.documents.map((doc: any) => ({
        patientId: doc.$id, 
        userId: doc.userId,
        name: doc.name,
        email: doc.email,
        phone: doc.phone,
        birthDate: doc.birthDate,
        gender: doc.gender,
        address: doc.address,
        occupation: doc.occupation,
        emergencyContactName: doc.emergencyContactName,
        emergencyContactNumber: doc.emergencyContactNumber,
        primaryPhysician: doc.primaryPhysician, 
        insuranceProvider: doc.insuranceProvider,
        insurancePolicyNumber: doc.insurancePolicyNumber,
        allergies: doc.allergies || null,
        currentMedication: doc.currentMedication || null,
        familyMedicalHistory: doc.familyMedicalHistory || null,
        pastMedicalHistory: doc.pastMedicalHistory || null,
        identificationType: doc.identificationType || null,
        identificationNumber: doc.identificationNumber || null,
        privacyConsent: doc.privacyConsent,
        createdAt: doc.$createdAt,
        updatedAt: doc.$updatedAt
      }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              isRagPatientValid: true,
              reasoningMeta: `Successfully matched RAG payload parameters against ${response.total} active live Patient record(s).`,
              totalMatches: response.total,
              matchedPatients: validatedPatients
            }),
          },
        ],
      };

    } catch (error: any) {
      console.error("💥 [MCP PATIENT TOOL CRASH]:", error);
      return {
        content: [{ type: "text", text: `Patient Table Verification Error: ${error.message}` }],
        isError: true,
      };
    }
  }
);

/**
 * TOOL 3: validate_rag_doctor_by_name
 * Takes a natural language doctor name extracted from a RAG text chunk,
 * queries the live Doctor table to find a match, and exposes the true $id and columns.
 */
mcpServer.registerTool(
  "validate_rag_doctor_by_name",
  {
    description: "Queries the live Doctor table. If a specific doctor name is provided, it fetches that matching record. If no name is provided or the input is empty, it returns the list of all active doctors.",
    inputSchema: z.object({
      name: z.string().optional().default("").describe("The doctor's name string extracted from the semantic RAG context chunk (e.g., 'John Smith'). Leave blank or pass an empty string to retrieve all doctors."),
    })
  },
  async ({ name }) => {
    // 1. FIX: Safe extraction guard to guarantee we are working with a real string primitive
    const inputName = name || "";
    
    console.error(`\n📥 [MCP TOOL RUNNING: validate_rag_doctor_by_name]`);
    console.error(`   -> Extracted Raw Input Name Parameter: "${inputName}"`);

    try {
      const doctorFilters = [];

      // 2. Clean up natural language prefixes safely on our guaranteed string variable
      let cleanName = inputName.replace(/^(dr\.\s*|doctor\s*)/i, "").trim();

      // Guard against common LLM literal string placeholders
      if (cleanName.toLowerCase() === "undefined" || cleanName.toLowerCase() === "null") {
        cleanName = "";
      }

      console.error(`   -> Processed Clean Name Condition: "${cleanName}"`);

      if (cleanName !== "") {
        console.error(`   -> Specific filter criteria detected. Searching name contains: "${cleanName}"`);
        doctorFilters.push(Query.contains("name", cleanName));
      } else {
        console.error(`   -> No specific name argument passed. Requesting ALL active records via high-ceiling limit...`);
        // Explicitly set a high limit so Appwrite overrides its default fallback pagination slice
        doctorFilters.push(Query.limit(100)); 
      }

      // Query the live Appwrite Doctor collection table
      const response = await databases.listDocuments(
        DATABASE_ID,
        DOCTOR_COLLECTION_ID,
        doctorFilters
      );

      console.error(`   📥 Appwrite Database transaction completed. Total rows found: ${response.total}`);

      if (response.total === 0) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                isRagDoctorValid: false,
                reasoningMeta: cleanName !== "" 
                  ? `No active physician matching "${inputName}" was found in the Doctor table.`
                  : "The Doctor collection table is currently empty.",
                matchedDoctors: []
              }),
            },
          ],
        };
      }

      // 3. Map the documents back to your explicit table columns cleanly
      const validatedDoctors = response.documents.map((doc: any) => ({
        id: doc.$id,              // The absolute Appwrite source-of-truth ID
        name: doc.name,            // Live database name string
        image: doc.image || null,  // Image tracking path/URL
        createdAt: doc.$createdAt,
        updatedAt: doc.$updatedAt
      }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              isRagDoctorValid: true,
              reasoningMeta: cleanName !== ""
                ? `Successfully resolved specific RAG text reference "${inputName}" to matching database records.`
                : `Successfully listed all ${response.total} active doctor profiles from the system registry.`,
              totalMatchesFound: response.total,
              matchedDoctors: validatedDoctors
            }),
          },
        ],
      };
    } catch (error: any) {
      console.error("💥 [Appwrite Doctor Name Table Validation Error]:", error);
      return {
        content: [{ type: "text", text: `Doctor Verification Execution Failure: ${error.message}` }],
        isError: true,
      };
    }
  }
);

/**
 * TOOL 4: validate_rag_auth
 * Validates a cached RAG user reference directly against Appwrite's native Auth Service.
 * Leverages server-side queries to filter by name or email/phone identifiers.
 */
mcpServer.registerTool(
  "validate_rag_auth",
  {
    description: "Validates a cached RAG user reference directly against Appwrite's native Auth Service.",
    inputSchema: z.object({
      name: z.string().optional().describe("The user's name string extracted from the semantic RAG context chunk"),
      email: z.string().optional().describe("The user's email identifier string extracted from the RAG context chunk"),
      phone: z.string().optional().describe("The patient's phone number string extracted from the semantic RAG context chunk"),
    }),
  },
  async ({ name, email, phone }) => {
    try {
      const queryFilters = [];

      // 1. Build server-side queries instead of loading all users into memory
      if (email) {
        queryFilters.push(Query.equal("email", email.toLowerCase().trim()));
      } else if (name) {
        queryFilters.push(Query.equal("name", name.toLowerCase().trim()));
      } else if (phone) {
        queryFilters.push(Query.equal("phone", phone.trim()));
      } else {
        return {
          content: [{ type: "text", text: "Error: Provide either a ragName or ragEmail string to validate authentication." }],
          isError: true,
        };
      }

      // 2. Fetch directly from Appwrite's native Auth Service ('users')
      // Ensure 'users' is initialized as: const users = new Users(appwriteClient);
      const response = await users.list(queryFilters);

      if (response.total === 0) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                isAuthValid: false,
                reasoningMeta: `No matching user found in Appwrite Auth for parameters: Email[${email}] Name[${name}] Phone[${phone}].`,
                userAccount: null
              }),
            },
          ],
        };
      }

      // Grab the verified target user account record
      const targetUser = response.users[0];

      // 3. Check Account Status Ground-Truth
      // If the user's status flag is false, they are blocked or disabled in Appwrite Auth
      const isAccountActive = targetUser.status === true;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              isAuthValid: isAccountActive,
              reasoningMeta: isAccountActive 
                ? "User authentication state verified and active."
                : "Security Warning: This user profile exists but has been deactivated/blocked.",
              userAccount: {
                userId: targetUser.$id,          // The true User ID ($id) needed for appointment/patient linkages
                name: targetUser.name,
                email: targetUser.email,
                phone: targetUser.phone,
                status: targetUser.status ? "active" : "disabled",
                joined: targetUser.joined  // Native Appwrite timestamp for when they joined
              }
            }),
          },
        ],
      };

    } catch (error: any) {
      console.error("Appwrite Native Auth Service Validation Failure:", error);
      return {
        content: [{ type: "text", text: `Auth Service Verification Error: ${error.message}` }],
        isError: true,
      };
    }
  }
);


// ==========================================
//  GLOBAL ROUTER & ACTIVE LIFE-CYCLE TRACKING
// ==========================================

/**
 * Unified Next.js Handler routing protocol events
 */
export async function handleMcpRouting(req: NextRequest) {
    
  // 1. Clone or extract the raw body content without prematurely consuming the stream
  let bodyPayload: any = null;
  if (req.method === "POST") {
    try {
      
      // Read text first to safely prevent crashes on empty streams/pings
      const textRaw = await req.clone().text();
      if (textRaw && textRaw.trim().length > 0) {
        bodyPayload = JSON.parse(textRaw);
      }
    } catch (e) {
      console.error("Could not parse JSON payload body", e);
    }
  }

  const url = new URL(req.url);
  
  // DEEP SESSION EXTRACTION MATRIX
  // StreamableHTTPClientTransport variations sometimes bury or pass the target ID differently
  const mcpSessionId = 
    req.headers.get("mcp-session-id") ||
    url.searchParams.get("sessionId") || 
    bodyPayload?.sessionId ||
    bodyPayload?.params?.sessionId ||
    bodyPayload?.params?.meta?.sessionId; // Fallback check for proxy layers

  console.error(`[MCP Routing Debug] Extracted SessionID: "${mcpSessionId}" | Method: ${req.method}`);

  // Check Redis to verify if this session exists globally across clusters
  const globalSessionExists = mcpSessionId ? await redis.exists(`mcp:session:${mcpSessionId}`) : 0;

  // Case A: Existing stream connection matching an active transport session
  if (mcpSessionId && globalSessionExists) {
    let transport = activeTransports.get(mcpSessionId)!;
    
    // Serverless Sync Fallback: Reconstruct connection mapping if a sibling server initialized it
    if (!transport) {
      console.error(`[Serverless Sync] Hot-linking execution pipeline context for context ID: ${mcpSessionId}`);
      transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: () => mcpSessionId,
        onsessioninitialized: () => {}
      });

    // FIX 1: Manually bind the sessionId onto the internal transport instance
    // so handleRequest knows this instance belongs to the active session
    (transport as any).sessionId = mcpSessionId;

      await mcpServer.connect(transport);
      activeTransports.set(mcpSessionId, transport);
    }

    const requestOptions: RequestInit = {
      method: req.method,
      headers: req.headers,
    };

      if (req.method !== "GET" && req.method !== "HEAD" && bodyPayload) {
        requestOptions.body = JSON.stringify(bodyPayload);
      }
  
      const standardReq = new Request(req.url, requestOptions);
      return await transport.handleRequest(standardReq);
    }

    // Create an array to track async operations we must wait for before exiting the request pipeline
  const pendingOperations: Promise<any>[] = [];
  
  // Case B: Initialization Handshake
  if (!mcpSessionId && isInitializeRequest(bodyPayload)) {
    const newTransport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
      onsessioninitialized: (id) => {
        console.error(`[MCP Server State] Session ${id} initialized successfully.`);
        activeTransports.set(id, newTransport);
        // Track session state cluster-wide in Redis with a 1 hour expiration window
        // Push the promise to an outer tracking array instead of dangling an isolated async block
        pendingOperations.push(
          redis.set(`mcp:session:${id}`, "active", { ex: 3600 })
        );
      }
    });

    newTransport.onclose = () => {
      // Clean up maps when connection teardowns fire
      for (const [sid, trans] of activeTransports.entries()) {
        if (trans === newTransport) {
          activeTransports.delete(sid);
          // Handle unawaited promises safely in serverless environments
          pendingOperations.push(
            redis.del(`mcp:session:${sid}`),
            eventStore.clear(sid)
          );
          break;
        }
      }
    };

    await mcpServer.connect(newTransport);

    const standardReq = new Request(req.url, {
      method: req.method,
      headers: req.headers,
      body: JSON.stringify(bodyPayload)
    });

    const response = await newTransport.handleRequest(standardReq);

    // FIX 2: Handle notifications/initialized (which return empty/202 or 400 from transport)
    if (bodyPayload?.method?.startsWith("notifications/") && response.status === 400) {
        return new NextResponse(null, { status: 202 });
     }

    // CRITICAL FOR SERVERLESS: Ensure all background Redis operations finish completely 
    // before Next.js kills or freezes the execution runtime environment
    if (pendingOperations.length > 0) {
      await Promise.allSettled(pendingOperations);
    }

    return response;
  }

  // =================================================================
  // Case C: Stateless On-Demand Execution (FIX FOR VERCEL & HTTP CLIENTS)
  // Handles tools/list, tools/call, etc., without requiring session handshake
  // =================================================================
  if (bodyPayload?.method) {
    console.log(`[MCP Stateless] Handling method execution: ${bodyPayload.method}`);

    const statelessTransport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
    });

    await mcpServer.connect(statelessTransport);

    const standardReq = new Request(req.url, {
      method: req.method,
      headers: req.headers,
      body: JSON.stringify(bodyPayload),
    });

    return await statelessTransport.handleRequest(standardReq);
  }

  if (mcpSessionId) {
    return NextResponse.json({ jsonrpc: "2.0", error: { code: -32001, message: "Session expired or not found" }, id: null }, { status: 404 });
  }
  return NextResponse.json({ jsonrpc: "2.0", error: { code: -32000, message: "Bad Request: Session missing properties" }, id: null }, { status: 400 });
}

// GET handler returns server discovery schema parameters required by modern clients
export async function GET(req: NextRequest) {
 return handleMcpRouting(req);
}

/**
 * Message Endpoint (POST)
 * Client routes all JSON-RPC payload requests directly here.
 */
export async function POST(req: NextRequest) {
  return handleMcpRouting(req);
}

// Handle preflight CORS
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, mcp-session-id",
    },
  });
}

// Handle session cleanup gracefully
export async function DELETE() {
  return new Response(null, { status: 200 });
}