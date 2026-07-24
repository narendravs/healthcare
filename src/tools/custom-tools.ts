import { Tool, StructuredTool } from "@langchain/core/tools";
import { getUserByExactName, getPatient } from "@/lib/actions/patient.actions";
import { getDoctors } from "@/lib/actions/doctors.actions";
import { z } from "zod";

export class GetUserByNameTool extends Tool {
  name = "get_user_by_name";
  description =
    "Useful for finding a user's ID by their exact full name. Input should be the user's full name, for example 'John Doe'.";

  async _call(input: string): Promise<string> {
    const user = await getUserByExactName(input);
    if (user) {
      return JSON.stringify({ userId: user.$id, name: user.name });
    }
    return "User not found.";
  }
}

export class GetDoctorsListTool extends Tool {
  name = "get_doctor_list";
  description =
    "Returns a list of all available doctors. Use this to let the user choose a primary physician.";

  async _call(_input: string): Promise<string> {
    const doctor = await getDoctors();
    if (doctor) {
      return JSON.stringify(doctor);
    }
    return "Doctor details not found.";
  }
}

export class GetPatientTool extends Tool {
  name = "get_patient_details";
  description =
    "Useful for fetching a patient's details using their user ID. Input should be the user ID, a string.";

  async _call(input: string): Promise<string> {
    const patient = await getPatient(input);
    if (patient) {
      return JSON.stringify(patient);
    }
    return "Patient details not found.";
  }
}

// Tool to create appointments
import { createAppointment } from "@/lib/actions/appointment.actions";

export class CreateAppointmentTool extends StructuredTool {
  name = "create_appointment";
  
  description = "Creates a new medical appointment record in the database after all details are gathered.";

  // 🔑 Define explicit Zod schema so Groq/Llama knows exact property types
  schema = z.object({
    userId: z.string().describe("The user ID retrieved from get_user_by_name"),
    patient: z.string().describe("The Appwrite document $id of the patient"),
    primaryPhysician: z.string().describe("Full name of the selected doctor"),
    reason: z.string().describe("Reason for the medical visit"),
    schedule: z.string().describe("ISO 8601 formatted date/time string for appointment"),
    status: z.string().default("pending").describe("Status of the appointment, default 'pending'"),
    note: z.string().optional().default("").describe("Optional additional notes"),
  });

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    try {
      
      // Sanitize date input
      const sanitizedSchedule = new Date(input.schedule).toISOString();

      const appointmentData = {
        userId: input.userId,
        patient: input.patient,
        primaryPhysician: input.primaryPhysician,
        reason: input.reason,
        schedule: new Date(sanitizedSchedule),
        status: (input.status || "pending") as "pending" | "scheduled" | "cancelled",
        note: input.note || "",
      };

      const newAppointment = await createAppointment(appointmentData);
      
      if (!newAppointment) {
        return JSON.stringify({ status: "error", message: "Failed to create document in database." });
      }

      return JSON.stringify({
        status: "success",
        message: "Appointment created successfully.",
        action: "redirect",
        payload: "/admin",
      });
    } catch (error) {
      return `Failed to create appointment: ${error}`;
    }
  }
}

export class NavigateToAdminTool extends Tool {
  name = "navigate_to_admin";
  description =
    "Useful for instructing the user to navigate to the admin page after an appointment has been successfully created. This tool does not require any input.";

  async _call(): Promise<string> {
    // The agent doesn't need to do anything here except return a signal.
    // The front-end will listen for this specific output.
    return JSON.stringify({
      action: "navigate",
      payload: "/admin",
    });
  }
}
