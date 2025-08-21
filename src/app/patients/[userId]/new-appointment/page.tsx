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
  const [patient, setPatient] = useState<Patient>();
  const params = useParams();
  const userId = params?.userId as string;

  useEffect(() => {
    const fectchPatient = async () => {
      const patient = await getPatient(userId);
      if (patient) setPatient(patient);
    };
    fectchPatient();
  }, [userId]);
  return (
    <div className="flex flex-row min-h-screen">
      <section className="container flex-1 p-4 ">
        <div className="mx-1 flex flex-col size-full flex-1 max-w-full min-h-screen border-1 rounded-lg p-5 overflow-y-auto overflow-x-hidden">
          <div className="flex flex-row items-center justify-between  text-blue-500 bg-blue-300 rounded-bl-lg rounded-br-lg">
            <Link href="/">
              <Image
                src="/assets/icons/logo-full.svg"
                alt="logo"
                width={200}
                height={500}
                className="m-5"
              />
            </Link>
            <Link
              href="/"
              className="items-center justify-end mr-5 sm:block hidden"
            >
              <h1 className="font-bold text-black">Go To Home</h1>
            </Link>
          </div>
          <AppointmentForm
            patientId={patient?.$id as string}
            userId={userId}
            type="create"
            setOpen={setOpen}
          />
          <p className="copyright mt-10 py-5">@ 2024 CarePulse</p>
        </div>
      </section>
      <div className="hidden md:flex md:flex-shrink-0">
        <Image
          src="/assets/images/appointment-img.png"
          height={1500}
          width={1500}
          alt="appointment"
          className="h-full object-cover max-w-[390px] w-full"
        />
      </div>
    </div>
  );
};

export default Appointment;
