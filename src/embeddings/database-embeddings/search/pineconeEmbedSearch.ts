// PineconeSearch.js
// This component encapsulates the logic for searching a Pinecone index using embeddings.

// Import necessary libraries.
import { Pinecone } from "@pinecone-database/pinecone";
import { pipeline } from "@xenova/transformers";
import * as dotenv from "dotenv";

// Load environment variables.
dotenv.config();

// Configure your Pinecone index and namespace.
// --- Configuration ---
const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME;
const PINECONE_INDEX_HOST = process.env.PINECONE_INDEX_HOST;
const PINECONE_INDEX_NAME_SPACE = process.env.PINECONE_INDEX_NAME_SPACE;

// Initialize the Pinecone client with the API key from your .env file.
const pinecone = new Pinecone({
  apiKey: PINECONE_API_KEY || "",
});

const namespace = pinecone
  .index(PINECONE_INDEX_NAME!, PINECONE_INDEX_HOST)
  .namespace(PINECONE_INDEX_NAME_SPACE!);

// Initialize the feature-extraction pipeline once globally, as it's expensive to do repeatedly.
let extractor: any;

/**
 * Initializes the Transformers.js model for feature extraction.
 */
async function initializeModel() {
  if (!extractor) {
    extractor = await pipeline("feature-extraction", "Xenova/bge-m3");
    console.log("Model loaded and ready to generate embeddings...");
  }
  return extractor;
}

/**
 * Generates a single text embedding using the local Transformers.js model.
 * @param {string} text - The string to embed.
 * @returns {Promise<number[]>} A promise that resolves to an embedding vector.
 */
export async function getEmbedding(text: string) {
  const initializedExtractor = await initializeModel();
  const output = await initializedExtractor(text, {
    pooling: "mean",
    normalize: true,
  });
  return Array.from(output.data);
}

/**
 * Searches the Pinecone index for records similar to a given query.
 * @param {string} query - The search query text.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of search results.
 */
export async function searchRecords(query: string) {
  try {
    console.log(`Generating embedding for search query: "${query}"`);
    const queryEmbedding = await getEmbedding(query);

    console.log("Searching Pinecone for similar records...");
    const searchResult = await namespace.query({
      vector: queryEmbedding as number[],
      topK: 3, // Get the top 3 most similar results
      includeMetadata: true,
    });

    console.log("Search Results:");
    if (searchResult.matches.length > 0) {
      searchResult.matches.forEach((match) => {
        console.log(`- ID: ${match.id}`);
        console.log(`  Score: ${match.score}`);
        console.log(`  Text: "${match.metadata?.text}"`);
        console.log(`  Category: ${match.metadata?.category}`);
        console.log("---");
      });
    } else {
      console.log("No matches found.");
    }
    return searchResult.matches;
  } catch (err) {
    console.error("An error occurred during the search process:", err);
    return [];
  }
}

// Main execution flow to demonstrate the search function.
//How do apples help with blood sugar?
async function main() {
  const searchQuery =
    "fecth me Appointment details for the patient name narendra and status pending";
  await searchRecords(searchQuery);
}

main();
