// services/huggingFaceEmbeddingService.js
// This service is refactored to use the local Hugging Face Transformers.js model.

import * as dotenv from "dotenv";
import type { Tensor } from "@xenova/transformers";
//import { pipeline } from "@xenova/transformers";

dotenv.config();

// We initialize the model once and store it here to avoid re-loading it
// on every call.
let extractor: any = null;

/**
 * Initializes the embedding model from Hugging Face Transformers.js.
 * This should be called once when your application starts.
 */

export const huggingFaceEmbedService = {
  async initializeEmbeddingModel() {
    try {
      console.log("Initializing Hugging Face embedding model...");
      // Use a dynamic import for the ES Module
      const { pipeline } = await import("@xenova/transformers");
      // 'feature-extraction' is the task for generating embeddings
      extractor = await pipeline("feature-extraction", "Xenova/bge-m3");
      console.log("Hugging Face embedding model initialized and ready.");
    } catch (error) {
      console.error(
        "Failed to initialize Hugging Face embedding model:",
        error
      );
      throw error;
    }
  },

  /**
   * Generates an embedding for a given text using the initialized model.
   * This function will throw an error if the model has not been initialized.
   * @param {string} text The text to embed.
   * @returns {Promise<number[]>} The embedding vector.
   */
  async getEmbedding(text: string): Promise<number[]> {
    if (!extractor) {
      // Ensure the model has been initialized before use.
      throw new Error(
        "Embedding model not initialized. Call initializeEmbeddingModel() first."
      );
    }
    try {
      // Generate the embedding using the initialized pipeline
      const result: Tensor = await extractor(text, {
        pooling: "mean",
        normalize: true,
      });

      // The result is a Tensor, extract the data as a plain array.
      if (result && result.size && result.data) {
        return Array.from(result.data as Float32Array);
      } else {
        throw new Error("Invalid embedding response from model.");
      }
    } catch (error: any) {
      console.error(
        "Failed to generate embedding with Hugging Face model:",
        error
      );
      throw error;
    }
  },
};
