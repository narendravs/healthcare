import { NextRequest, NextResponse } from "next/server";
import { Pinecone } from "@pinecone-database/pinecone";
import { pipeline } from "@xenova/transformers";
import * as dotenv from "dotenv";
dotenv.config();

function getPineConeService() {
  // --- Configuration Pinecone---
  const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
  // Initialize the Pinecone client with the API key from your .env file.
  const pinecone = new Pinecone({
    apiKey: PINECONE_API_KEY || "",
  });
  // let PINECONE_INDEX_NAME;
  // let PINECONE_INDEX_HOST;
  // let PINECONE_INDEX_NAME_SPACE;
  // if (type === "documents") {
  //   PINECONE_INDEX_NAME = process.env.PINECONE_DOC_INDEX_NAME;
  //   PINECONE_INDEX_HOST = process.env.PINECONE_DOC_INDEX_HOST;
  //   PINECONE_INDEX_NAME_SPACE = process.env.PINECONE_DOC_INDEX_NAME_SPACE;
  // } else if (type === "database") {
  //   PINECONE_INDEX_NAME = process.env.PINECONE_DB_INDEX_NAME;
  //   PINECONE_INDEX_HOST = process.env.PINECONE_DB_INDEX_HOST;
  //   PINECONE_INDEX_NAME_SPACE = process.env.PINECONE_DB_INDEX_NAME_SPACE;
  // }
  const PINECONE_INDEX_NAME = process.env.PINECONE_DB_INDEX_NAME;
  const PINECONE_INDEX_HOST = process.env.PINECONE_DB_INDEX_HOST;
  const PINECONE_INDEX_NAME_SPACE = process.env.PINECONE_DB_INDEX_NAME_SPACE;
  const namespace = pinecone
    .index(PINECONE_INDEX_NAME!, PINECONE_INDEX_HOST)
    .namespace(PINECONE_INDEX_NAME_SPACE!);
  console.log("Initialized Pinecone Namespace Successfully");
  return namespace;
}

async function getEmbeddingForQuery(query: any) {
  try {
    const extractor = await pipeline("feature-extraction", "Xenova/bge-m3");
    const output = await extractor(query, {
      pooling: "mean",
      normalize: true,
    });
    console.log("Embedding Created Successfully");
    return Array.from(output.data);
  } catch (error) {
    console.log("Error in Embedding for query", error);
  }
}
async function getPineconeSearch(query: any, namespace: any) {
  try {
    const embedding = await getEmbeddingForQuery(query);
    console.log("Searching the results in Pinecone");
    const searchResult = await namespace.query({
      vector: embedding as number[],
      topK: 1, // Get the top 3 most similar results
      includeMetadata: true,
    });
    return searchResult;
  } catch (error) {
    console.log("Error in PineconeSearch", error);
  }
}
export async function POST(req: NextRequest, res: NextResponse) {
  if (req.method != "POST") {
    return NextResponse.json(
      { message: "Method not Allowed" },
      { status: 405 }
    );
  }
  try {
    const { query } = await req.json();
    const pineconeService = getPineConeService();
    const results = await getPineconeSearch(query, pineconeService);
    console.log("Pinecone Search Results Are:", results);
    return NextResponse.json(
      {
        message: "Embedding Search Successful",
        results: results?.matches || [],
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
