import Image from "next/image";
import { redirect } from "next/navigation";
import RegisterForm from "@/components/forms/RegisterForm";
import { getPatient, getUser } from "@/lib/actions/patient.actions";
import Link from "next/link";

type PageProps = {
  params: Promise<{ userId: string }>; // Params is a Promise in newer Next.js
};

const Register = async ({ params }: PageProps) => {
  const { userId } = await params;

  if (!userId) {
    redirect("/"); // Safety redirect if no ID is found
  }

  const user = await getUser(userId! as string);
  const patient = await getPatient(userId! as string);

  if (patient && patient.documents && patient.documents.length > 0) {
    redirect(`/patients/${userId}/new-appointment`);
  }

  return (
    <div className="flex h-full min-h-screen w-full flex-col lg:h-screen lg:flex-row">
      <section className="remove-scrollbar container min-h-screen w-full lg:w-auto">
        <div className="sub-container container relative mx-auto flex min-h-screen flex-col gap-5 px-4 lg:flex xl:max-w-[860px] xl:flex-row xl:gap-5">
          <div className="flex flex-row items-center justify-between w-full rounded-bl-lg rounded-br-lg bg-blue-300 p-5 text-blue-500">
            <Link href="/">
              <Image src="/assets/icons/logo-full.svg" alt="logo" width={200} height={500} />
            </Link>
            <Link href="/" className="mr-5 hidden items-center justify-end sm:block">
              <h1 className="font-bold text-black">Go To Home</h1>
            </Link>
          </div>
          <section className="mb-4 space-y-1 sm:space-y-2">
            <h1 className="header text-2xl sm:items-center sm:text-sm">
              Welcome To Patient Registration
            </h1>
          </section>
          <RegisterForm user={user} />
          <p className="copyright fixed-bottom py-1 text-center sm:text-left">© 2024 CarePluse</p>
        </div>
      </section>
      <Image
        src="/assets/images/register-img.png"
        height={2500}
        width={500}
        alt="patient"
        priority
        className="side-img min-h-screen w-full flex-1 object-cover sm:block lg:w-[50%]"
      />
    </div>
  );
};
export default Register;
