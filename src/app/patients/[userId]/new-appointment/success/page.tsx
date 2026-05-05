"use client";
import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Doctors } from "../../../../../constants";
import { getAppointment } from "@/lib/actions/appointment.actions";
import { formatDateTime } from "@/lib/utils";
import { useSearchParams, useParams } from "next/navigation";
import { Appointment } from "@/types/appwrite.types";
const RequestSuccess = () => {
  const [appointments, setAppointment] = useState<Appointment>();
  const [doctor, setDoctor] = useState<string>();
  const param = useSearchParams();
  const appointmentId = param.get("appointmentId");
  const { userId } = useParams();

  useEffect(() => {
    const fetchAppontments = async () => {
      const appointments = await getAppointment(appointmentId as string);
      setAppointment(appointments);
      Doctors.find((doctor: any) => {
        if (doctor.name === appointments.primaryPhysician) {
          setDoctor(doctor.name);
        }
      });
    };
    fetchAppontments();
  }, [appointmentId]);

  return (
    <div className="container left-5 flex h-screen max-h-screen max-w-full overflow-hidden">
      <div className="success-img container mx-5 my-5 w-full">
        <div className="flex flex-col items-center justify-center">
          <div className="flex w-full flex-row items-center justify-between rounded-bl-lg rounded-br-lg bg-blue-300 text-blue-500">
            <Link href="/">
              <Image
                src="/assets/icons/logo-full.svg"
                width={200}
                height={500}
                alt="logo"
                className="m-5"
                priority
              />
            </Link>
            <Link href="/" className="hidden items-center justify-end sm:block">
              <h1 className="mr-5 font-bold text-black">Go To Home</h1>
            </Link>
          </div>
          <section className="flex flex-col items-center">
            <Image src="/assets/gifs/success.gif" height={300} width={280} alt="success" />
            <h2 className="header mb-6 max-w-[600px]">
              Your <span className="text-green-500"> appointment request</span>
              &nbsp;has been successfully sumbitted!
            </h2>
            <p>We&apos;ll be in touch shortly to confirm.</p>
          </section>
        </div>
        <section className="request-details mb-5 mt-2 items-center xl:ml-[15%]">
          <p>Requested appointment deatils:</p>
          <div className="justify-content-center flex items-center gap-3">
            <Image
              src={((doctorName) => {
                const found = Doctors.find((doc) => doc.name === doctorName);
                return found ? found.image : "/assets/images/default-doctor.jpg";
              })(appointments?.primaryPhysician)}
              width={100}
              height={100}
              alt="doctor"
            />
            <p className="whitespace-nowrap">Dr. {appointments?.primaryPhysician}</p>
          </div>
          <div className="flex gap-2">
            <Image
              src="/assets/icons/calendar.svg"
              width={15}
              height={15}
              alt="calendar"
              // style={{ width: "15px", height: "auto" }}
            />
            <p>{formatDateTime(appointments?.schedule as Date).dateTime}</p>"
          </div>
        </section>
        <div className="justify-content-center ml-[15%] flex items-center">
          <Button className="shad-primary-btn mt-10">
            <Link href={`/patients/${userId}/new-appointment`}>New Appointment</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RequestSuccess;
