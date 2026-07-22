import {
  McpServer,
  isInitializeRequest,
  WebStandardStreamableHTTPServerTransport,
} from "@modelcontextprotocol/server";

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import pdfParse from "pdf-parse-fixed"; // 🛡️ Using fixed version to prevent path validation crash
import mammoth from "mammoth";
import { NextResponse,NextRequest } from "next/server";
import { Transform } from "stream";
import { Redis } from "@upstash/redis";
import { get, list } from "@vercel/blob";

// 1. Resolve absolute paths reliably regardless of execution working directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Move up from your script directory directly into Next.js's public/uploads target folder
const DOCUMENTS_DIRECTORY = path.resolve(__dirname, "../../public/documents");

// ENVIRONMENT DETECTOR
const IS_PRODUCTION = process.env.NEXT_PUBLIC_FORCE_CLOUD_UPLOAD === "true" || !!process.env.VERCEL;

console.error(`[MCP Config] Target Uploads Directory resolved to: ${DOCUMENTS_DIRECTORY}`);
console.error(`[MCP Config] Running in ${IS_PRODUCTION ? "PRODUCTION (Vercel Blob)" : "DEVELOPMENT (Local FS)"} mode.`);

// REDIS CONNECTION SETUP
// Ensure these environment variables are defined in your deployment environment
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
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

const mcpServer = new McpServer({
  name: "hospital-document-validator",
  version: "1.0.0",
});

const eventStore = new RedisEventStore();

// 🟢 FIX: Prevent Next.js from wiping out your connection maps during hot-reloads
const globalMcpCache = global as unknown as {
  _activeTransports?: Map<string, WebStandardStreamableHTTPServerTransport>;
};

if (!globalMcpCache._activeTransports) {
  globalMcpCache._activeTransports = new Map();
}

const activeTransports = globalMcpCache._activeTransports;

/**
 * Robust Text Normalizer
 * Cleans punctuation, handles multi-spaces, and collapses word hyphens broken across lines
 */
const normalizeTextForMatching = (text: string): string => {
  return text
    .replace(/-\n/g, "") // Stitch words split by hyphens (e.g. diag-\nnosis -> diagnosis)
    .replace(/\r?\n|\r/g, " ") // Convert raw line breaks into generic spacing
    .replace(/[^a-zA-Z0-9 ]/g, "") // Remove extra punctuation layout marks
    .replace(/\s+/g, " ") // Collapse multiple consecutive spaces down to one
    .trim()
    .toLowerCase();
};

/**
 * Dynamic File Retrieval Abstraction Layer
 * Handles fetching the exact binary content whether it lives locally or on Vercel Blob
 */
async function fetchDocumentBuffer(filename: string): Promise<{ buffer: Buffer; url?: string } | null> {
  if (IS_PRODUCTION) {
    try {
      console.error(`[Retrieval] Querying Vercel Blob for: ${filename}`);
      
      // Step 1: List files in Blob matching your prefix to acquire the unique CDN URL 
      // (Handles cases where files are stored with folder prefixes or random suffixes)
      const { blobs } = await list({ prefix: filename, token: process.env.BLOB_READ_WRITE_TOKEN });
      
            // ─── DEBUG LOGGING START ──────────────────────────────────────────
      console.log(`[Retrieval Debug] Total blobs returned from API: ${blobs.length}`);
      if (blobs.length > 0) {
        console.log("[Retrieval Debug] Available pathnames in your blob store:");
        blobs.forEach((b, index) => {
          console.log(`  ${index + 1}. Pathname: "${b.pathname}" | URL: ${b.url}`);
        });
      } else {
        console.warn("[Retrieval Debug] ⚠️ The Vercel list API returned 0 blobs for this prefix!");
      }
      // ─── DEBUG LOGGING END ────────────────────────────────────────────
        const matchedBlob = blobs.find((b) => {
        const pathname = b.pathname.toLowerCase();
        const targetName = filename.toLowerCase();
        return pathname === targetName || pathname.endsWith(`/${targetName}`);
      });

      if (!matchedBlob) {
        console.error(`[Retrieval Error] File "${filename}" not found in Vercel Blob store.`);
        return null;
      }

      console.error(`[Retrieval] Found blob. Fetching payload from ${matchedBlob.url}`);

            // Step 2: Stream the data from the private/public blob storage using the SDK
      const response = await get(matchedBlob.url, { access: "private", token: process.env.BLOB_READ_WRITE_TOKEN }); // Use "public" if your store is explicitly public
      
      if (!response || response.statusCode !== 200) {
        console.error(`[Retrieval Error] Failed to retrieve blob. Status: ${response?.statusCode}`);
        return null;
      }

      // FIX: Wrap the Vercel-returned ReadableStream into a Web Response. 
      // This lets us easily and reliably drain the stream into an ArrayBuffer.
      let arrayBuffer: ArrayBuffer;
      try {
        const webResponse = new Response(response.stream);
        arrayBuffer = await webResponse.arrayBuffer();
      } catch (streamError) {
        console.error(`[Retrieval Error] Failed parsing stream data:`, streamError);
        return null;
      }

      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        console.error(`[Retrieval Error] Returned file payload is empty (0 bytes).`);
        return null;
      }

      return { 
        buffer: Buffer.from(arrayBuffer),
        url: matchedBlob.url
      };
    } catch (error) {
      console.error(`[Retrieval Error] Failed to fetch from Vercel Blob:`, error);
      return null;
    }
  } else {
    // Local fallback processing
    const targetFilePath = path.win32.normalize(path.join(DOCUMENTS_DIRECTORY, filename));
    console.error(`[Retrieval] Querying Local FS path: ${targetFilePath}`);

    if (!fs.existsSync(targetFilePath)) {
      console.error(`[Retrieval Error] File "${filename}" does not exist locally.`);
      return null;
    }

    const fileBuffer = fs.readFileSync(targetFilePath);
    return { buffer: fileBuffer };
  }
}

/**
 * TOOL 1: validate_rag_document
 * Targets the exact document provided by Pinecone metadata context.
 */
mcpServer.registerTool(
  "validate_rag_document",
  {
    description:
      "Validates unstructured paragraph text segments extracted from Pinecone by dynamically matching them across files inside the local upload directory.",
    inputSchema: z.object({
      extracted_text: z
        .string()
        .describe("The relevant text chunk or slice returned from the vector database matches"),
      source_filename: z
        .string()
        .describe(
          "The targeted filename extracted directly from Pinecone vector chunk metadata source"
        ),
    }),
  },
  async ({ extracted_text, source_filename }) => {
    try {
    // ⚠️ CRITICAL DIRECTION: Log strictly to stderr to prevent breaking the standard JSON-RPC Stdio pipe
    console.error(` [MCP TOOL RUNNING: validate_rag_document]`);
    console.error(`   -> Absolute Target Directory: "${DOCUMENTS_DIRECTORY}"`);
    console.error(`   -> Targeted File Target: "${source_filename}"`);
    console.error(`   -> Input Text Length: ${extracted_text?.length} characters`);

    if (!source_filename) {
      console.error("⚠️ Execution Warning: source_filename parameter missing.");
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              isDocumentValid: false,
              reasoningMeta: "Verification halted: source_filename string param was missing.",
            }),
          },
        ],
      };
    }

    // Retrieve the file through the unified abstraction layer
    const fileData = await fetchDocumentBuffer(source_filename);
    if (!fileData) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              isDocumentValid: false,
                reasoningMeta: `Verification failed: The target file '${source_filename}' does not exist on disk storage or cloud storage.`,
            }),
          },
        ],
      };
    }

    const { buffer: fileBuffer } = fileData;
    let originalFileContent = "";

    const fileExtension = path.extname(source_filename).toLowerCase();

    // Target File Content Extraction Matrix
     if (fileExtension === ".pdf") {
        const pdfData = await pdfParse(fileBuffer);
        originalFileContent = pdfData.text;
      } else if (fileExtension === ".docx") {
        const docxResult = await mammoth.extractRawText({ buffer: fileBuffer });
        originalFileContent = docxResult.value;
      } else if (fileExtension === ".txt" || fileExtension === ".md") {
        originalFileContent = fileBuffer.toString("utf-8");
      } else {
        console.error(`   ⚠️ Unsupported file format: "${source_filename}"`);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                isDocumentValid: false,
                reasoningMeta: "Unsupported file system target type format extension.",
              }),
            },
          ],
        };
      }

      // Perform deep text normalizations
      const cleanExtracted = normalizeTextForMatching(extracted_text);
      const cleanOriginal = normalizeTextForMatching(originalFileContent);

      // Level 1 validation: Strict continuous match check
      if (cleanOriginal.includes(cleanExtracted)) {
        console.error(`   ✅ Ground-truth validation match confirmed for: "${source_filename}"`);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                isDocumentValid: true,
                sourceFileChecked: source_filename,
                reasoningMeta:
                  "Successfully verified document text alignment against ground-truth disk records.",
                verifiedText: cleanExtracted, // Explicitly returning the text to the LLM context
              }),
            },
          ],
        };
      }

      // Level 2 validation fallback: Partial signature check to combat extreme structural variations
      const signatureSliceLength = Math.min(120, Math.floor(cleanExtracted.length * 0.4));
      const midTextSignature = cleanExtracted.substring(
        Math.floor(cleanExtracted.length * 0.2),
        Math.floor(cleanExtracted.length * 0.2) + signatureSliceLength
      );

      if (midTextSignature.length > 15 && cleanOriginal.includes(midTextSignature)) {
        console.error(
          `   ✅ Signature context verified inside target document: "${source_filename}"`
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                isDocumentValid: true,
                sourceFileChecked: source_filename,
                reasoningMeta:
                  "Verified chunk alignment using signature text block identification patterns.",
              }),
            },
          ],
        };
      }

      console.error("   ❌ Text snippet could not be verified in the target file.");
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              isDocumentValid: false,
              reasoningMeta:
                "Security/Data Warning: The text context retrieved from the vector database has been altered or does not match structural file data configurations.",
            }),
          },
        ],
      };
    } catch (error: any) {
      console.error("💥 [MCP DOCUMENT TOOL CRASH]:", error);
      return {
        content: [{ type: "text", text: `Document File Verification Error: ${error.message}` }],
        isError: true,
      };
    }
  }
);

// ==========================================
// 3. GLOBAL ROUTER & ACTIVE LIFE-CYCLE TRACKING
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

  console.error(
    `[MCP Routing Debug] Extracted SessionID: "${mcpSessionId}" | Method: ${req.method}`
  );

  // Check Redis to verify if this session exists globally across clusters
  const globalSessionExists = mcpSessionId ? await redis.exists(`mcp:session:${mcpSessionId}`) : 0;

  // Case A: Existing stream connection matching an active transport session
  if (mcpSessionId && globalSessionExists) {
    let transport = activeTransports.get(mcpSessionId)!;

    // Serverless Sync Fallback: Reconstruct connection mapping if a sibling server initialized it
    if (!transport) {
      console.error(
        `[Serverless Sync] Hot-linking execution pipeline context for context ID: ${mcpSessionId}`
      );
      transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: () => mcpSessionId,
        onsessioninitialized: () => {},
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
        pendingOperations.push(redis.set(`mcp:session:${id}`, "active", { ex: 3600 }));
      },
    });

    newTransport.onclose = () => {
      // Clean up maps when connection teardowns fire
      for (const [sid, trans] of activeTransports.entries()) {
        if (trans === newTransport) {
          activeTransports.delete(sid);
          // Handle unawaited promises safely in serverless environments
          pendingOperations.push(redis.del(`mcp:session:${sid}`), eventStore.clear(sid));
          break;
        }
      }
    };

    await mcpServer.connect(newTransport);

    const standardReq = new Request(req.url, {
      method: req.method,
      headers: req.headers,
      body: JSON.stringify(bodyPayload),
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
  // Case C: Stateless Fallback for Single-Shot RPC Requests (listTools, callTool)
  // =================================================================
  if (!mcpSessionId && bodyPayload?.method) {
    console.log(`[MCP Server] Executing stateless request for method: ${bodyPayload.method}`);
    
    // Instantiate a temporary, lightweight transport for this single invocation
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
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        error: { code: -32001, message: "Session expired or not found" },
        id: null,
      },
      { status: 404 }
    );
  }
  return NextResponse.json(
    {
      jsonrpc: "2.0",
      error: { code: -32000, message: "Bad Request: Session missing properties" },
      id: null,
    },
    { status: 400 }
  );
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
