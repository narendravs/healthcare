"use server";

import {
  DATABASE_ID,
  APPOINTMENT_COLLECTION_ID,
  databases,
  messaging,
} from "./appwrite.config";
import { revalidatePath } from "next/cache";
import { Appointment } from "@/types/appwrite.types";
import { ID, Query } from "node-appwrite";
import { formatDateTime, parseStringify } from "../utils";
import {
  CreateAppointmentParams,
  UpdateAppointmentParams,
} from "../../types/index";

// CREATE APPOINTMENT
export const createAppointment = async (
  appointment: CreateAppointmentParams
) => {
  console.log("Creating appointment:", appointment);
  try {
    const newAppointment = await databases.createDocument(
      DATABASE_ID!,
      APPOINTMENT_COLLECTION_ID!,
      ID.unique(),
      appointment
    );
    revalidatePath("/admin");
    return parseStringify(newAppointment);
  } catch (error) {
    console.error("An error occurred while creating a new appointment:", error);
  }
};

// GET APPOINTMENT
export const getAppointment = async (appointmentId: string) => {
  try {
    const appointment = await databases.getDocument(
      DATABASE_ID!,
      APPOINTMENT_COLLECTION_ID!,
      appointmentId
    );

    return parseStringify(appointment);
  } catch (error) {
    console.error(
      "An error occurred while retrieving the appointment details:",
      error
    );
  }
};

// GET RECENT APPOINTMENTS
export const getRecentAppointmentList = async () => {
  try {
    const appointments = await databases.listDocuments(
      DATABASE_ID!,
      APPOINTMENT_COLLECTION_ID!,
      [Query.orderDesc("$createdAt")]
    );

    const initialCounts = {
      scheduledCount: 0,
      pendingCount: 0,
      cancelledCount: 0,
    };

    const counts = (appointments.documents as Appointment[]).reduce(
      (acc, appointment) => {
        if (appointment.status === "scheduled") {
          acc.scheduledCount += 1;
        } else if (appointment.status === "pending") {
          acc.pendingCount += 1;
        } else if (appointment.status === "cancelled") {
          acc.cancelledCount += 1;
        }

        return acc;
      },
      initialCounts
    );

    const data = {
      totalCount: appointments.total,
      ...counts,
      documents: appointments.documents,
    };

    return parseStringify(data);
  } catch (error) {
    console.error(
      "An error occurred while retrieving the recent appointments:",
      error
    );
  }
};

// UPDATE APPOINTMENT
export const updateAppointment = async ({
  appointmentId,
  userId,
  timeZone,
  appointment,
  type,
}: UpdateAppointmentParams) => {
  try {
    const updatedAppointment = await databases.updateDocument(
      DATABASE_ID!,
      APPOINTMENT_COLLECTION_ID!,
      appointmentId,
      appointment
    );

    if (!updatedAppointment) {
      throw new Error("Appointment not found");
    }

    const smsMessage = `
      Hi, it's CarePulse.
      ${
        type === "schedule"
          ? `Your appointment has been scheduled for ${
              formatDateTime(appointment.schedule!).dateTime
            } with Dr. ${appointment.primaryPhysician}.`
          : `We regret to inform you that your appointment has been cancelled for the following reason: ${appointment.cancellationReason}.`
      }
    `;

    await sendSMSNotification(
      userId as string,
      smsMessage,
      appointment as Appointment
    );
    revalidatePath("/admin");
    return parseStringify(updatedAppointment);
  } catch (error) {
    console.error("An error occurred while updating the appointment:", error);
  }
};

// SEND SMS NOTIFICATION
export const sendSMSNotification = async (
  userId: string,
  content: string,
  appointment: Appointment
) => {
  try {
    const message = await messaging.createSms(
      ID.unique(),
      content,
      [],
      [userId],
      [],
      false
    );

    return parseStringify(message);
  } catch (error) {
    console.error("An error occurred while sending sms:", error);
  }
};
//Cancel oppoitment
export const cancelOppoitment = async (appointmentId: string) => {
  try {
    await databases.deleteDocument(
      DATABASE_ID!,
      APPOINTMENT_COLLECTION_ID!,
      appointmentId
    );
    revalidatePath("/admin");
  } catch (error) {
    console.error("An error occurred while cancelling the appointment:", error);
  }
};
