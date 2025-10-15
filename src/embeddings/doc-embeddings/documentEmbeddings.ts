//import { Pinecone } from "@pinecone-database/pinecone";
import { pipeline } from "@xenova/transformers";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";
import * as mammoth from "mammoth";
import { promises as fsPromises } from "fs";
import pdfParse from "pdf-parse-fixed";

dotenv.config();

const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX_NAME = process.env.PINECONE_DOC_INDEX_NAME;
const PINECONE_INDEX_HOST = process.env.PINECONE_DOC_INDEX_HOST;
const PINECONE_INDEX_NAME_SPACE = process.env.PINECONE_DOC_INDEX_NAME_SPACE;

//Initialize Pinecone
let pinecone: any;
async function initPinecone() {
  try {
    // pinecone = new Pinecone({
    //   apiKey: PINECONE_API_KEY || "",
    // });
    console.log("Pinecone client initialized successfully");
  } catch (error) {
    console.error("Failed to initialize Pinecone client", error);
    throw error;
  }
}

let extractor: any;
let isModelReady = false;
//Load the Xenova/all-MiniLM-L6-v2 model
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
 * Interface to define the structured chunk data.
 */
interface StructuredChunk {
  paragraph: string;
  line: string;
  paragraphIndex: number;
  lineIndex: number;
}

// Dynamic loader for pdf-parse compatible with both CJS and ESM
async function loadPdfParse(): Promise<any> {
  const mod: any = await import("pdf-parse");
  return typeof mod === "function" ? mod : mod?.default ?? mod;
}

// async function loadBuffer(file: File): Promise<any> {
//   const buffer = await Buffer.from(file.arrayBuffer as Buffer);
//   return buffer;
// }
async function uploadFile(
  sourcePath: File,
  destinationDir: string
): Promise<string> {
  if (!fs.existsSync(destinationDir)) {
    fs.mkdirSync(destinationDir, { recursive: true });
  }
  //const fileName = path.basename(sourcePath);
  const fileName = sourcePath.name;
  const destinationPath = path.join(destinationDir, fileName);
  const bytes = await sourcePath.arrayBuffer();
  const buffer = Buffer.from(bytes);
  fs.writeFileSync(destinationPath, buffer);
  console.log(`File uploaded successfully to: ${destinationPath}`);
  return destinationPath;
}

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
          // const dataBuffer = fs.readFileSync(filePath);
          // const pdfParse: any = await loadPdfParse();
          // const parsed = await pdfParse(dataBuffer);
          // text = parsed.text;
          // const dataBuffer = await fsPromises.readFile(filePath);
          // const PDFExtract = (await import("pdf.js-extract")).PDFExtract;
          // const pdfExtract = new PDFExtract();
          // const options = {};
          // const result = await new Promise((resolve, reject) => {
          //   pdfExtract.extractBuffer(
          //     dataBuffer,
          //     options,
          //     (err: any, data: any) => {
          //       if (err) {
          //         return reject(err);
          //       }
          //       resolve(data);
          //     }
          //   );
          // });

          // // Join all text content from the parsed PDF
          // text = (result as any).pages
          //   .map((page: any) => page.content.map((c: any) => c.str).join(" "))
          //   .join("\n");
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

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function makeDeterministicId(fileName: string, text: string): string {
  const norm = normalizeText(text);
  const hash = crypto
    .createHash("sha1")
    .update(`${fileName}|${norm}`)
    .digest("hex");
  return `doc-${hash}`;
}

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

function getChunksFromText(documentText?: string): StructuredChunk[] {
  console.log("Splitting document text into structured chunks...");
  const chunks = robustTextSplitter(documentText);
  console.log(`Document split into ${chunks.length} structured chunks.`);
  return chunks;
}

const BATCH_SIZE = 5;

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
 * Upserts an array of vectors to a Pinecone index.
 * @param vectors The array of vectors to upsert.
 */
async function upsertVectorsToPinecone(vectors: any[]) {
  const ns = pinecone
    .Index(PINECONE_INDEX_NAME!, PINECONE_INDEX_HOST!)
    .namespace(PINECONE_INDEX_NAME_SPACE!);

  console.log(`Upserting ${vectors.length} vectors to Pinecone...`);
  try {
    // Newer Pinecone client accepts an array of records directly
    await ns.upsert(vectors);
    console.log("Upsert batch successful.");
  } catch (error) {
    console.warn(
      "Batch upsert failed, falling back to per-vector upserts...",
      error
    );
    for (const v of vectors) {
      try {
        await ns.upsert([v]);
      } catch (err) {
        console.error(`Failed to upsert vector id=${v?.id}`, err);
      }
    }
  }
}

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
 * @param filePath The absolute path to the file.
 * @param retries The number of times to retry the check.
 * @param delay The delay in milliseconds between retries.
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

export async function runDocumentProcess(fileName: string) {
  //Initialize services Pinecone and model
  await initPinecone();
  await loadModel();
  // const documentPath =
  //   "H://Fullstack%20Apps//react//hospitalmgmt//public//uploads//Medical_Records.pdf";
  console.log("Document path is:", fileName);
  const uploadDir = path.join(process.cwd(), "public", "uploads", fileName);

  // Check if the file exists before proceeding.
  if (!(await checkFileExists(uploadDir))) {
    console.error(`Error: File not found at path: ${uploadDir}`);
    return;
  }
  console.log("Upload directory is:", uploadDir);
  try {
    //Process the file from the uploaded location
    const documentText = await processDocument(uploadDir);
    console.log("documentTExt is...", documentText);
  } catch (error) {
    console.error("Error during main execution:", error);
  }
}

// Replace this with the actual path to your document that needs to be "uploaded".
// const sourceDocumentPath =
//   "H:\\Fullstack Apps\\react\\hospitalmgmt\\public\\documents\\Medical_Records.pdf";

// runDocumentProcess(sourceDocumentPath);
