import { NextRequest, NextResponse } from "next/server";
import { Pinecone } from "@pinecone-database/pinecone";
import { pipeline } from "@xenova/transformers";
import { createMCPClient } from "@ai-sdk/mcp";
import { translateText } from "@/components/translate/n8nTranslate";
import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const GROQ_MODEL = "qwen/qwen3.8-27b";

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
    const apiKey = process.env.CLOUD_JINA_EMBEDDING_API_KEY;

    if (!apiKey) {
      throw new Error(
        "CRITICAL: CLOUD_JINA_EMBEDDING_API_KEY is missing from environment variables."
      );
    }

    const response = await fetch("https://api.jina.ai/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey.trim()}`, // Trim avoids hidden trailing space/newline errors
      },
      body: JSON.stringify({
        model: "jina-embeddings-v3",
        input: [query],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`API error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    console.log("👉 Received embedding response from Jina API:", data);
    return data.data[0].embedding;
  } catch (error) {
    console.error("Error in Cloud Embedding generation:", error);
    throw error;
  }
}

async function getConnectedMcpClient() {
  try {
    // Determine url safely based on environment
    let baseAppUrl = process.env.MCP_SERVER_APP_URL;

    if (!baseAppUrl) {
      if (process.env.VERCEL_URL) {
        // Vercel auto-provides VERCEL_URL but drops the protocol prefix
        baseAppUrl = `https://${process.env.VERCEL_URL}`;
      } else {
        // Local development fallback
        baseAppUrl = "http://127.0.0.1:3000";
      }
    }

    console.log("🔌 MCP Client connecting to target backend infrastructure at:", baseAppUrl);

    const mcpClient = await createMCPClient({
      transport: {
        type: "http",
        url: `${baseAppUrl}/api/mcp-server-remote/mcp-db-server`,
        // Allow the fetch runtime to resolve trailing slashes or routing rewrites
        redirect: "follow",
        // 🟩 ADD THIS PROPERTY TO FIX CHIPS/SESSION ISSUES OVER HTTP PROTOCOLS:
        headers: async () => ({
          "Content-Type": "application/json",
          Accept: "application/json", // Forces JSON response instead of event-stream
        }),
      },
    });
    return mcpClient;
  } catch (error) {
    console.error("Failed to initialize MCP Client:", error);
    throw error;
  }
}

/**
 * 🟩 REUSABLE CORE LOGIC
 * Exported so internal callers like `executeDynamicSourceQuery` / TTS / STT
 * can invoke it directly without making HTTP loopback fetches.
 */
export async function executeDBQuery(query: string) {
  // ⚡ SPEED GAIN 1: Fetch active connection instantly (No process spawn lag)
  const mcpClient = await getConnectedMcpClient();

  try {
    // --- Phase 1: Native Semantic Pinecone RAG ---
    const namespace = getPineConeService();
    const embedding = await getEmbeddingForQuery(query);
    const searchResult = await namespace.query({
      vector: embedding,
      topK: 3,
      includeMetadata: true,
    });

    const semanticContext =
      searchResult.matches?.map((match: any) => match.metadata?.text || "").join("\n") ||
      "No historical context found.";

    console.log("📝 Context loaded into LLM Window:\n", semanticContext);

    // --- Phase 2: Smart LLM Verification Loop ---
    const messages: any[] = [
      {
        role: "system",
        content: `You are an automated medical records and verification assistant.

        DATA LAYER (Semantic Context from Vector DB):
        """
        ${semanticContext}
        """

        YOUR TASK:
        Analyze the user's query and the DATA LAYER above. If live database verification is needed, call the appropriate tool with arguments extracted directly from the DATA LAYER.

        ROUTING & PARAMETER EXTRACTION RULES:
        1. Patient Records ('validate_rag_patient'):
          - Extract exact strings for 'name', 'email', or 'phone' from the DATA LAYER.
        2. Appointments & Bookings ('validate_rag_appointment'):
          - Extract exact strings for 'name' and 'email' belonging to the patient from the DATA LAYER.
        3. Doctor & Physician Info ('validate_rag_doctor_by_name'):
          - Extract doctor's 'name' or specialty if present in the user query or DATA LAYER.
        4. User Accounts ('validate_rag_auth'):
          - Extract 'email' or user identifier from the DATA LAYER.

        CRITICAL ARGUMENT RULES:
        - Must extract ONLY the plain value string without missing to send required values to tool calling (e.g., use "Jane Doe", NEVER "Name: Jane Doe", "Email: jane.doe@example.com").
        - NEVER send empty, null, or undefined parameters. If a required field cannot be found in the DATA LAYER or user query, do NOT invoke the tool; answer directly using the DATA LAYER text.`,
      },
      { role: "user", content: query },
    ];

    // ✅ Grab AI SDK formatted tools directly from your client instance
    const mcpTools = await mcpClient.tools();

    // Transform Vercel AI SDK tool shapes to match Groq's rigid native structure
    const formattedTools = Object.entries(mcpTools).map(([name, tool]: [string, any]) => {
      // Safely uncover properties regardless of nested Zod or AI SDK wrapper shape
      const rawParameters = tool.parameters?.shape
        ? tool.parameters
        : tool.parameters?.properties
          ? tool.parameters
          : { type: "object", properties: {} };

      // Extract the true JSON Schema structure out of the Vercel AI SDK wrapper
      const cleanProperties = JSON.parse(
        JSON.stringify(rawParameters.properties || rawParameters || {})
      );
      const requiredFields = Array.isArray(rawParameters.required) ? rawParameters.required : [];

      // Remove additionalProperties constraints entirely to prevent Groq 400s
      for (const key of Object.keys(cleanProperties)) {
        if (cleanProperties[key] && typeof cleanProperties[key] === "object") {
          delete cleanProperties[key].additionalProperties;
        }
      }

      return {
        type: "function" as const,
        function: {
          name: name,
          description: tool.description,
          parameters: {
            type: "object",
            properties: cleanProperties,
            required: requiredFields,
          },
        },
      };
    });

    // Diagnostic Log: Let's see what Groq is actually receiving as its manifest
    console.log("🛠️ Formatted Tools sent to Groq:", JSON.stringify(formattedTools, null, 2));

    const response = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages,
      tools: formattedTools,
      temperature: 0,
      tool_choice: "auto",
    });

    const choice = response.choices[0].message;

    // Process tool execution if requested by the LLM
    if (choice.tool_calls && choice.tool_calls.length > 0) {
      const toolCall = choice.tool_calls[0];
      const toolName = toolCall.function.name; // e.g., "validate_rag_patient"

      // 🗺️ Map your actual backend tool names to clean human-readable Table/Schema Names
      let tableName = "System Ledger";
      if (toolName === "validate_rag_patient") tableName = "Patient Registry";
      if (toolName === "validate_rag_appointment") tableName = "Appointments";
      if (toolName === "validate_rag_doctor_by_name") tableName = "Doctor";
      if (toolName === "validate_rag_auth") tableName = "User Accounts";

      // FIX 3: Target the tool from the SDK tools proxy mapping instead of falling back to .callTool()
      const targetTool = mcpTools[toolName];
      if (!targetTool) {
        throw new Error(
          `Model requested tool "${toolName}" which is unavailable on the remote server.`
        );
      }

      const parsedArguments = JSON.parse(toolCall.function.arguments);

      console.log(`🔧 Executing MCP Tool [${toolName}] with args:`, parsedArguments);

      // Execute via Vercel AI SDK runtime engine wrapper wrapper natively
      const mcpResult = await targetTool.execute(parsedArguments);

      // 🔍 DIAGNOSTIC LOG: Inspect raw MCP response payload
      console.log("📥 RAW MCP SERVER RESPONSE:", JSON.stringify(mcpResult, null, 2));

      // Handle output parsing cleanly regardless of string or raw structural payload arrays returned
      const stringifiedToolPayload =
        typeof mcpResult === "string" ? mcpResult : JSON.stringify(mcpResult);

      console.log("📝 STRINGIFIED TOOL PAYLOAD FOR LLM:", stringifiedToolPayload);

      const hasLiveRecords = stringifiedToolPayload !== "No records returned from database.";

      messages.push(choice);
      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: stringifiedToolPayload,
      });

      const currentDate = new Date().toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      // Inject formatting requirements ONLY at synthesis execution step
      messages.push({
        role: "system",
        content: `Synthesize the retrieved tool data into a clean, human-like narrative response.

      TODAY'S CURRENT DATE: ${currentDate}

      CRITICAL CHRONOLOGY & GROUPING RULES:
      1. Compare all appointment dates strictly against TODAY'S CURRENT DATE (${currentDate}):
        - Dates BEFORE today MUST be categorized under past/historical visits.
        - Dates AFTER today are categorized as upcoming/future visits.
      2. Group all past visits into a consolidated background history statement (e.g., "In past history, Narendra had visits with...").
      3. Present upcoming/future appointments in strict chronological order.

      STRICT FORMATTING MANDATE: follow the mentioned narrative to produce the nlp result.
      - Present as 1-2 fluid, continuous narrative paragraphs.
      - Absolutely NO bullet points, lists, bold key-value labels, headers, or markdown tables.
      - Omit raw database IDs, hashes, timestamps, or system tokens.
      - Maintain a warm, clear, and natural tone.`,
      });

      const finalizedResponse = await groq.chat.completions.create({
        model: GROQ_MODEL,
        messages,
      });

      // Inside your POST route after getting finalResponse:
      const rawContent =
        finalizedResponse.choices[0].message.content || "No information processed.";
      const cleanAnswer = sanitizeLLMResponse(rawContent);

      console.log("📝 FINALIZED LLM RESPONSE:", finalizedResponse.choices[0].message.content);
      // 🟢 FIXED: Opening bracket on the same line to avoid returning undefined
      return {
        answer: cleanAnswer,
        isVerified: hasLiveRecords,
        tableName: hasLiveRecords ? tableName : undefined,
      };
    }

    // 🟢 FIXED: Opening bracket on the same line to avoid returning undefined
    return {
      answer: choice.content || "No information processed.",
      isVerified: false,
      tableName: "Medical Knowledge Base",
    };
  } catch (error: any) {
    console.error("Error in combined Inference Endpoint:", error);
    // 🔴 THROW the error so the POST handler catches it
    throw new Error(error?.message || "Database inference query failed.");
  } finally {
    if (mcpClient) {
      try {
        await mcpClient.close?.().catch((closeErr: any) => {
          console.warn("MCP Client cleanup warning:", closeErr?.message);
        });
      } catch (cleanupError) {
        console.warn("Failed to close MCP client cleanly:", cleanupError);
      }
    }
  }
}

// Helper utility function to clean reasoning tags
function sanitizeLLMResponse(text: string): string {
  if (!text) return "";
  // Strip out <think>...</think> blocks and trim surrounding whitespace
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

/**
 * 🟩 NEXT.JS ROUTE HANDLER
 * Wraps executeDBQuery for HTTP POST requests.
 */
export async function POST(req: NextRequest) {
  try {
    const { query, targetLanguage } = await req.json();

    if (!query || typeof query !== "string" || !query.trim()) {
      return NextResponse.json({ error: "Query payload is required." }, { status: 400 });
    }

    // Step 1: Translate input query to English if non-English
    let englishQuery = query;
    if (targetLanguage !== "en") {
      englishQuery = await translateText(query, targetLanguage, "en");
    }

    // Step 2: Query Database with englishQuery
    const responseData = await executeDBQuery(englishQuery);

    // Step 3: Translate response back to original targetLanguage
    let translatedResult = responseData.result;
    if (targetLanguage !== "en" && responseData.result) {
      translatedResult = await translateText(responseData.result, "en", targetLanguage);
    }
    console.log("📝Response From executeDBQuery:", translatedResult);

    return NextResponse.json(
      {
        result: translatedResult,
        meta: responseData.meta,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error in combined Inference Endpoint:", error);
    // The client receives this exact JSON structure on status 500
    // 🟢 Return structured JSON so the client can safely read data.error
    return NextResponse.json(
      {
        error: error?.message || "Internal Server Error during DB Query execution.",
        isVerified: false,
      },
      { status: 500 }
    );
  }
}
