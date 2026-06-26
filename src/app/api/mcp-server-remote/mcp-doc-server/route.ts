import { McpServer } from '@modelcontextprotocol/server';
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import pdfParse from 'pdf-parse-fixed'; // 🛡️ Using fixed version to prevent path validation crash
import mammoth from 'mammoth';

// 1. Resolve absolute paths reliably regardless of execution working directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Move up from your script directory directly into Next.js's public/uploads target folder
const DOCUMENTS_DIRECTORY = path.resolve(__dirname, "../../public/uploads");

console.error(`[MCP Config] Target Uploads Directory resolved to: ${DOCUMENTS_DIRECTORY}`);
 
const mcpServer = new McpServer({
  name: "hospital-document-validator",
  version: "1.0.0"
});

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

    const targetFilePath = path.join(DOCUMENTS_DIRECTORY, source_filename);

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
              verifiedText: cleanExtracted // 🟢 Explicitly returning the text to the LLM context
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

// Streamable HTTP requires bridging standard Request loops to server payload processors
export async function POST(req: NextRequest) {
  try {
    const jsonRpcRequest = await req.json();
    
    // Create an ephemeral, stateless execution environment to resolve the query
    let jsonRpcResponse: any = null;

    // Create a mock transport layer bridge to capture the server's response stream
    const mockTransport = {
      start: async () => {},
      close: async () => {},
      send: async (message: any) => {
        jsonRpcResponse = message;
      },
      onmessage: undefined as ((message: any) => void) | undefined,
      onclose: undefined as (() => void) | undefined,
      onerror: undefined as ((error: Error) => void) | undefined,
    };

    // Bind our server to the transport execution framework
    await mcpServer.connect(mockTransport);

    // Push the raw incoming JSON-RPC payload directly into the MCP engine processor
    if (mockTransport.onmessage) {
      await mockTransport.onmessage(jsonRpcRequest);
    }

    return NextResponse.json(jsonRpcResponse || { jsonrpc: "2.0", error: { code: -32603, message: "Internal server error processing tool execution request." }, id: jsonRpcRequest.id }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ jsonrpc: "2.0", error: { code: -32603, message: error.message }, id: null }, { status: 500 });
  }
}

// GET handler returns server discovery schema parameters required by modern clients
export async function GET() {
  return NextResponse.json({
    mcp_version: "2025-11-25",
    capabilities: ["tools"],
  }, { status: 200 });
}