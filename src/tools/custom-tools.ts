import { Tool } from "@langchain/core/tools";
import { getUserByExactName, getPatient } from "@/lib/actions/patient.actions";

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

export class CreateAppointmentTool extends Tool {
  name = "create_appointment";
  description = `
    Used to create a new appointment record. The input must be a single JSON string with the following required keys:
    - 'userId' (string): The ID of the user.
    - 'patient' (string): The document ID of the patient record.
    - 'primaryPhysician' (string): The doctor's name.
    - 'reason' (string): The reason for the visit.
    - 'schedule' (string): The date and time of the appointment in ISO 8601 format.
    - 'status' (string): The appointment status (e.g., 'pending', 'scheduled', 'cancelled').
    - 'note' (string, optional): Any additional notes for the appointment.
    `;

  async _call(input: string): Promise<string> {
    try {
      const appointmentData = JSON.parse(input);
      const newAppointment = await createAppointment(appointmentData);
      // return JSON.stringify(newAppointment);
      // Return a simple, machine-readable success message
      //return JSON.stringify({ success: true, message: "Appointment created." });
      // Return a structured JSON object that includes the navigation signal
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
