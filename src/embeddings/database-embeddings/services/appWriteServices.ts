// services/appwriteService.js

import * as dotenv from "dotenv";
dotenv.config();

import { Client, Databases, Query } from "node-appwrite";
import type { Models } from "node-appwrite";

// --- Configuration ---
const APPWRITE_ENDPOINT = process.env.NEXT_PUBLIC_ENDPOINT;
const APPWRITE_PROJECT_ID = process.env.PROJECT_ID;
const APPWRITE_API_KEY = process.env.API_KEY;

// --- Initialize Appwrite Client ---
const appwriteClient = new Client()
  .setEndpoint(APPWRITE_ENDPOINT!)
  .setProject(APPWRITE_PROJECT_ID!)
  .setKey(APPWRITE_API_KEY!);

const databases = new Databases(appwriteClient);

/**
 * Lists all collections within a specified Appwrite database.
 * @param {string} databaseId - The ID of the database.
 * @returns {Promise<Array<Object>>} An array of collection objects.
 */
export const appwriteService = {
  async listAllCollections(databaseId: any): Promise<any[]> {
    try {
      // Appwrite's listCollections can be paginated, fetch all if needed
      let allCollections: any = [];
      let offset = 0;
      const limit = 100; // Max limit per request

      while (true) {
        const respone = await databases.listCollections(databaseId, [
          Query.limit(limit),
          Query.offset(offset),
        ]);
        allCollections = allCollections.concat(respone.collections);
        if (respone.collections.length < limit) {
          break;
        }
        offset += limit;
      }
      // console.log("allCollections.......", allCollections);
      return allCollections;
    } catch (error) {
      console.log(
        `Error listing collections for data base ${databaseId}:`,
        error
      );
      return [];
    }
  },

  /**
   * Lists documents in a specific collection that have been updated since a given timestamp.
   * @param {string} databaseId - The ID of the database.
   * @param {string} collectionId - The ID of the collection.
   * @param {string} lastCheckedTimestamp - ISO 8601 timestamp to check updates against.
   * @returns {Promise<Array<Object>>} An array of updated document objects.
   */
  async listUpdatedDocuments(
    databaseId: any,
    collectionId: any,
    lastCheckedTimestamp: any
  ): Promise<any> {
    try {
      const documents = await databases.listDocuments(
        databaseId,
        collectionId,
        [
          Query.greaterThan("$updatedAt", lastCheckedTimestamp),
          Query.orderAsc("$updatedAt"), // Order by update time for consistent timestamp tracking
          Query.limit(100),
        ]
      );

      return documents;
    } catch (error) {
      console.error(
        `Error listing updated documents for collection ${collectionId}:`,
        error
      );
    }
  },
};
