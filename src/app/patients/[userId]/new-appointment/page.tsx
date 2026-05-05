import Image from "next/image";
import Link from "next/link";
import { getPatient } from "@/lib/actions/patient.actions";
import AppointmentClientWrapper from "@/components/appointment/AppointmentClientWrapper";

const AppointmentPage = async ({ params }: { params: { userId: string } }) => {
  const { userId } = params;

  // Fetch data directly on the server
  const patient = await getPatient(userId);

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
                height={50} // Fixed height: 500 was likely stretching it!
                priority
                className="m-5"
              />
            </Link>
            <Link href="/" className="mr-5 hidden items-center justify-end sm:block">
              <h1 className="font-bold text-black">Go To Home</h1>
            </Link>
          </div>

          {/* Pass the server-fetched data to the Client Wrapper */}
          <AppointmentClientWrapper patient={patient} userId={userId} />

          <p className="copyright mt-10 py-5">@ 2024 CarePulse</p>
        </div>
      </section>

      <div className="hidden md:flex md:flex-shrink-0">
        <Image
          src="/assets/images/appointment-img.png"
          height={1000}
          width={1000}
          alt="appointment"
          className="h-full w-full max-w-[390px] object-cover"
        />
      </div>
    </div>
  );
};

export default AppointmentPage;
