"use client";
import React, { useState, useEffect } from "react";
import { Appointment, Status } from "@/types/appwrite.types";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { getAppointmentSchema } from "@/lib/validation";
import { z } from "zod";
import { Form } from "@/components/ui/form";
import CustomFormField, { FormFieldType } from "@/components/CustomFormField";
import { Doctors } from "@/constants/index";
import { SelectItem } from "@/components/ui/select";
import Image from "next/image";
import SubmitButton from "@/components/SubmitButton";
import {
  createAppointment,
  getAppointment,
  updateAppointment,
  cancelOppoitment,
} from "@/lib/actions/appointment.actions";

// type can be "create", "schedule", or "cancel"
// "create" is used for creating a new appointment
// "schedule" is used for scheduling an existing appointment
// "cancel" is used for cancelling an existing appointment

type AppointmentFormProps = {
  patientId: string;
  userId: string;
  appointment?: Appointment;
  type: "create" | "schedule" | "cancel";
  setOpen: (isOpen: boolean) => void;
};
const AppointmentForm = ({
  patientId,
  userId,
  appointment,
  type,
  setOpen,
}: AppointmentFormProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [appointments, setAppointment] = useState<Appointment | undefined>(
    undefined
  );

  const router = useRouter();

  const AppointmentFormValidation = getAppointmentSchema(type);

  const form = useForm<z.infer<typeof AppointmentFormValidation>>({
    resolver: zodResolver(AppointmentFormValidation),
    defaultValues: {
      primaryPhysician: appointment ? appointment?.primaryPhysician : "",
      schedule: appointment?.schedule
        ? new Date(appointment.schedule)
        : undefined,
      reason: appointment?.reason ?? "",
      note: appointment?.note ?? "",
      cancellationReason: appointment?.cancellationReason ?? undefined,
    },
  });

  const onSubmit = async (
    values: z.infer<typeof AppointmentFormValidation>
  ) => {
    setIsLoading(true);
    let status;
    switch (type) {
      case "schedule":
        status = "scheduled";
        break;
      case "cancel":
        status = "cancelled";
        break;
      default:
        status = "pending";
    }
    try {
      if (type === "create" && patientId) {
        const appointmentData = {
          userId,
          patient: patientId,
          primaryPhysician: values.primaryPhysician,
          schedule: new Date(values.schedule as Date),
          reason: values.reason!,
          note: values.note,
          status: status as Status,
        };
        const newAppointment = await createAppointment(appointmentData);
        if (newAppointment) {
          form.reset();
          router.push(
            `/patients/${userId}/new-appointment/success?appointmentId=${newAppointment.$id}`
          );
        }
      } else {
        const appointmentToUpdate = {
          userId,
          appointmentId: appointment?.$id!,
          appointment: {
            primaryPhysician: values?.primaryPhysician,
            schedule: new Date(values?.schedule as Date),
            status: status as Status,
            cancellationReason: values?.cancellationReason,
          },
          type,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
        const updatedAppointment = await updateAppointment(appointmentToUpdate);
        if (updatedAppointment) {
          setOpen && setOpen(false);
          form.reset();
        }
      }
    } catch (error) {
      console.log(error);
    }
    setIsLoading(false);
  };

  let buttonLabel;
  switch (type) {
    case "cancel":
      buttonLabel = "Cancel Appointment";
      break;
    case "schedule":
      buttonLabel = "Schedule Appointment";
      break;
    default:
      buttonLabel = "Submit Appointment";
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {type === "create" && (
          <section className="mb-8 space-y-4">
            <h1 className="header">Create Appointment</h1>
            <p className="text-dark-700">
              Please fill out the form below to create a new appointment.
            </p>
          </section>
        )}

        {type !== "cancel" && (
          <>
            <CustomFormField
              fieldType={FormFieldType.SELECT}
              control={form.control}
              name="primaryPhysician"
              label="Doctor"
              placeholder="Select a doctor"
            >
              {Doctors.map((doctor: any) => (
                <SelectItem key={doctor.name + 1} value={doctor.name}>
                  <div className="flex cursor-pointer items-center gap-2">
                    <Image
                      src={doctor.image}
                      alt={doctor.name}
                      width={40}
                      height={40}
                      className="rounded-full border border-dark-500"
                    />
                    <p>{doctor.name}</p>
                  </div>
                </SelectItem>
              ))}
            </CustomFormField>

            <CustomFormField
              fieldType={FormFieldType.DATE_PICKER}
              control={form.control}
              name="schedule"
              showTimeSelect={true}
              label="Expected appointment date"
              placeholder={new Date().toString()}
            />

            <div
              className={`flex flex-col gap-6 ${
                type === "create" && "xl:flex-row xl:get-[30%]"
              }`}
            >
              <CustomFormField
                fieldType={FormFieldType.TEXTAREA}
                control={form.control}
                name="reason"
                label="Appointment reason"
                placeholder="Annual montly check-up"
                readOnly={type === "schedule"}
              />
              <CustomFormField
                fieldType={FormFieldType.TEXTAREA}
                control={form.control}
                name="note"
                label="Comments/notes"
                placeholder="Prefer afternoon appointments, if possible"
                readOnly={type === "schedule"}
              />
            </div>
          </>
        )}
        {type === "cancel" && (
          <CustomFormField
            fieldType={FormFieldType.TEXTAREA}
            control={form.control}
            name="cancellationReason"
            label="Reason for cancellation"
            placeholder="Urgent meeting came up"
          />
        )}
        <SubmitButton
          isLoading={isLoading}
          className={`${
            type === "cancel" ? "shad-danger-btn" : "shad-primary-btn"
          } w-full mt-20 sm:w-[300px]`}
        >
          {buttonLabel}
        </SubmitButton>
      </form>
    </Form>
  );
};

export default AppointmentForm;
