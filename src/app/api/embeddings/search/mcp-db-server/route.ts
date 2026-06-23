import { NextRequest, NextResponse } from "next/server";
import { Pinecone } from "@pinecone-database/pinecone";
import { pipeline } from "@xenova/transformers";
import { Client as McpClient, StdioClientTransport } from "@modelcontextprotocol/client";
import Groq from "groq-sdk";

const groq = new Groq();
const GROQ_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

function getPineConeService() {
  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY || "",
  });
  return pinecone
    .index(process.env.PINECONE_CLOUD_DB_INDEX_NAME!, process.env.PINECONE_CLOUD_DB_INDEX_HOST)
    .namespace(process.env.PINECONE_CLOUD_DB_INDEX_NAME_SPACE!);
}

async function getEmbeddingForQuery(query: string): Promise<number[]> {
  try {
    // 🔑 SAFETY CHECK: Guard against missing environment variables
    const apiKey = process.env.CLOUD_SILICON_EMBEDDING_API_KEY;
    
    if (!apiKey) {
      throw new Error("CRITICAL: CLOUD_SILICON_EMBEDDING_API_KEY is missing from environment variables.");
    }

    const response = await fetch("https://api.siliconflow.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey.trim()}`, // Trim avoids hidden trailing space/newline errors
      },
      body: JSON.stringify({
       model: "Qwen/Qwen3-Embedding-0.6B",
       input: [query], 
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`API error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    console.log("👉 Received embedding response from SiliconFlow API:", data);
    return data.data[0].embedding;
  } catch (error) {
    console.error("Error in Cloud Embedding generation:", error);
    throw error;
  }
}

// Keep track of the transport and client globally
let sharedMcpClient: McpClient | null = null;
let sharedMcpTransport: StdioClientTransport | null = null;

async function getConnectedMcpClient() {
  try {
    // 🟩 FIX: If the client exists, verify it hasn't lost its connection state
    if (sharedMcpClient) {
      // Small hack/validation check: if listTools throws, or if internal transport isn't active, reset it
      try {
        await sharedMcpClient.listTools();
        return sharedMcpClient; // Connection is warm and completely healthy!
      } catch (e) {
        console.warn("⚠️ Persistent MCP connection was found dead. Resetting connection pool...");
        await cleanUpMcpClient();
      }
    }

    console.log("🚀 Spawning clean Stdio subprocess for MCP DB Server...");
    
    sharedMcpTransport = new StdioClientTransport({
      command: "node",
      args: ["./dist/mcp-db-server/mcp-server.js"], 
    });

    const client = new McpClient(
      { name: "nextjs-inference-client", version: "1.0.0" },
      { capabilities: { tools: {} } }
    );

    await client.connect(sharedMcpTransport);
    sharedMcpClient = client;
    return sharedMcpClient;

  } catch (error) {
    console.error("Failed to initialize MCP Client:", error);
    await cleanUpMcpClient();
    throw error;
  }
}

// Helper to safely wipe references so the next pass starts entirely fresh
async function cleanUpMcpClient() {
  try {
    if (sharedMcpClient) {
      await sharedMcpClient.close();
    }
  } catch (err) {
    // Suppress secondary cleanup errors
  }
  sharedMcpClient = null;
  sharedMcpTransport = null;
}

export async function POST(req: NextRequest) {
  
  // ⚡ SPEED GAIN 1: Fetch active connection instantly (No process spawn lag)
  const mcpClient = await getConnectedMcpClient();
  
  try {
    const { query } = await req.json();
    
    // --- Phase 1: Native Semantic Pinecone RAG ---
    const namespace = getPineConeService();
    const embedding = await getEmbeddingForQuery(query);
    const searchResult = await namespace.query({
      vector: embedding,
      topK: 3,
      includeMetadata: true,
    });

    const semanticContext = searchResult.matches
      ?.map((match: any) => match.metadata?.text || "")
      .join("\n") || "No historical context found.";

    // --- Phase 2: Smart LLM Verification Loop ---
    const messages: any[] = [
      {
        role: "system",
        content: `You are a healthcare assistant with access to two data layers:
    1. Semantic Historical Context (from Vector DB):
    """
    ${semanticContext}
    """
    2. Real-Time System Verification (via Live MCP Tools).
    
    CRITICAL ROUTING & PARAMETER EXTRACTION DISCIPLINE:
    You must evaluate the user's intent and extract arguments from the Semantic Historical Context chunk above to fill tool fields:

    1. PATIENT RECORDS & REGISTRATION:
       - Intent: User asks for patient records or registration details.
       - Action: Call 'validate_rag_patient'.
       - Parameter Extraction: Extract the "Name", "Email", or "Phone" fields belonging to that patient.

    2. APPOINTMENTS & BOOKINGS:
       - Intent: Checking schedule status or booking information.
       - Action: Call 'validate_rag_appointment'.
       - Parameter Extraction: Extract the patient's name and email from the context chunk.
       - OUTPUT FORMATTING MANDATE (STRICT NLP PARAGRAPH ONLY): 
         * Do not use bullet points, bold key-value pairs, headers, dashes, or markdown tables.
         * Present the appointment history as a fluid, continuous reading paragraph for the patient. 
         * Write in natural language using this exact descriptive narrative structure: 
           "[Patient Name] has a [status] appointment with Dr. [Physician Name] scheduled on [Human Readable Date] for [Reason/Notes]."
         * If there are multiple appointments, join them naturally using transitional phrases (e.g., "Additionally, they have another appointment...", "Following that, a visit is set for...").
         * Completely omit the internal 'patientSnapshot' ID strings, tracking metadata, or structural brackets from the spoken text response.

    3. DOCTOR & PHYSICIAN INFO:
       - Intent: Asking for a doctor list or names.
       - Action: Call 'validate_rag_doctor_by_name'.
       - OUTPUT FORMATTING MANDATE (STRICT NLP PARAGRAPH ONLY):
        * Do not use bullet points, numbered lists, raw database keys, or headers.
        * Present the available medical team as a fluid, continuous reading narrative paragraph.
        * Write in natural language using this exact descriptive structure: 
          "The medical team includes Dr. [Physician Name] specializing in [Specialty/Details], Dr. [Physician Name]..., and Dr. [Physician Name]."
        * If no specialities are returned by the tool, smoothly chain their names together using commas and transitional words (e.g., "Our active on-duty medical staff consists of Dr. Alex Ramirez, Dr. Alyana Cruz, and Dr. Hardik Sharma.")

    4. USER ACCOUNTS & PROFILES:
       - Intent: Reviewing authentication accounts or system states.
       - Action: Call 'validate_rag_auth'.

    Strictly use the parameters found inside the context chunk to fulfill tool arguments.`
      },
      { role: "user", content: query }
    ];

    // ✅ Fetch tools dynamically using the proper MCP Client API method
    const mcpToolsResponse = await mcpClient.listTools();
    const availableTools = mcpToolsResponse.tools || [];

    // Map tools correctly into the formatting schema Groq expects
    const formattedTools = availableTools.map((tool) => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }));

    const response = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages,
      tools: formattedTools,
      temperature: 0,
      tool_choice: "auto"
    });

    const choice = response.choices[0].message;

    // Process tool execution if requested by the LLM
    if (choice.tool_calls && choice.tool_calls.length > 0) {
      const toolCall = choice.tool_calls[0];
      
      const mcpResult = await mcpClient.callTool({
        name: toolCall.function.name,
        arguments: JSON.parse(toolCall.function.arguments),
      });

      const stringifiedToolPayload = mcpResult.content?.[0]?.text || "No records returned from database.";

      messages.push(choice);
      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: stringifiedToolPayload,
      });

      const finalizedResponse = await groq.chat.completions.create({
        model: GROQ_MODEL,
        messages,
      });

      // 🟩 CLEANUP: Return ONLY the natural language string answer response
      return NextResponse.json({
        answer: finalizedResponse.choices[0].message.content || "No information processed."
      }, { status: 200 });
    }

    // Return text directly here if no tools were called
    return NextResponse.json({
      answer: choice.content || "No information processed."
    }, { status: 200 });

  } catch (error: any) {
    console.error("Error in combined Inference Endpoint:", error);
    return NextResponse.json({ message: "Internal Server Error", error: error.message }, { status: 500 });
  } finally {
    // if (mcpClient) {
    //   try {
    //     await mcpClient.close();
    //   } catch (closeError) {
    //     console.error("Failed to cleanly shut down MCP client connection:", closeError);
    //   }
    console.log("📥 Request transaction complete. Keeping connection pool alive.");
    }
  }
}
