import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import Groq from "groq-sdk";
import { createMCPClient } from "@ai-sdk/mcp";

import { Pinecone } from "@pinecone-database/pinecone";
import { pipeline } from "@xenova/transformers";

// Initialize Groq Cloud Engine
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const GROQ_MODEL = "qwen/qwen3.6-27b";

// Configure Pinecone index and namespace
const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX_NAME = process.env.PINECONE_CLOUD_DOC_INDEX_NAME;
const PINECONE_INDEX_HOST = process.env.PINECONE_CLOUD_DOC_INDEX_HOST;
const PINECONE_INDEX_NAME_SPACE = process.env.PINECONE_CLOUD_DOC_INDEX_NAME_SPACE;

const pinecone = new Pinecone({
  apiKey: PINECONE_API_KEY || "",
});

const namespace = pinecone
  .index(PINECONE_INDEX_NAME!, PINECONE_INDEX_HOST!)
  .namespace(PINECONE_INDEX_NAME_SPACE!);

// Global MCP client instance pool
let mcpClientInstance: any = null;

// =================================================================
// 🛠️ HELPER FUNCTIONS
// =================================================================

function sanitizeLLMContent(text: string): string {
  if (!text) return "";
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

function getSubstantiveQuery(q: string): string {
  const conversationalPrefix = "get me the paragraph";
  const normalizedQuery = q.trim().toLowerCase();
  if (normalizedQuery.startsWith(conversationalPrefix)) {
    return q.substring(conversationalPrefix.length).trim();
  }
  return q;
}

let extractor: any;

async function initializeModel() {
  if (!extractor) {
    extractor = await pipeline("feature-extraction", "Xenova/bge-m3");
    console.log("Model loaded and ready to generate embeddings...");
  }
  return extractor;
}

export async function getEmbedding(text: string): Promise<number[]> {
  const initializedExtractor = await initializeModel();
  const output = await initializedExtractor(text, {
    pooling: "mean",
    normalize: true,
  });
  return Array.from(output.data);
}

async function getMcpClient(): Promise<any> {
  if (mcpClientInstance) {
    return mcpClientInstance;
  }

  try {
    let baseAppUrl = process.env.MCP_SERVER_APP_URL;

    if (!baseAppUrl) {
      if (process.env.VERCEL_URL) {
        baseAppUrl = `https://${process.env.VERCEL_URL}`;
      } else {
        baseAppUrl = "http://127.0.0.1:3000";
      }
    }

    const mcpClient = await createMCPClient({
      transport: {
        type: "http",
        url: `${baseAppUrl}/api/mcp-server-remote/mcp-doc-server`,
        redirect: "follow",
        headers: async () => ({
          "Content-Type": "application/json",
          Accept: "application/json",
        }),
      },
    });
    mcpClientInstance = mcpClient;
    return mcpClient;
  } catch (error) {
    console.error("Failed to initialize MCP Client:", error);
    throw error;
  }
}

// =================================================================
// 🟢 SHARED INTERNAL ENGINE FUNCTION
// =================================================================
export async function executeDocQuery(query: string) {
  console.log("Received query for document search:", query);

  // 1. Core Semantic Pinecone Vector Lookup
  const substantiveQuery = getSubstantiveQuery(query);
  const queryEmbedding = await getEmbedding(substantiveQuery);

  const searchResult = await namespace.query({
    vector: queryEmbedding,
    topK: 1,
    includeMetadata: true,
  });

  if (!searchResult.matches || searchResult.matches.length === 0) {
    return {
      result: "I could not locate any relevant source files matching your request.",
      meta: { isValidated: false, documentChecked: null },
    };
  }

  const matchedRecord: any = searchResult.matches[0];
  const bigParagraph = matchedRecord.metadata?.paragraph || "";
  const matchedLine = matchedRecord.metadata?.line || "";
  const sourceFilename = matchedRecord.metadata?.source || "";

  // 2. Build System Instructions
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
    - If validation fails, use the alternative context returned in the tool response ('closestMatchedContext' or 'originalDocumentPreview') to address the user query transparently. Clarify any changes or anomalies found.`,
    },
    { role: "user", content: query },
  ];

  // 3. Dynamic Tool Schema Format
  const mcpClient = await getMcpClient();
  const rawToolsResponse = await mcpClient.listTools();

  const toolsArray = Array.isArray(rawToolsResponse)
    ? rawToolsResponse
    : rawToolsResponse.tools || [];

  const formattedTools = toolsArray.map((tool: any) => {
    const baseSchema = tool.inputSchema || tool.parameters || {};
    const cleanProperties = baseSchema.properties
      ? JSON.parse(JSON.stringify(baseSchema.properties))
      : {};
    const requiredFields = Array.isArray(baseSchema.required) ? baseSchema.required : [];

    for (const key of Object.keys(cleanProperties)) {
      if (cleanProperties[key] && typeof cleanProperties[key] === "object") {
        delete cleanProperties[key].additionalProperties;
        if (cleanProperties[key].description === "") delete cleanProperties[key].description;
      }
    }

    return {
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description || `Execute ${tool.name}`,
        parameters: {
          type: "object",
          properties: cleanProperties,
          required: requiredFields,
        },
      },
    };
  });

  // 4. Pass 1: Groq Tool Execution Choice
  const initialCompletion = await groq.chat.completions.create({
    model: GROQ_MODEL,
    messages,
    tools: formattedTools,
    tool_choice: "auto",
  });

  const primaryChoiceMessage = initialCompletion.choices[0].message;

  // 5. Execute Tool Path
  if (primaryChoiceMessage.tool_calls && primaryChoiceMessage.tool_calls.length > 0) {
    const activeToolCall = primaryChoiceMessage.tool_calls[0];
    const parsedArguments = JSON.parse(activeToolCall.function.arguments);

    const sanitizedArguments = {
      extracted_text: parsedArguments.extracted_text || bigParagraph,
      source_filename: parsedArguments.source_filename || sourceFilename,
    };

    const fileSystemToolResult = await mcpClient.callTool({
      name: activeToolCall.function.name,
      arguments: sanitizedArguments,
    });

    const contentItem = fileSystemToolResult.content?.[0];
    let toolPayloadString = '{"isDocumentValid": false}';

    if (contentItem && contentItem.type === "text") {
      toolPayloadString = contentItem.text;
    }

    let isVerified = false;
    try {
      const parsedToolPayload = JSON.parse(toolPayloadString);
      isVerified = !!parsedToolPayload.isDocumentValid;
    } catch (e) {
      console.error("Failed parsing stringified payload from MCP output stream:", e);
    }

    messages.push(primaryChoiceMessage);
    messages.push({
      role: "tool",
      tool_call_id: activeToolCall.id,
      content: toolPayloadString,
    });

    // 6. Pass 2: Clean Prose Generation
    const finalCleanCompletion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages,
      temperature: 0.1,
    });

    const rawAnswer =
      finalCleanCompletion.choices[0].message.content ||
      "No information processed by the validation pipeline.";
    const cleanAnswer = sanitizeLLMContent(rawAnswer);

    return {
      result: cleanAnswer,
      meta: {
        isValidated: isVerified,
        documentChecked: sourceFilename,
      },
    };
  }

  return {
    result: primaryChoiceMessage.content || "Context process execution concluded.",
    meta: { isValidated: false, documentChecked: sourceFilename },
  };
}

// =================================================================
// 🟢 HTTP ROUTE HANDLER
// =================================================================
export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();
    const responseData = await executeDocQuery(query);
    return NextResponse.json(responseData, { status: 200 });
  } catch (error: any) {
    console.error("Critical Failure inside combined Agent Route:", error);
    return NextResponse.json(
      { message: "Internal Server Error", error: error.message },
      { status: 500 }
    );
  }
}
