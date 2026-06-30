import { Pinecone } from "@pinecone-database/pinecone";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";
import * as mammoth from "mammoth";
import { promises as fsPromises } from "fs";
import pdfParse from "pdf-parse-fixed";

// Load environment variables from a .env file
dotenv.config();

// --- Configuration ---
const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX_NAME = process.env.PINECONE_CLOUD_DOC_INDEX_NAME;
const PINECONE_INDEX_HOST = process.env.PINECONE_CLOUD_DOC_INDEX_HOST;
const PINECONE_INDEX_NAME_SPACE = process.env.PINECONE_CLOUD_DOC_INDEX_NAME_SPACE;
const SILICON_API_KEY = process.env.CLOUD_SILICON_EMBEDDING_API_KEY;

// --- Global Client States ---
let pinecone: any;

/**
 * Initializes the Pinecone client using credentials from environment variables.
 * It is called once at the start of the ingestion process.
 */
async function initPinecone() {
  try {
    if (!PINECONE_API_KEY) {
      throw new Error("CRITICAL: PINECONE_API_KEY is missing from environment variables.");
    }
    pinecone = new Pinecone({
      apiKey: PINECONE_API_KEY || "",
    });
    console.log("Pinecone client initialized successfully");
  } catch (error) {
    console.error("Failed to initialize Pinecone client", error);
    throw error;
  }
}

/**
 * Interface to define the structured chunk data, including its context.
 */
interface StructuredChunk {
  paragraph: string;
  line: string;
  paragraphIndex: number;
  lineIndex: number;
}

/**
 * Reads and extracts raw text content from various document types.
 * Supports .txt, .pdf, .doc, and .docx files.
 */
async function processDocument(filePath: string): Promise<string | undefined> {
  try {
    console.log(`Reading raw text from: ${filePath}`);
    const ext = path.extname(filePath).toLowerCase();
    let text;
    switch (ext) {
      case ".txt":
        text = fs.readFileSync(filePath, "utf-8");
        break;
      case ".pdf": {
        const dataBuffer = await fsPromises.readFile(filePath);
        const parsed = await pdfParse(dataBuffer);
        text = parsed.text;
        break;
      }
      case ".doc":
      case ".docx": {
        const result = await mammoth.extractRawText({ path: filePath });
        text = result.value;
        break;
      }
      default:
        throw new Error(`Unsupported file type: ${ext}`);
    }
    console.log("Raw text extracted successfully.");
    return text;
  } catch (error) {
    console.error("Error during document processing:", error);
    return undefined;
  }
}

/**
 * Normalizes text by replacing multiple whitespace characters with a single space.
 */
function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Generates a deterministic, unique ID for a vector based on the file name and content.
 */
function makeDeterministicId(fileName: string, text: string): string {
  const norm = normalizeText(text);
  const hash = crypto
    .createHash("sha1")
    .update(`${fileName}|${norm}`)
    .digest("hex");
  return `doc-${hash}`;
}

/**
 * A basic chunking strategy that splits text into fixed-size chunks (by character count).
 */
function fixedSizeChunker(text: string, maxChars = 800): StructuredChunk[] {
  const chunks: StructuredChunk[] = [];
  const words = normalizeText(text).split(" ");
  let buffer: string[] = [];
  let lineIndex = 0;
  for (const w of words) {
    const candidate = buffer.length ? buffer.join(" ") + " " + w : w;
    if (candidate.length > maxChars) {
      if (buffer.length) {
        const chunk = buffer.join(" ");
        chunks.push({
          paragraph: chunk,
          line: chunk,
          paragraphIndex: 0,
          lineIndex: lineIndex++,
        });
        buffer = [w];
      } else {
        chunks.push({
          paragraph: w,
          line: w,
          paragraphIndex: 0,
          lineIndex: lineIndex++,
        });
        buffer = [];
      }
    } else {
      buffer.push(w);
    }
  }
  if (buffer.length) {
    const chunk = buffer.join(" ");
    chunks.push({
      paragraph: chunk,
      line: chunk,
      paragraphIndex: 0,
      lineIndex: lineIndex++,
    });
  }
  return chunks;
}

/**
 * A robust chunking strategy that splits by double newlines and then individual lines.
 */
function robustTextSplitter(text?: string): StructuredChunk[] {
  if (!text) return [];
  const chunks: StructuredChunk[] = [];
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  if (paragraphs.length > 1) {
    paragraphs.forEach((paragraph, paraIndex) => {
      const lines = paragraph
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
      lines.forEach((line, lineIndex) => {
        chunks.push({
          paragraph: paragraph.trim(),
          line,
          paragraphIndex: paraIndex,
          lineIndex,
        });
      });
    });
    return chunks;
  }
  return fixedSizeChunker(text);
}

/**
 * Orchestrates the text splitting process.
 */
function getChunksFromText(documentText?: string): StructuredChunk[] {
  console.log("Splitting document text into structured chunks...");
  const chunks = robustTextSplitter(documentText);
  console.log(`Document split into ${chunks.length} structured chunks.`);
  return chunks;
}

/**
 * Generates embeddings for an array of text strings using the SiliconFlow API.
 * Optimized to send all batch chunks in a single bulk API request.
 * @param {string[]} chunks - The array of text strings (lines) to embed.
 * @returns {Promise<number[][]>} A promise resolving to an array of embedding vectors.
 */
async function getEmbeddingsForChunks(chunks: string[]): Promise<number[][]> {
  try {
    if (!SILICON_API_KEY) {
      throw new Error("CRITICAL: CLOUD_SILICON_EMBEDDING_API_KEY is missing from environment variables.");
    }

    console.log(`Generating cloud embeddings via SiliconFlow for a batch of ${chunks.length} chunks...`);

    const response = await fetch("https://api.siliconflow.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SILICON_API_KEY.trim()}`,
      },
      body: JSON.stringify({
        model: "Qwen/Qwen3-Embedding-0.6B",
        input: chunks, // Bulk array assignment
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`API error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    
    // Extract multi-vector array mappings ordered sequentially matching input structure
    return data.data.map((item: any) => item.embedding);
  } catch (error) {
    console.error("Error in Cloud Embedding generation:", error);
    throw error;
  }
}

/**
 * Upserts an array of vectors to the configured Pinecone index and namespace.
 */
async function upsertVectorsToPinecone(vectors: any[]) {
  if (!pinecone) {
    console.error("Pinecone client not initialized.");
    return;
  }
  const vectorNamespace = pinecone
    .Index(PINECONE_INDEX_NAME!, PINECONE_INDEX_HOST!)
    .namespace(PINECONE_INDEX_NAME_SPACE!);

  console.log(`Upserting ${vectors.length} vectors to Pinecone...`);
  try {
    await vectorNamespace.upsert(vectors);
    console.log("Upsert batch successful.");
  } catch (error) {
    console.warn("Batch upsert failed, falling back to per-vector upserts...", error);
    for (const vector of vectors) {
      try {
        await vectorNamespace.upsert([vector]);
      } catch (err) {
        console.error(`Failed to upsert vector id=${vector?.id}`, err);
      }
    }
  }
}

/** The number of chunks to process and upsert in a single batch. */
const BATCH_SIZE = 5;

/**
 * Processes chunks in batches: generates cloud embeddings and upserts them to Pinecone.
 */
async function processAndUpsertChunks(chunks: StructuredChunk[], fileName: string) {
  try {
    const seen = new Set<string>();
    const uniqueChunks = chunks.filter((c) => {
      const key = normalizeText(c.line);
      if (!key) return false;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    let batch: StructuredChunk[] = [];
    let chunkIndex = 0;
    
    for (const chunk of uniqueChunks) {
      batch.push(chunk);
      if (batch.length >= BATCH_SIZE) {
        console.log(`Processing batch from chunk ${chunkIndex} to ${chunkIndex + batch.length - 1}`);
        
        const linesToEmbed = batch.map((c) => c.line);
        const embeddings = await getEmbeddingsForChunks(linesToEmbed);
        const count = Math.min(embeddings.length, batch.length);
        
        const vectors = Array.from({ length: count }, (_, i) => {
          const originalChunk = batch[i];
          return {
            id: makeDeterministicId(fileName, originalChunk.line),
            values: embeddings[i],
            metadata: {
              paragraph: originalChunk.paragraph,
              line: originalChunk.line,
              source: fileName,
              paragraph_index: originalChunk.paragraphIndex,
              line_index: originalChunk.lineIndex,
            },
          };
        });

        await upsertVectorsToPinecone(vectors);
        chunkIndex += batch.length;
        batch = [];
      }
    }

    // Process remaining final batch
    if (batch.length > 0) {
      console.log(`Processing final batch from chunk ${chunkIndex} to ${chunkIndex + batch.length - 1}`);
      const linesToEmbed = batch.map((c) => c.line);
      const embeddings = await getEmbeddingsForChunks(linesToEmbed);
      const count = Math.min(embeddings.length, batch.length);
      
      const vectors = Array.from({ length: count }, (_, j) => {
        const originalChunk = batch[j];
        return {
          id: makeDeterministicId(fileName, originalChunk.line),
          values: embeddings[j],
          metadata: {
            paragraph: originalChunk.paragraph,
            line: originalChunk.line,
            source: fileName,
            paragraph_index: originalChunk.paragraphIndex,
            line_index: originalChunk.lineIndex,
          },
        };
      });
      
      await upsertVectorsToPinecone(vectors);
    }
    console.log("Document processing and upload completed.");
  } catch (error) {
    console.error("Error during chunk processing and upload:", error);
  }
}

/**
 * Checks if a file exists at the given path with a retry mechanism.
 */
async function checkFileExists(filePath: string, retries = 3, delay = 100): Promise<boolean> {
  for (let i = 0; i < retries; i++) {
    try {
      await fsPromises.access(filePath);
      console.log(`File successfully accessed after ${i + 1} attempt(s).`);
      return true;
    } catch (error: any) {
      if (i < retries - 1) {
        console.warn(`File not found, retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        console.error(`File check failed for path: ${filePath}`);
        console.error(`Reason: ${error.message}`);
        return false;
      }
    }
  }
  return false;
}

/**
 * Main function to execute the full document ingestion pipeline.
 */
export async function runDocumentProcess(fileName: string) {
  // Initialize Pinecone connection (Model loading skipped for cloud setup)
  await initPinecone();

  const uploadDir = path.join(process.cwd(), "public", "uploads", fileName);

  if (!(await checkFileExists(uploadDir))) {
    console.error(`Error: File not found at path: ${uploadDir}`);
    return;
  }
  console.log("Upload directory is:", uploadDir);
  try {
    const documentText = await processDocument(uploadDir);
    if (documentText) {
      const chunks = getChunksFromText(documentText);
      await processAndUpsertChunks(chunks, fileName);
      console.log("Full RAG ingestion pipeline completed successfully via Cloud Embeddings.");
    } else {
      console.error("Document text extraction failed. Aborting upsert.");
    }
  } catch (error) {
    console.error("Error during main execution:", error);
  }
}

runDocumentProcess("Medical_Records.pdf")