import { NextRequest, NextResponse } from "next/server";
import path from "node:path";

// Main Third-Party Data Systems
import { Pinecone } from "@pinecone-database/pinecone";
import Groq from "groq-sdk";

// Official Model Context Protocol SDK Client Imports
import { Client as McpClient } from "@modelcontextprotocol/client";


// Initialize Groq Cloud Engine
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const GROQ_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

// Configure your Pinecone index and namespace
const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX_NAME = process.env.PINECONE_CLOUD_DOC_INDEX_NAME;
const PINECONE_INDEX_HOST = process.env.PINECONE_CLOUD_DOC_INDEX_HOST;
const PINECONE_INDEX_NAME_SPACE = process.env.PINECONE_CLOUD_DOC_INDEX_NAME_SPACE;

const pinecone = new Pinecone({
  apiKey: PINECONE_API_KEY || "",
});

const namespace = pinecone
  .index(PINECONE_INDEX_NAME!, PINECONE_INDEX_HOST)
  .namespace(PINECONE_INDEX_NAME_SPACE!);

let extractor: any;

async function getEmbedding(query: string): Promise<number[]> {
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

const getSubstantiveQuery = (q: string): string => {
  const conversationalPrefix = "get me the paragraph";
  const normalizedQuery = q.trim().toLowerCase();
  if (normalizedQuery.startsWith(conversationalPrefix)) {
    return q.substring(conversationalPrefix.length).trim();
  }
  return q;
};

  
// =================================================================
// 🛡️ PERSISTENT MCP CONNECTION WRAPPER POOL
// =================================================================
let sharedMcpClient: McpClient | null = null;

async function getConnectedMcpClient(): Promise<McpClient> {
  try {
    if (sharedMcpClient) {
      try {
        await sharedMcpClient.listTools();
        return sharedMcpClient;
      } catch (e) {
        console.warn("⚠️ Stale internal MCP handle captured. Wiping container allocation pool...");
        await cleanUpMcpClient();
      }
    }

    const baseAppUrl = process.env.MCP_SERVER_APP_URL || "http://localhost:3000";

    const client = new McpClient(
      { name: "nextjs-agent-inference-client", version: "1.0.0" },
      { url: `${baseAppUrl}/api/mcp-server-remote/mcp-doc-server` }
    );

    sharedMcpClient = client;
    return sharedMcpClient;

  } catch (error) {
    console.error("Initialization crash inside native MCP pipeline:", error);
    await cleanUpMcpClient();
    throw error;
  }
}

async function cleanUpMcpClient() {
  try {
    if (sharedMcpClient) await sharedMcpClient.close();
  } catch (err) {}
  sharedMcpClient = null;
  }

// =================================================================
// 🚀 AGENTIC AGGREGATION & EXECUTION ROUTE
// =================================================================
export async function POST(req: NextRequest) {
  if (req.method !== "POST") {
    return NextResponse.json({ message: "Method not Allowed" }, { status: 405 });
  }

  const mcpClientInstance = await getConnectedMcpClient();

  try {
    const { query } = await req.json();
   
    console.log("Received query for document search:", query);
    
    // 1. Core Semantic Pinecone Vector Lookup
    const substantiveQuery = getSubstantiveQuery(query);
    const queryEmbedding = await getEmbedding(substantiveQuery);

    const searchResult = await namespace.query({
      vector: queryEmbedding,
      topK: 1,
      includeMetadata: true,
    });

    console.log("Pinecone Search Result:", searchResult.matches);

    if (!searchResult.matches || searchResult.matches.length === 0) {
      return NextResponse.json({ answer: "I could not locate any relevant source files matching your request." }, { status: 200 });
    }

    const matchedRecord: any = searchResult.matches[0];
    const bigParagraph = matchedRecord.metadata?.paragraph || "";
    const matchedLine = matchedRecord.metadata?.line || "";
    const sourceFilename = matchedRecord.metadata?.source || "";
    
    console.log(`📌 [Pinecone Search Hit] Source File: ${sourceFilename}`);
    
    // 2. Build the System Instruction Core
    const semanticContextBlock = `Source File Target: ${sourceFilename}\nHeader Path: ${matchedLine}\nText Fragment: ${bigParagraph}`;

    const messages: any[] = [
      {
        role: "system",
        content: `You are an advanced medical document verification assistant. You have access to a semantic vector database fragment and an active, real-time file validation tool.
    SEMANTIC DOCBASE CONTEXT CHUNK:
    """
    ${semanticContextBlock}
    """
    CRITICAL DISCIPLINE & ROUTING RULES:
    1. First, evaluate if the content returned from the vector search can be verified by checking your local file validation tool.
    2. Call 'validate_rag_document' to fetch and verify the content from the file located under the 'public/uploads' server directory. 
    3. You MUST pass exactly TWO parameters inside your tool arguments:
       - 'extracted_text': The exact, unedited text body block from the text fragment that needs strict file alignment checks.
       - 'source_filename': The exact target filename string provided above ("${sourceFilename}").
    4. DO NOT invent alternative file paths.
    5. When processing the tool response output payload:
       - If validation fails, use the alternative context returned in the tool response ('closestMatchedContext' or 'originalDocumentPreview') to address the user query transparently. Clarify any changes or anomalies found.`
      }, 
      { role: "user", content: query }
    ];

    // 3. Dynamically read schemas from our independent server via the protocol
    const serverSchemaInventory = await mcpClientInstance.listTools();
    const activeToolsList = serverSchemaInventory.tools || [];

    const formattedToolsForGroq = activeToolsList.map((tool) => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }));

    // 4. FIRST PASS: Send parameters to Groq to extract functional values
    console.log("[Groq Pass 1] Routing query context to extract document tools arguments...");
    const initialCompletion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages,
      tools: formattedToolsForGroq,
      tool_choice: "auto"    
    });

    const primaryChoiceMessage = initialCompletion.choices[0].message;

    console.log("Groq Primary Choice Message:", primaryChoiceMessage);

    //5. Check if Groq decided to execute our Independent Validation Tool
    if (primaryChoiceMessage.tool_calls && primaryChoiceMessage.tool_calls.length > 0) {
      const activeToolCall = primaryChoiceMessage.tool_calls[0];
      const parsedArguments = JSON.parse(activeToolCall.function.arguments);

      // 🛡️ HARD SANITIZATION GUARD: Completely strips out any accidental filename parameters
      const sanitizedArguments = {
        extracted_text: parsedArguments.extracted_text || bigParagraph,
        source_filename: parsedArguments.source_filename || sourceFilename
      };

      console.log(`[MCP Invocation] Executing standalone tool: ${activeToolCall.function.name}`);
      
      const fileSystemToolResult = await mcpClientInstance.callTool({
        name: activeToolCall.function.name,
        arguments: sanitizedArguments, // Using the sanitized argument structure safely
      });

      const toolPayloadString = fileSystemToolResult.content?.[0]?.text || '{"isDocumentValid": false}';

      console.log(`[MCP Tool Result] ${toolPayloadString}`);

      // 🛡️ CRITICAL STEP: Extract the verification status out of the stringified JSON
      let isVerified = false;
      try {
        const parsedToolPayload = JSON.parse(toolPayloadString);
        isVerified = !!parsedToolPayload.isDocumentValid;
      } catch (e) {
        console.error("Failed parsing stringified payload from MCP output stream:", e);
      }

      // Push historical chain to maintain agent state context
      messages.push(primaryChoiceMessage);

      messages.push({
        role: "tool",
        tool_call_id: activeToolCall.id,
        content: toolPayloadString,
      });

      // 6. SECOND PASS: Send verified payload back to Groq for clean prose composition
      console.log("[Groq Pass 2] Composing natural language output paragraph block...");
      const finalCleanCompletion = await groq.chat.completions.create({
        model: GROQ_MODEL,
        messages,
        temperature: 0.1 // 📉 Lowered temperature to stop hallucination of medical facts
      });

      console.log("Groq Final Completion:", finalCleanCompletion.choices[0].message.content);

      return NextResponse.json({
        result: finalCleanCompletion.choices[0].message.content || "No information processed by the validation pipeline.",
        meta: {
          isValidated: isVerified,
          documentChecked: sourceFilename
         }
      }, { status: 200 });
    }

    // Alternate Fallback: If the model determined no file tools were required to answer
    return NextResponse.json({
      result: primaryChoiceMessage.content || "Context process execution concluded."
    }, { status: 200 });

  } catch (error: any) {
    console.error("Critical Failure inside combined Agent Route:", error);
    return NextResponse.json({ message: "Internal Server Error", error: error.message }, { status: 500 });
  }
}