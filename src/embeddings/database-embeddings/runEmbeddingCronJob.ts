// index.js

import { appwriteService } from "../database-embeddings/services/appWriteServices";
import { pineconeService } from "../database-embeddings/services/pineconeService";
import { readTimestamp, writeTimestamp } from "./utils/timestampManager";
import { huggingFaceEmbedService } from "../database-embeddings/services/huggingFaceEmbedService";

import * as dotenv from "dotenv";
dotenv.config(); // Load environment variables

// --- Configuration from .env ---
const APPWRITE_DATABASE_ID = process.env.DATABASE_ID;
const LAST_CHECKED_TIMESTAMP_FILE =
  process.env.LAST_CHECKED_TIMESTAMP_FILE || "last_checked_timestamp.txt";
const PATIENT_COLLECTION_ID = process.env.PATIENT_COLLECTION_ID;
const DOCTOR_COLLECTION_ID = process.env.DOCTOR_COLLECTION_ID;
const APPOINTMENT_COLLECTION_ID = process.env.APPOINTMENT_COLLECTION_ID;

/**
 * Main function to run the embedding cron job.
 * It fetches all collections, processes updated documents in each,
 * generates embeddings, and updates the Pinecone vector store.
 */

export async function runEmbeddingCronJob() {
  console.log("Starting embedding cron job...");

  try {
    // Initialize Pinecone connection once
    await pineconeService.initializePinecone();
    // Initialize Hugging face embed connection once
    await huggingFaceEmbedService.initializeEmbeddingModel();

    // Read the last checked timestamp for the entire database
    let lastCheckedTimestamp = await readTimestamp(LAST_CHECKED_TIMESTAMP_FILE);
    console.log(`Last processed timestamp: ${lastCheckedTimestamp}`);

    // 1. Get all collections in the specified Appwrite database
    let collections: any = [];
    try {
      const collection = await appwriteService.listAllCollections(
        APPWRITE_DATABASE_ID
      );
      collections = collection;
    } catch (error) {
      console.error("Error fetching collections:", error);
    }
    if (!collections || collections.length === 0) {
      console.log("No collections found in the specified database. Exiting.");
      return;
    }
    console.log(`Found ${collections.length} collections to process.`);

    let latestTimestampAcrossCollections = lastCheckedTimestamp;

    for (const collection of collections) {
      console.log(
        `--- Processing collection: ${collection.name} (ID: ${collection.$id}) ---`
      );

      // 2. Fetch updated documents from the current collection
      // We use the global lastCheckedTimestamp for simplicity,
      // but for more granular control, you could store a timestamp per collection.
      const updatedDocuments = await appwriteService.listUpdatedDocuments(
        APPWRITE_DATABASE_ID,
        collection?.$id,
        lastCheckedTimestamp
      );

      // console.log("updatedDocuments.......", updatedDocuments?.total);
      if (updatedDocuments?.total === 0) {
        console.log(
          `No new or updated documents in collection ${collection.name}.`
        );
        continue;
      }

      console.log(
        `Found ${updatedDocuments?.total} updated documents in collection ${collection.name}.`
      );

      // console.log("updatedDocuments?.documents", updatedDocuments?.documents);
      for (const doc of updatedDocuments?.documents ?? []) {
        const documentId = doc.$id;
        const documentUpdatedAt = doc.$updatedAt;

        // Update the latest timestamp seen across all documents
        if (documentUpdatedAt > latestTimestampAcrossCollections) {
          latestTimestampAcrossCollections = documentUpdatedAt;
        }

        // --- MODIFICATION START ---
        // Construct the content string from relevant fields based on collection ID
        let documentContent = "";

        if (collection.$id === APPOINTMENT_COLLECTION_ID) {
          documentContent = `
                        Appointment Details:
                        Schedule: ${doc.schedule}
                        Status: ${doc.status}
                        Primary Physician: ${doc.primaryPhysician}
                        Reason: ${doc.reason}
                        Note: ${doc.note}
                        Cancellation Reason: ${doc.cancellationReason}
                    `;
          // Add patient details if available and relevant
          if (doc.patient) {
            documentContent += `
                            Patient Details:
                            Name: ${doc.patient.name}
                            Email: ${doc.patient.email}
                            Birth Date: ${doc.patient.birthDate}
                            Gender: ${doc.patient.gender}
                            Address: ${doc.patient.address}
                            Occupation: ${doc.patient.occupation}
                            Primary Physician (Patient): ${doc.patient.primaryPhysician}
                            Insurance Provider: ${doc.patient.insuranceProvider}
                            Allergies: ${doc.patient.allergies}
                            Current Medication: ${doc.patient.currentMedication}
                            Family Medical History: ${doc.patient.familyMedicalHistory}
                            Past Medical History: ${doc.patient.pastMedicalHistory}
                            Emergency Contact Name: ${doc.patient.emergencyContactName}
                            Emergency Contact Number: ${doc.patient.emergencyContactNumber}
                            Phone: ${doc.patient.phone}
                            Insurance Policy Number: ${doc.patient.insurancePolicyNumber}
                            Identification Type: ${doc.patient.identificationType}
                            Identification Number: ${doc.patient.identificationNumber}
                        `;
          }
        } else if (collection.$id === PATIENT_COLLECTION_ID) {
          documentContent = `
                        Patient Profile:
                        Name: ${doc.name}
                        Email: ${doc.email}
                        Birth Date: ${doc.birthDate}
                        Gender: ${doc.gender}
                        Address: ${doc.address}
                        Occupation: ${doc.occupation}
                        Primary Physician: ${doc.primaryPhysician}
                        Insurance Provider: ${doc.insuranceProvider}
                        Allergies: ${doc.allergies}
                        Current Medication: ${doc.currentMedication}
                        Family Medical History: ${doc.familyMedicalHistory}
                        Past Medical History: ${doc.pastMedicalHistory}
                        Emergency Contact Name: ${doc.emergencyContactName}
                        Emergency Contact Number: ${doc.emergencyContactNumber}
                        Phone: ${doc.phone}
                        Insurance Policy Number: ${doc.insurancePolicyNumber}
                        Identification Type: ${doc.identificationType}
                        Identification Number: ${doc.identificationNumber}
                    `;
        } else if (collection.$id === DOCTOR_COLLECTION_ID) {
          documentContent = `
                        Doctor Profile:
                        Name: ${doc.name}
                        Image: ${doc.image}                        
                        `;
        }

        if (!documentContent || typeof documentContent !== "string") {
          console.warn(
            `Document ${documentId} in collection ${collection.name} has no valid 'content' field. Skipping.`
          );
          continue;
        }

        try {
          const embedding = await huggingFaceEmbedService.getEmbedding(
            documentContent
          );
          const pineconeRecord = {
            id: `${documentId}`,
            values: embedding,
            metadata: {
              category: collection.name,
              text: documentContent,
            },
          };
          await pineconeService.upsertEmbeddings(pineconeRecord);
        } catch (embedError) {
          console.error(
            `Failed to embed for document ${documentId} in collection ${collection.name}:`,
            embedError
          );
        }
      }
    }

    await writeTimestamp(
      LAST_CHECKED_TIMESTAMP_FILE,
      latestTimestampAcrossCollections
    );
  } catch (error) {
    console.error("An error occurred during the cron job:", error);
  } finally {
    console.log("Embedding cron job finished.");
  }
}

// Execute the cron job
runEmbeddingCronJob();
