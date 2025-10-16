import { Pinecone } from "@pinecone-database/pinecone";
import { pipeline } from "@xenova/transformers";
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
const PINECONE_INDEX_NAME = process.env.PINECONE_DOC_INDEX_NAME;
const PINECONE_INDEX_HOST = process.env.PINECONE_DOC_INDEX_HOST;
const PINECONE_INDEX_NAME_SPACE = process.env.PINECONE_DOC_INDEX_NAME_SPACE;

// --- Global Client and Model States ---
let pinecone: any;
/** Global instance of the Transformers.js feature extractor. */
let extractor: any;
/** Flag to indicate if the embedding model is loaded and ready. */
let isModelReady = false;

/**
 * Initializes the Pinecone client using credentials from environment variables.
 * It is called once at the start of the ingestion process.
 */
async function initPinecone() {
  try {
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
 * Loads the Transformers.js model (`Xenova/bge-m3`) for embedding generation.
 * This is an expensive operation and is only performed once.
 */
async function loadModel() {
  try {
    console.log("Loading Transformers.js model..");
    extractor = await pipeline("feature-extraction", "Xenova/bge-m3");
    isModelReady = true;
  } catch (error) {
    console.error("Failed to load Transformers.js model:", error);
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
 * @param {string} filePath - The absolute path to the document.
 * @returns {Promise<string | undefined>} A promise that resolves to the extracted text, or undefined on failure.
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
      case ".pdf":
        {
          const dataBuffer = await fsPromises.readFile(filePath);
          const parsed = await pdfParse(dataBuffer);
          text = parsed.text;
        }

        break;
      case ".doc":
      case ".docx":
        const result = await mammoth.extractRawText({ path: filePath });
        text = result.value;
        break;
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
 * Normalizes text by replacing multiple whitespace characters (including newlines) with a single space.
 * @param {string} text - The input string.
 * @returns {string} The normalized string.
 */
function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Generates a deterministic, unique ID for a vector based on the file name and content.
 * This prevents duplicate vectors from being uploaded if the file content hasn't changed.
 * @param {string} fileName - The name of the source file.
 * @param {string} text - The line/chunk content.
 * @returns {string} A SHA1 hash prefixed with 'doc-'.
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
 * This is used as a fallback when robust paragraph/line splitting is not possible.
 * @param {string} text - The full document text.
 * @param {number} [maxChars=800] - The maximum character length for a chunk.
 * @returns {StructuredChunk[]} An array of fixed-size chunks.
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
        // single long word; force push
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
 * A robust chunking strategy that first splits by double newlines (paragraphs)
 * and then splits each paragraph into individual lines.
 * This is preferred as it preserves semantic context better than fixed-size chunking.
 * Falls back to `fixedSizeChunker` if no paragraph breaks are detected.
 * @param {string} [text] - The raw document text.
 * @returns {StructuredChunk[]} An array of structured chunks.
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
  // Fallback: no paragraph breaks; chunk by size
  return fixedSizeChunker(text);
}

/**
 * Orchestrates the text splitting process.
 * @param {string} [documentText] - The raw text content of the document.
 * @returns {StructuredChunk[]} The resulting structured chunks.
 */
function getChunksFromText(documentText?: string): StructuredChunk[] {
  console.log("Splitting document text into structured chunks...");
  const chunks = robustTextSplitter(documentText);
  console.log(`Document split into ${chunks.length} structured chunks.`);
  return chunks;
}

/**
 * Generates embeddings for an array of text strings using the local Transformers.js model.
 * @param {string[]} chunks - The array of text strings (lines) to embed.
 * @returns {Promise<number[][]>} A promise that resolves to an array of embedding vectors.
 */
async function getEmbeddingsForChunks(chunks: string[]): Promise<number[][]> {
  if (!isModelReady) {
    console.error("Transformers.js model is not loaded. Please wait...");
    throw new Error("Model not ready.");
  }
  console.log(
    `Generating embeddings for a batch of ${chunks.length} chunks...`
  );
  const vectors: number[][] = [];
  for (const text of chunks) {
    const output = await extractor(text, { pooling: "mean", normalize: true });
    const vec = Array.from(output.data) as number[];
    vectors.push(vec);
  }
  return vectors;
}

/**
 * Upserts an array of vectors to the configured Pinecone index and namespace.
 * Includes fallback logic for individual upserts if the batch upsert fails.
 * @param {any[]} vectors - The array of vectors (in Pinecone Upsert format) to upsert.
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
    // Attempt batch upsert (faster)
    await vectorNamespace.upsert(vectors);
    console.log("Upsert batch successful.");
  } catch (error) {
    console.warn(
      "Batch upsert failed, falling back to per-vector upserts...",
      error
    );
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
 * Processes chunks in batches: generates embeddings and upserts them to Pinecone.
 * Handles deduplication within the document before processing.
 * @param {StructuredChunk[]} chunks - The array of structured chunks to process.
 * @param {string} fileName - The source document file name.
 */
async function processAndUpsertChunks(
  chunks: StructuredChunk[],
  fileName: string
) {
  try {
    // Deduplicate by normalized line content to avoid duplicate vectors within a document
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
        console.log(
          `Processing batch from chunk ${chunkIndex} to ${
            chunkIndex + batch.length - 1
          }`
        );
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
      console.log(
        `Processing final batch from chunk ${chunkIndex} to ${
          chunkIndex + batch.length - 1
        }`
      );
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
 * @param {string} filePath - The absolute path to the file.
 * @param {number} [retries=3] - The number of times to retry the check.
 * @param {number} [delay=100] - The delay in milliseconds between retries.
 * @returns {Promise<boolean>} True if the file exists, false otherwise.
 */
async function checkFileExists(
  filePath: string,
  retries = 3,
  delay = 100
): Promise<boolean> {
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
 * 1. Initializes Pinecone and the embedding model.
 * 2. Reads the document from the upload path.
 * 3. Chunks the text.
 * 4. Generates embeddings and upserts to Pinecone in batches.
 * @param {string} fileName - The name of the file to process (expected in the public/uploads directory).
 */
export async function runDocumentProcess(fileName: string) {
  // 1. Initialize services Pinecone and model (this is the expensive part)
  await initPinecone();
  await loadModel();

  const uploadDir = path.join(process.cwd(), "public", "uploads", fileName);

  // Check if the file exists before proceeding.
  if (!(await checkFileExists(uploadDir))) {
    console.error(`Error: File not found at path: ${uploadDir}`);
    return;
  }
  console.log("Upload directory is:", uploadDir);
  try {
    //2. Process the file from the uploaded location
    const documentText = await processDocument(uploadDir);
    if (documentText) {
      // 3. Chunk the text
      const chunks = getChunksFromText(documentText);

      // 4. Generate embeddings and upsert to Pinecone
      await processAndUpsertChunks(chunks, fileName);

      console.log("Full RAG ingestion pipeline completed successfully.");
    } else {
      console.error("Document text extraction failed. Aborting upsert.");
    }
  } catch (error) {
    console.error("Error during main execution:", error);
  }
}
