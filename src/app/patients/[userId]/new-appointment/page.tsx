"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { getPatient } from "@/lib/actions/patient.actions";
import Image from "next/image";
import AppointmentForm from "@/components/forms/AppointmentForm";
import { Patient } from "@/types/appwrite.types";
import { useParams } from "next/navigation";

const Appointment = () => {
  const [open, setOpen] = useState(false);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const params = useParams();
  const userId = params?.userId as string;

  useEffect(() => {
    const fectchPatient = async () => {
      const patient = await getPatient(userId);
      if (patient) {
        setPatient(patient);
      } else {
        setPatient(null);
      }
      setIsLoading(false);
    };
    fectchPatient();
  }, [userId]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading appointment form details...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-row">
      <section className="container flex-1 p-4">
        <div className="border-1 mx-1 flex size-full min-h-screen max-w-full flex-1 flex-col overflow-y-auto overflow-x-hidden rounded-lg p-5">
          <div className="flex w-full flex-row items-center justify-between rounded-bl-lg rounded-br-lg bg-blue-300 text-blue-500">
            <Link href="/">
              <Image
                src="/assets/icons/logo-full.svg"
                alt="logo"
                width={200}
                height={500}
                priority
                className="m-5"
              />
            </Link>
            <Link href="/" className="mr-5 hidden items-center justify-end sm:block">
              <h1 className="font-bold text-black">Go To Home</h1>
            </Link>
          </div>
          {patient && patient.$id ? (
            <AppointmentForm
              patientId={patient.$id}
              userId={userId}
              type="create"
              setOpen={setOpen}
            />
          ) : (
            <div className="header mt-[25%] min-h-screen items-center justify-center">
              Patient details are not valid, Register Patient first, Click on Go to Home.
            </div>
          )}
          <p className="copyright mt-10 py-5">@ 2024 CarePulse</p>
        </div>
      </section>
      <div className="hidden md:flex md:flex-shrink-0">
        <Image
          src="/assets/images/appointment-img.png"
          height={1500}
          width={1500}
          alt="appointment"
          className="h-full w-full max-w-[390px] object-cover"
        />
      </div>
    </div>
  );
};

export default Appointment;
