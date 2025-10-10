// services/pineconeService.js
import { Pinecone } from "@pinecone-database/pinecone";
import * as dotenv from "dotenv";
dotenv.config();

// --- Configuration ---
const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX_NAME = process.env.PINECONE_DB_INDEX_NAME;
const PINECONE_INDEX_HOST = process.env.PINECONE_DB_INDEX_HOST;
const PINECONE_INDEX_NAME_SPACE = process.env.PINECONE_DB_INDEX_NAME_SPACE;

// let pinecone;
// let pineconeIndex: any;

const pinecone = new Pinecone({
  apiKey: PINECONE_API_KEY || "",
});
const pineconeIndex = pinecone
  .Index(PINECONE_INDEX_NAME!, PINECONE_INDEX_HOST!)
  .namespace(PINECONE_INDEX_NAME_SPACE!);
/**
 * Initializes the Pinecone client and connects to the specified index.
 * This should be called once at the start of your application.
 */
export const pineconeService = {
  initializePinecone() {
    if (pineconeIndex) {
      console.log("Pinecone already initialized.");
      return;
    }
    try {
      const pineconeInit = new Pinecone({
        apiKey: PINECONE_API_KEY || "",
      });
      const pineconeIndex = pineconeInit
        .Index(PINECONE_INDEX_NAME!, PINECONE_INDEX_HOST!)
        .namespace(PINECONE_INDEX_NAME_SPACE!);
      console.log(
        `Successfully connected to Pinecone index: ${PINECONE_INDEX_NAME}`
      );
      return pineconeIndex;
    } catch (error) {
      console.error("Error initializing Pinecone:", error);
      throw error; // Propagate error to stop the cron job if Pinecone is unreachable
    }
  },

  /**
   * Upserts embeddings into Pinecone.
   * @param {Array<Object>} vectors - An array of vector objects to upsert.
   * Each object should have 'id', 'values', and optional 'metadata'.
   * @param {string} namespace - The Pinecone namespace to upsert into.
   * @returns {Promise<void>}
   */
  async upsertEmbeddings(vectors: any) {
    if (!pineconeIndex) {
      throw new Error(
        "Pinecone index not initialized. Call initializePinecone() first."
      );
    }
    if (vectors.length === 0) {
      console.log("No vectors to upsert to Pinecone.");
      return;
    }

    try {
      await pineconeIndex.upsert([vectors]);
      console.log(
        `Successfully upserted ${vectors} vectors to Pinecone namespace: ${PINECONE_INDEX_NAME_SPACE}`
      );
    } catch (error) {
      console.error("Error upserting embeddings to Pinecone:", error);
      throw error;
    }
  },
};
