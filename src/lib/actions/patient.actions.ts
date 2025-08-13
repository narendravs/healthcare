"use server";
import { ID, Query } from "node-appwrite";
import { InputFile } from "node-appwrite/file";
import {
  ENDPOINT,
  BUCKET_ID,
  DATABASE_ID,
  PROJECT_ID,
  PATIENT_COLLECTION_ID,
  databases,
  storage,
  users,
} from "./appwrite.config";
import { parseStringify } from "../utils";
import { RegisterUserParams } from "../../types/index";

type CreateUserParams = {
  email: string;
  phone: string;
  name: string;
};

//CRETAE APPWRITE USER
export const createUser = async (user: CreateUserParams) => {
  try {
    const newuser = await users.create(
      ID.unique(),
      user.email,
      user.phone,
      undefined,
      user.name
    );
    console.log("New user created:", newuser);
    return parseStringify(newuser);
  } catch (error: any) {
    if (error && error.code === 409) {
      const existingUSer = await users.list([Query.equal("email", user.email)]);
      if (existingUSer.total > 0) {
        return parseStringify(existingUSer.users[0]);
      }
      console.error("An error occurred while creating a new user:", error);
    }
  }
};

// GET USER
export const getUser = async (userId: string) => {
  try {
    const user = await users.get(userId);
    return parseStringify(user);
  } catch (error: any) {
    console.error("An error occurred while fetching user:", error);
  }
};

//REGISTER PATIENT
export const registerPatient = async (data: RegisterUserParams) => {
  const { identificationDocument, ...patientData } = data;
  try {
    //Upload file
    let file;
    if (data.identificationDocument) {
      const inputFile =
        data.identificationDocument &&
        InputFile.fromBuffer(
          data.identificationDocument?.get("blobFile") as Blob,
          data.identificationDocument?.get("fileName") as string
        );
      file = await storage.createFile(BUCKET_ID!, ID.unique(), inputFile);
      console.log("File saved successfully");
    }
    // Create new patient document
    const patient = await databases.createDocument(
      DATABASE_ID,
      PATIENT_COLLECTION_ID,
      ID.unique(),
      {
        identificationDocumentId: file ? file.$id : "",
        identificationDocumentUrl: file
          ? `${ENDPOINT}/storage/buckets/${BUCKET_ID}/files/${file.$id}/view?project=${PROJECT_ID}`
          : "",
        ...patientData,
      }
    );
    return parseStringify(patient);
  } catch (error: any) {
    console.error("An error occurred while registering patient:", error);
  }
};

//GET PATIENT
export const getPatient = async (userId: string) => {
  try {
    const patients = await databases.listDocuments(
      DATABASE_ID,
      PATIENT_COLLECTION_ID,
      [Query.equal("userId", userId)]
    );
    return parseStringify(patients.documents[0]);
  } catch (error) {
    console.log(
      "An error occurred while retrieving the patient details:",
      error
    );
  }
};
