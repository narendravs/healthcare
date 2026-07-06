import { McpServer, isInitializeRequest,WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/server';

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import pdfParse from 'pdf-parse-fixed'; // 🛡️ Using fixed version to prevent path validation crash
import mammoth from 'mammoth';
import { NextResponse } from 'next/server';
import type { NextApiRequest, NextApiResponse } from 'next';
import { Transform } from 'stream';


// 1. Resolve absolute paths reliably regardless of execution working directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Move up from your script directory directly into Next.js's public/uploads target folder
const DOCUMENTS_DIRECTORY = path.resolve(__dirname, "../../public/documents");

console.error(`[MCP Config] Target Uploads Directory resolved to: ${DOCUMENTS_DIRECTORY}`);

// A lightweight fallback implementation of an in-memory event store
// (Replace with Redis if deploying to multi-instance serverless hosting layers)
class SimpleEventStore{
  private store = new Map<string, any[]>();
  async getEvents(sid: string): Promise<any[]> {
    return this.store.get(sid) || [];
  }

  async storeEvent(sid: string, ev: any): Promise<void> {
    if (!this.store.has(sid)) {
      this.store.set(sid, []);
    }
    this.store.get(sid)?.push(ev);
  }
  clear(sid:string){
    this.store.delete(sid);
  }
}
 
const mcpServer = new McpServer({
  name: "hospital-document-validator",
  version: "1.0.0"
});

const eventStore = new SimpleEventStore();

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
    .replace(/-\n/g, "")           // Stitch words split by hyphens (e.g. diag-\nnosis -> diagnosis)
    .replace(/\r?\n|\r/g, " ")     // Convert raw line breaks into generic spacing
    .replace(/[^a-zA-Z0-9 ]/g, "")  // Remove extra punctuation layout marks
    .replace(/\s+/g, " ")          // Collapse multiple consecutive spaces down to one
    .trim()
    .toLowerCase();
};

/**
 * TOOL 1: validate_rag_document
 * Targets the exact document provided by Pinecone metadata context.
 */
mcpServer.registerTool(
  "validate_rag_document",
  {
    description: "Validates unstructured paragraph text segments extracted from Pinecone by dynamically matching them across files inside the local upload directory.",
    inputSchema: z.object({
      extracted_text: z.string().describe("The relevant text chunk or slice returned from the vector database matches"),
      source_filename: z.string().describe("The targeted filename extracted directly from Pinecone vector chunk metadata source")
    })
  },
  async ({ extracted_text, source_filename }) => {
    // ⚠️ CRITICAL DIRECTION: Log strictly to stderr to prevent breaking the standard JSON-RPC Stdio pipe
    console.error(` [MCP TOOL RUNNING: validate_rag_document]`);
    console.error(`   -> Absolute Target Directory: "${DOCUMENTS_DIRECTORY}"`);
    console.error(`   -> Targeted File Target: "${source_filename}"`);
    console.error(`   -> Input Text Length: ${extracted_text?.length} characters`);

    if (!source_filename) {
      console.error("⚠️ Execution Warning: source_filename parameter missing.");
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ isDocumentValid: false, reasoningMeta: "Verification halted: source_filename string param was missing." })
        }]
      };
    }

    // FORCE EVALUATION RIGHT HERE INSIDE THE RUNTIME BLOCK
    const runtimeUploadsDir = path.join(process.cwd(), "public", "documents");
    const targetFilePath = path.win32.normalize(path.join(runtimeUploadsDir, source_filename));

    console.error(`[SYSTEM DEBUG] Normalizing file lookups to: "${targetFilePath}"`);

      try {
        if (fs.existsSync(runtimeUploadsDir)) {
          const filesOnDisk = fs.readdirSync(runtimeUploadsDir);
          console.error(`[SYSTEM DEBUG] Physical files found inside directory: ${JSON.stringify(filesOnDisk)}`);
        } else {
          console.error(`[SYSTEM DEBUG] CRITICAL: Node cannot even see the directory: "${runtimeUploadsDir}"`);
        }
      } catch (dirError) {
        console.error(`[SYSTEM DEBUG] Failed to scan parent directory`, dirError);
      }

      // 3. Fallback to fs.accessSync which checks OS security handle tables directly
      let fileExists = false;
      try {
        fs.accessSync(targetFilePath, fs.constants.F_OK);
        fileExists = true;
      } catch (e) {
        fileExists = false;
      }

    try {
      // Guard Clause: Ensure the file actually physically exists on the disk array
      if (!fs.existsSync(targetFilePath)) {
        console.error(`❌ Targeted file not found: ${targetFilePath}`);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              isDocumentValid: false,
              reasoningMeta: `Verification failed: The target file '${source_filename}' does not exist on disk storage.`
            })
          }]
        };
      }

      const fileExtension = path.extname(source_filename).toLowerCase();
      let originalFileContent = "";

      // Target File Content Extraction Matrix
      if (fileExtension === '.pdf') {
        const dataBuffer = fs.readFileSync(targetFilePath);
        const pdfData = await pdfParse(dataBuffer);
        originalFileContent = pdfData.text;
      } 
      else if (fileExtension === '.docx') {
        const dataBuffer = fs.readFileSync(targetFilePath);
        const docxResult = await mammoth.extractRawText({ buffer: dataBuffer });
        originalFileContent = docxResult.value;
      } 
      else if (fileExtension === '.txt' || fileExtension === '.md') {
        originalFileContent = fs.readFileSync(targetFilePath, "utf-8");
      } 
      else {
        console.error(`   ⚠️ Unsupported file format: "${source_filename}"`);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ isDocumentValid: false, reasoningMeta: "Unsupported file system target type format extension." })
          }]
        };
      }

      // Perform deep text normalizations
      const cleanExtracted = normalizeTextForMatching(extracted_text);
      const cleanOriginal = normalizeTextForMatching(originalFileContent);

      // Level 1 validation: Strict continuous match check
      if (cleanOriginal.includes(cleanExtracted)) {
        console.error(`   ✅ Ground-truth validation match confirmed for: "${source_filename}"`);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              isDocumentValid: true,
              sourceFileChecked: source_filename,
              reasoningMeta: "Successfully verified document text alignment against ground-truth disk records.",
              verifiedText: cleanExtracted // Explicitly returning the text to the LLM context
            })
          }]
        };
      }

      // Level 2 validation fallback: Partial signature check to combat extreme structural variations
      const signatureSliceLength = Math.min(120, Math.floor(cleanExtracted.length * 0.4));
      const midTextSignature = cleanExtracted.substring(
        Math.floor(cleanExtracted.length * 0.2),
        Math.floor(cleanExtracted.length * 0.2) + signatureSliceLength
      );

      if (midTextSignature.length > 15 && cleanOriginal.includes(midTextSignature)) {
        console.error(`   ✅ Signature context verified inside target document: "${source_filename}"`);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              isDocumentValid: true,
              sourceFileChecked: source_filename,
              reasoningMeta: "Verified chunk alignment using signature text block identification patterns."
            })
          }]
        };
      }

      console.error("   ❌ Text snippet could not be verified in the target file.");
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            isDocumentValid: false,
            reasoningMeta: "Security/Data Warning: The text context retrieved from the vector database has been altered or does not match structural file data configurations."
          })
        }]
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

  console.error(`[MCP Routing Debug] Extracted SessionID: "${mcpSessionId}" | Method: ${req.method}`);

  // Case A: Existing stream connection matching an active transport session
  if (mcpSessionId && activeTransports.has(mcpSessionId)) {
    const transport = activeTransports.get(mcpSessionId)!;
    
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

  // Case B: Initialization Handshake
  if (!mcpSessionId && isInitializeRequest(bodyPayload)) {
    const newTransport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
      onsessioninitialized: (id) => {
        console.error(`[MCP Server State] Session ${id} initialized successfully.`);
        activeTransports.set(id, newTransport);
      }
    });

    newTransport.onclose = () => {
      // Clean up maps when connection teardowns fire
      for (const [sid, trans] of activeTransports.entries()) {
        if (trans === newTransport) {
          activeTransports.delete(sid);
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

    return await newTransport.handleRequest(standardReq);
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