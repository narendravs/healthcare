"use client";
import { useState, useEffect, Suspense } from "react";
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

const HomeContent = () => {
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
    <div className="flex min-h-screen flex-row">
      {isAdmin && <PasskeyModal />}
      <section className="remove-scrollbar container w-full">
        <div className="ml-0 flex flex-col gap-0">
          <div className="rounded-1 flex w-full flex-row items-center gap-5 bg-blue-300 p-4">
            <Image
              src={"/assets/icons/logo-full.svg"}
              width={200}
              height={40}
              alt="patient"
              className="h-auto w-auto"
            />
            <span className="hidden text-2xl font-bold sm:block">Hospital Management System</span>
          </div>
          <PatientForm />
          <div className="text-14-regular mt-10 flex flex-row justify-between px-2">
            <p className="text-dark-600 xl:text-left">© 2024 CarePluse</p>
            <Button onClick={openChat} className="flex flex-col items-center justify-center gap-2">
              <p className="text-small">
                Hey! chat with me about patient detais and appointments ?
              </p>
              <Image
                src="/chat-svgrepo-com.svg"
                alt="chat box"
                width={30}
                height={30}
                className="ml-[50%] mt-2 cursor-pointer"
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
          className="side-img min-h-screen w-auto flex-1 object-cover"
          // className="side-img object-cover"
          priority
        />
        <div className="absolute right-0 top-0 mr-[3px] mt-[3px] p-5">
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
              className="justify-content-center z-[10000] flex flex-col items-center bg-gray-400 text-white"
            >
              <DropdownMenuItem onClick={() => setTheme("light")}>Light</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("dark")}>Dark</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("system")}>System</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <span>
            <h1 className="text-1xl hidden font-bold text-black md:block">Select the mode</h1>
          </span>
        </div>
        {open && <ChatBox onClose={closeChat} type={type} />}
      </div>
    </div>
  );
};

export default HomeContent;
