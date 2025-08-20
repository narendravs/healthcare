"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import PasskeyModal from "@/components/PasskeyModal";
import PatientForm from "@/components/forms/PatientForm";
import { useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ChatBox from "@/components/chat/ChatBox";
const Home = () => {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const type = "database";
  const { setTheme, theme } = useTheme();
  const param = useSearchParams();
  const admin = param.get("admin");

  useEffect(() => {
    if (admin === "true") setIsAdmin(true);
    setMounted(true);
  }, [admin]);

  const openChat = () => {
    setOpen(true);
  };
  const closeChat = () => {
    setOpen(false);
  };

  return (
    <div className="flex flex-row min-h-screen  ">
      {isAdmin && <PasskeyModal />}
      <section className="remove-scrollbar container ">
        <div className="flex flex-col gap-0 ml-0 flex-1">
          <div className="flex flex-row items-center gap-5 bg-blue-300 p-4 rounded-1">
            <Image
              src={"/assets/icons/logo-full.svg"}
              width={200}
              height={500}
              alt="patient"
              className=""
            />
            <span className="font-bold text-2xl  sm:block hidden ">
              Hospital Management System
            </span>
          </div>
          <PatientForm />
          <div className="text-14-regular mt-10 flex flex-row px-2 justify-between">
            <p className="text-dark-600 xl:text-left ">© 2024 CarePluse</p>
            <Button
              onClick={openChat}
              className="flex flex-col items-center justify-center gap-2"
            >
              <p className="text-small">
                Hey! chat with me about patient detais and appointments ?
              </p>
              <Image
                src="/chat-svgrepo-com.svg"
                alt="chat box"
                width={30}
                height={30}
                className="cursor-pointer ml-[50%] mt-2"
              />
            </Button>
            <Link href="/?admin=true" className="text-green-500">
              Admin
            </Link>
          </div>
        </div>
      </section>
      <div className="relative">
        <Image
          src="/assets/images/onboarding-img.png"
          height={1000}
          width={1000}
          alt="patient"
          className="side-img max-w-[100%] min-h-screen object-cover flex-1"
        />
        <div className="top-0 right-0 absolute mr-[3px] mt-[3px] p-5 ">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                {mounted && theme === "dark" ? (
                  <Moon className="h-[1.2rem] w-[1.2rem]" />
                ) : (
                  <Sun className="h-[1.2rem] w-[1.2rem]" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className=" flex flex-col text-white bg-gray-400 z-[10000] items-center justify-content-center"
            >
              <DropdownMenuItem onClick={() => setTheme("light")}>
                Light
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("dark")}>
                Dark
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("system")}>
                System
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <span>
            <h1 className="text-1xl text-black font-bold sm:block hidden md:block">
              Select the mode
            </h1>
          </span>
        </div>
        {open && <ChatBox onClose={closeChat} type={type} />}
      </div>
    </div>
  );
};

export default Home;
