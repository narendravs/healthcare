"use client";

import { useState } from "react";
import AppointmentForm from "@/components/forms/AppointmentForm";
import { Patient } from "@/types/appwrite.types";

interface Props {
  patient: Patient | null;
  userId: string;
}

const AppointmentClientWrapper = ({ patient, userId }: Props) => {
  const [open, setOpen] = useState(false);

  if (!patient || !patient.$id) {
    return (
      <div className="header mt-[25%] flex flex-col items-center justify-center">
        <p>Patient details are not valid. Register Patient first.</p>
        <p>Click on "Go to Home".</p>
      </div>
    );
  }

  return (
    <AppointmentForm patientId={patient.$id} userId={userId} type="create" setOpen={setOpen} />
  );
};

export default AppointmentClientWrapper;
