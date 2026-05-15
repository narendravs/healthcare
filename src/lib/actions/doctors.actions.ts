"use server";

import {
  DATABASE_ID,
  DOCTOR_COLLECTION_ID,
  databases,
  } from "./appwrite.config";
import { parseStringify } from "../utils";
import { ID, Query } from "node-appwrite";

// Fetch Doctors list
export const getDoctors = async () => {
  try {
    const doctors = await databases.listDocuments(
      DATABASE_ID!,
      DOCTOR_COLLECTION_ID!
    );
    return parseStringify(doctors);
  } catch (error: any) {
    console.error("An error occurred while fetching doctors:", error);
  }
};