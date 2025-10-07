"use client";
import { ColumnDef } from "@tanstack/react-table";
import Image from "next/image";
import { Doctors } from "../../constants";
import { formatDateTime } from "@/lib/utils";
import { Appointment } from "@/types/appwrite.types";
import { StatusBadge } from "@/components/StatusBadge";
import AppointmentModal from "../AppointmentModal";

export const formatDateTime1 = (date: Date) => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: true,
    timeZone: "Asia/Kolkata", // Forces the time to be displayed in IST
  });

  return {
    dateTime: formatter.format(date),
  };
};
export const columns: ColumnDef<Appointment>[] = [
  {
    header: "#",
    cell: ({ row }) => {
      return <p className="text-14-medium">{row.index + 1}</p>;
    },
  },
  {
    accessorKey: "patient",
    header: "Patient",
    cell: ({ row }) => {
      const appointment = row.original;
      return <p className="text-14-medium">{appointment.patient.name}</p>;
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const appointment = row.original;
      return (
        <div className="min-w-[115px]">
          <StatusBadge status={appointment.status} />
        </div>
      );
    },
  },
  {
    accessorKey: "schedule",
    header: "Appointment",
    cell: ({ row }) => {
      const appointment = row.original;
      return (
        <p className="text-14-regular min-w-[100px]">
          {formatDateTime(appointment.schedule as Date).dateTime}
        </p>
      );
    },
  },
  {
    accessorKey: "primaryPhysician",
    header: "Doctor",
    cell: ({ row }) => {
      const appointment = row.original;
      const doctor = Doctors.find(
        (doc) => doc.name === appointment.primaryPhysician
      );
      return (
        <div className="flex items-center gap-3">
          <Image
            src={doctor?.image!}
            width={50}
            height={50}
            alt="doctor"
            className="size-8"
          />
          <p className="whitespace-nowrap">Dr. {doctor?.name}</p>
        </div>
      );
    },
  },
  {
    id: "actions",
    header: () => <div className="pl-4">Actions</div>,
    cell: ({ row }) => {
      const appointment = row.original;
      return (
        <div className="flex gap-2 m-0">
          <div className="bg-green-500 w-full boreder-1 flex justify-center items-center rounded-sm cursor-pointer p-1">
            <AppointmentModal
              patientId={appointment.patient.$id}
              userId={appointment.userId}
              appointment={appointment}
              type="schedule"
              title="Schedule Appointment"
              description="Please confirm the following details to schedule."
            />
          </div>
          <div className="bg-red-500 w-full boreder-1 flex justify-center items-center rounded-sm cursor-pointer p-1">
            <AppointmentModal
              patientId={appointment.patient.$id}
              userId={appointment.userId}
              appointment={appointment}
              type="cancel"
              title="Cancel Appointment"
              description="Are you sure you want to cancel your appointment?"
            />
          </div>
        </div>
      );
    },
  },
];
