import { Appointment } from "appwrite.types";

export declare type Gender = "Male" | "Female" | "Other";
export declare type Status = "pending" | "scheduled" | "cancelled";

declare type SearchParamProps = {
  params: { [key: string]: string };
  searchParams: { [key: string]: string | string[] | undefined };
};
declare interface CreateUserParams {
  name: string;
  email: string;
  phone: string;
}
declare interface User extends CreateUserParams {
  $id: string;
}
declare interface RegisterUserParams extends CreateUserParams {
  userId: string;
  birthDate: Date;
  gender: Gender;
  address: string;
  occupation: string;
  emergencyContactName: string;
  emergencyContactNumber: string;
  primaryPhysician: string;
  insuranceProvider: string;
  insurancePolicyNumber: string;
  allergies: string | undefined;
  currentMedication: string | undefined;
  familyMedicalHistory: string | undefined;
  pastMedicalHistory: string | undefined;
  identificationType: string | undefined;
  identificationNumber: string | undefined;
  identificationDocument: FormData | undefined;
  privacyConsent: FormData | undefined;
}
declare type CreateAppointmentParams = {
  userId: string;
  patient: string;
  primaryPhysician: string | undefined;
  reason: string | undefined;
  schedule: string | Date;
  status: Status;
  note: string | undefined;
};
declare type UpdateAppointmentParams = {
  userId: string;
  appointmentId: string;
  appointment: Appointment;
  type: string;
  timeZone: string;
};
