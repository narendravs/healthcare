import Image from "next/image";
import { redirect } from "next/navigation";
import RegisterForm from "@/components/forms/RegisterForm";
import { getPatient, getUser } from "@/lib/actions/patient.actions";
import { SearchParamProps } from "@/types/index";
import Link from "next/link";

type PageProps = {
  params: { [key: string]: string };
};
const Register = async ({ params }: PageProps) => {
  const userId = params?.userId;
  const user = await getUser(userId!);
  const patient = await getPatient(userId!);

  if (patient) redirect(`/patients/${userId}/new-appointment`);

  return (
    <div className="flex flex-col lg:flex-row min-h-screen lg:h-screen w-full h-full">
      <section className="remove-scrollbar min-h-screen container w-full lg:w-auto">
        <div className="sub-container min-h-screen container flex flex-col xl:max-w-[860px] gap-5 relative mx-auto px-4 lg:flex xl:flex-row xl:gap-5">
          <div className="flex flex-row items-center justify-between  text-blue-500 bg-blue-300 p-5 rounded-bl-lg rounded-br-lg">
            <Link href="/">
              <Image
                src="/assets/icons/logo-full.svg"
                alt="logo"
                width={200}
                height={500}
              />
            </Link>
            <Link
              href="/"
              className="items-center justify-end mr-5 sm:block hidden"
            >
              <h1 className="font-bold text-black">Go To Home</h1>
            </Link>
          </div>
          <section className="space-y-1 sm:space-y-2 mb-4">
            <h1 className="header text-2xl sm:text-sm sm:items-center">
              Welcome To Patient Registration
            </h1>
          </section>
          <RegisterForm user={user} />
          <p className="copyright py-1 fixed-bottom text-center sm:text-left">
            © 2024 CarePluse
          </p>
        </div>
      </section>
      <Image
        src="/assets/images/register-img.png"
        height={2500}
        width={500}
        alt="patient"
        priority
        className="side-img w-full lg:w-[50%] sm:block min-h-screen object-cover flex-1"
      />
    </div>
  );
};
export default Register;
