import PreviousMap_ from "postcss/lib/previous-map";
import { z } from "zod";

export const UserFormValidation = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters long")
    .max(100, "Name cannot exceed 100 characters"),
  email: z.string().email("Invalid email address"),
  phone: z
    .string()
    .refine((phone) => /^\+\d{10,15}$/.test(phone), "Invalid phone number"),
});

export const PatientFormValidation = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters long")
    .max(100, "Name cannot exceed 100 characters"),
  email: z.string().email("Invalid email address"),
  phone: z
    .string()
    .refine((phone) => /^\+\d{10,15}$/.test(phone), "Invalid phone number"),
  birthDate: z.coerce.date(),
  gender: z.enum(["Male", "Female", "Other"]),
  address: z
    .string()
    .min(5, "Address must be at least 5 characters long")
    .max(200, "Address cannot exceed 200 characters"),
  occupation: z
    .string()
    .min(2, "Occupation must be at least 2 characters long")
    .max(100, "Occupation cannot exceed 100 characters")
    .optional(),
  emergencyContactName: z
    .string()
    .min(2, "Emergency contact name must be at least 2 characters long")
    .max(100, "Emergency contact name cannot exceed 100 characters"),
  emergencyContactNumber: z
    .string()
    .refine(
      (emergencyContactNumber) => /^\+\d{10,15}$/.test(emergencyContactNumber),
      "Invalid phone number"
    ),
  primaryPhysician: z
    .string()
    .min(2, "Primary physician name must be at least 2 characters long")
    .max(100, "Primary physician name cannot exceed 100 characters")
    .optional(),
  insuranceProvider: z
    .string()
    .min(2, "Insurance provider must be at least 2 characters long")
    .max(100, "Insurance provider cannot exceed 100 characters")
    .optional(),
  insurancePolicyNumber: z
    .string()
    .min(5, "Insurance policy number must be at least 5 characters long")
    .max(50, "Insurance policy number cannot exceed 50 characters")
    .optional(),
  allergies: z.string().optional(),
  currentMedication: z.string().optional(),
  familyMedicalHistory: z.string().optional(),
  pastMedicalHistory: z.string().optional(),
  identificationType: z.string().optional(),
  identificationNumber: z.string().optional(),
  identificationDocument: z.custom<File[]>().optional(),
  privacyConsent: z
    .array(z.string())
    .min(1, "You must agree to at least one consent."),
});

export const CreateAppointmentSchema = z.object({
  primaryPhysician: z.string().min(2, "Select at least one docotr"),
  schedule: z.coerce.date(),
  reason: z
    .string()
    .min(2, "Reason must be at least 2 characters long")
    .max(500, "Reason cannot exceed 500 characters"),
  note: z.string().optional(),
  cancellationReason: z.string().optional(),
});
export const CancelAppointmentSchema = z.object({
  primaryPhysician: z.string().min(2, "Select at least one docotr"),
  schedule: z.coerce.date(),
  reason: z.string().optional(),
  note: z.string().optional(),
  cancellationReason: z
    .string()
    .min(5, "Reason must be at least 5 characters long")
    .max(500, "Reason cannot exceed 500 characters"),
});
export const ScheduleAppointmentSchema = z.object({
  primaryPhysician: z.string().optional(),
  schedule: z.coerce.date(),
  reason: z.string().optional(),
  note: z.string().optional(),
  cancellationReason: z.string().optional(),
});

export function getAppointmentSchema(type: string) {
  switch (type) {
    case "create":
      return CreateAppointmentSchema;
    case "schedule":
      return ScheduleAppointmentSchema;
    default:
      return CancelAppointmentSchema;
  }
}
