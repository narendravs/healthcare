import { NextRequest, NextResponse } from "next/server";

// Import necessary libraries.
import { Pinecone } from "@pinecone-database/pinecone";
import { pipeline } from "@xenova/transformers";
import * as dotenv from "dotenv";

// Load environment variables.
dotenv.config();

// Configure your Pinecone index and namespace.
// --- Configuration ---
const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX_NAME = process.env.PINECONE_DOC_INDEX_NAME;
const PINECONE_INDEX_HOST = process.env.PINECONE_DOC_INDEX_HOST;
const PINECONE_INDEX_NAME_SPACE = process.env.PINECONE_DOC_INDEX_NAME_SPACE;

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
export async function getEmbedding(text: string): Promise<number[]> {
  const initializedExtractor = await initializeModel();
  const output = await initializedExtractor(text, {
    pooling: "mean",
    normalize: true,
  });
  return Array.from(output.data);
}

// Extract the "substantive" part of a conversational query (strip known prefix).
const getSubstantiveQuery = (q: string): string => {
  const conversationalPrefix = "get me the paragraph";
  const normalizedQuery = q.trim().toLowerCase();
  if (normalizedQuery.startsWith(conversationalPrefix)) {
    return q.substring(conversationalPrefix.length).trim();
  }
  return q;
};

// Normalize strings for comparison: collapse whitespace, strip punctuation, lowercase.
const normalizeForCompare = (str: string) =>
  str
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9 ]/gi, "")
    .trim()
    .toLowerCase();

/**
 * Searches the Pinecone index for records similar to a given query.
 * @param {string} query - The search query text.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of search results.
 */
export async function searchRecords(query: string): Promise<any[]> {
  try {
    const substantiveQuery = getSubstantiveQuery(query);
    console.log(`Generating embedding for search query: "${substantiveQuery}"`);
    const queryEmbedding = await getEmbedding(substantiveQuery);

    console.log("Searching Pinecone for similar records...");
    const searchResult = await namespace.query({
      vector: queryEmbedding,
      topK: 3, // Get more results to allow for re-ranking
      includeMetadata: true,
    });

    console.log("Search Results:");
    if (searchResult.matches && searchResult.matches.length > 0) {
      // --- Re-ranking Logic ---
      // Find the best match by checking for textual similarity in the 'line' metadata.
      // We prefer a result that contains the query text, even if its vector score is slightly lower.
      const normalizedQueryCore = normalizeForCompare(substantiveQuery);
      const bestMatch =
        searchResult.matches.find((m) => {
          const matchedLine: any = m.metadata?.line || "";
          return normalizeForCompare(matchedLine).includes(normalizedQueryCore);
        }) || searchResult.matches[0]; // Fallback to the top vector search result

      if (bestMatch !== searchResult.matches[0]) {
        console.log(
          `INFO: Re-ranked results. Found a better textual match (ID: ${bestMatch.id}) than the top vector search result (ID: ${searchResult.matches[0].id}).`
        );
      }
      // --- End Re-ranking Logic ---

      // Process only the best match
      const match: any = bestMatch;
      const bigParagraph = match.metadata?.paragraph || "";
      const matchedLine = match.metadata?.line || "";

      // If the normalized query equals the normalized matchedLine, prefer matchedLine as the anchor.
      // Otherwise, fall back to using the query itself.
      const normalizedMatchedLine = normalizeForCompare(matchedLine);
      const anchorText =
        normalizedQueryCore === normalizedMatchedLine
          ? matchedLine
          : substantiveQuery;

      if (anchorText === substantiveQuery) {
        console.log(
          `INFO: Vector search line didn't match the query exactly. Falling back to searching the paragraph using the query text.`
        );
      }

      // This logic extracts the specific paragraph content following the anchor text.
      let paragraphContent = "";

      // Create a regex from the anchor text that is flexible with whitespace and newlines.
      const createFuzzyRegex = (text: string): RegExp => {
        // 1. Escape special regex characters from the input text.
        const escapedText = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        // 2. Replace spaces and newlines with a pattern that matches any whitespace.
        const fuzzyPattern = escapedText.replace(/\s+/g, "\\s+");
        // 3. Create a case-insensitive regex.
        return new RegExp(fuzzyPattern, "i");
      };

      const anchorRegex = createFuzzyRegex(anchorText);
      const matchResult = bigParagraph.match(anchorRegex);

      if (matchResult && matchResult.index !== undefined) {
        const matchedAnchorInParagraph = matchResult[0];
        const startIndex = matchResult.index;

        // Start searching from the end of the matched anchor text.
        const textAfterLine = bigParagraph.substring(
          startIndex + matchedAnchorInParagraph.length
        );

        // Find the next heading (e.g., "45.8", "1.2.3") to determine where this section ends.
        const nextHeadingRegex = /\r?\n\d+(?:\.\d+)*\s+/;
        const nextHeadingMatch = textAfterLine.match(nextHeadingRegex);

        if (nextHeadingMatch && nextHeadingMatch.index !== undefined) {
          // If a next heading is found, extract the text in between.
          paragraphContent = textAfterLine
            .substring(0, nextHeadingMatch.index)
            .trim();
        } else {
          // If no next heading is found, it's the last section, so take all remaining text.
          paragraphContent = textAfterLine.trim();
        }
      } else {
        console.log(
          `WARN: Could not find the anchor text "${anchorText}" in the paragraph. The vector search result might be a semantic match without exact keywords. Displaying full paragraph block.`
        );
        paragraphContent = bigParagraph;
      }

      // Combine the heading and its extracted content for a clean, readable output.
      const fullRelevantText = `${matchedLine}\n${paragraphContent}`;

      // console.log(`- ID: ${match.id}`);
      // console.log(`  Score: ${match.score}`);
      // console.log(`Line is: ${match.metadata?.line}`);
      // console.log(`Paragraph is: ${match.metadata?.paragraph}`);
      console.log(`  Relevant Content:\n${fullRelevantText}`);
      console.log("---");

     // Return a processed object with a dedicated property for the relevant content.
      return [{ relevantContent: fullRelevantText }];
    }

    console.log("No matches found.");
    return [];
  } catch (err) {
    console.error("An error occurred during the search process:", err);
    return [];
  }
}

// Main execution flow to demonstrate the search function.
//How do apples help with blood sugar?
export async function POST(req: NextRequest) {
  if (req.method != "POST") {
    return NextResponse.json(
      { message: "Method not Allowed" },
      { status: 405 }
    );
  }
  try {
    const { query } = await req.json();

    const results = await searchRecords(query);
    console.log("Pinecone Search Results Are:", results);
    return NextResponse.json(
      {
        message: "Embedding Search Successful",
        results: results || [],
      },
      { status: 200 }
    );
  } catch (error) {
    console.log("Error In Embedding Search", error);
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
