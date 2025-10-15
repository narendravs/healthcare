import { Pinecone } from "@pinecone-database/pinecone";
import * as dotenv from "dotenv";
dotenv.config();


// --- Configuration and Initialization ---
const PINECONE_API_KEY = process.env.PINECONE_API_KEY || "";
const PINECONE_CLOUD = process.env.PINECONE_CLOUD || "aws";
const PINECONE_REGION = process.env.PINECONE_REGION || "us-east-1";

// Initialize Pinecone client
let pinecone: any;

/**
 * Creates a Pinecone index with a specified name and dimension.
 * @param indexName The name of the index to create.
 * @param dimension The dimension of the vectors to be stored in the index.
 */
const createPineconeIndex = async (indexName: string, dimension: number) => {
  try {
    pinecone = new Pinecone({
      apiKey: PINECONE_API_KEY || "",
    });

    // Check if the index already exists
    const indexList = await pinecone.listIndexes();
    if (indexList.indexes?.some((index: any) => index.name === indexName)) {
      console.log(`Index "${indexName}" already exists.`);
      return;
    }

    // Create the index if it doesn't exist
    console.log(`Creating index "${indexName}" with dimension ${dimension}...`);
    await pinecone.createIndex({
      name: indexName,
      dimension: dimension,
      metric: "cosine",
      spec: {
        serverless: {
          cloud: PINECONE_CLOUD,
          region: PINECONE_REGION,
        },
      },
    });
    console.log(`Index "${indexName}" created successfully.`);
  } catch (error) {
    console.error("Failed to create Pinecone index:", error);
    throw error;
  }
};

// --- Main Execution Block ---

// Replace these with your desired index name and the embedding model's dimension
const myIndexName = "document";
const embeddingDimension = 1024; // The dimension for "Xenova/bge-m3"

// Run the function to create the index
createPineconeIndex(myIndexName, embeddingDimension);
