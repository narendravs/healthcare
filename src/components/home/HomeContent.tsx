"use client";
import { useState, useEffect, Suspense, useRef } from "react";
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
import { VoiceAssistantControl } from "@/components/livekit/LiveKitRoom";
import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import EndCallButton from "@/components/livekit/EndCallButton";

const HomeContent = () => {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [chatSessionId, setChatSessionId] = useState<string>("");

  // LiveKit states
  const [token, setToken] = useState<string | null>(null);
  const [livekitUrl, setLivekitUrl] = useState<string>("");
  const [isCallActive, setIsCallActive] = useState<boolean>(false);
  const [roomName, setRoomName] = useState<string>("");

  const type = "database";
  const { setTheme, theme } = useTheme();
  const param = useSearchParams();
  const admin = param.get("admin");

  // Inside your component:
  const roomNameRef = useRef(roomName);

  // Keep the ref updated on every render
  useEffect(() => {
    roomNameRef.current = roomName;
  }, [roomName]);

  useEffect(() => {
    // 🚀 Generate a persistent, unique session token for this browser tab session
    if (typeof window !== "undefined") {
      let currentSession = sessionStorage.getItem("active_chat_session");
      if (!currentSession) {
        currentSession = `session_${window.crypto.randomUUID()}`;
        sessionStorage.setItem("active_chat_session", currentSession);
      }
      setChatSessionId(currentSession);
    }

    if (admin === "true") setIsAdmin(true);
    setMounted(true);
  }, [admin]);

  const openChat = () => {
    setOpen(true);
  };

  // Handler to fetch token from your API and start LiveKit session
  const handlePhoneCall = async () => {
    try {
      const response = await fetch("/api/livekit/voice", { cache: "no-store" });
      const data = await response.json();

      if (!response.ok || !data.token || !data.url) {
        throw new Error(data.error ?? "Token request failed");
      }

      if (data.token && data.url) {
        setToken(data.token);
        setLivekitUrl(data.url);
        setRoomName(data.room);
        setIsCallActive(true);
      }
    } catch (error) {
      console.error("Failed to connect to LiveKit room:", error);
    }
  };

  const endCall = async () => {
    // If we have an active room name, delete it on the server immediately
    if (roomNameRef.current) {
      try {
        await fetch("/api/livekit/voice", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomName: roomNameRef.current }),
        });
      } catch (err) {
        console.error("Failed to tear down LiveKit room:", err);
      }
    }

    // Clear client states
    setIsCallActive(false);
    setToken(null);
    setRoomName("");
    setLivekitUrl("");
  };

  // Handle sudden tab closures or refreshes using sendBeacon
  useEffect(() => {
    if (!roomName) return;
    const handleBeforeUnload = () => {
      if (roomNameRef.current) {
        navigator.sendBeacon(
          "/api/livekit/voice",
          JSON.stringify({ roomName: roomNameRef.current })
        );
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  const closeChat = async (currentDataType: "database" | "documents" | "apicall") => {
    // Only execute the DELETE fetch if the agent was actually hitting the LangChain route
    if (currentDataType === "apicall") {
      try {
        await fetch(`/api/aiagents/langchainAgent`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: chatSessionId }),
        });
      } catch (err) {
        console.error("Failed to tear down chat agent session context:", err);
      }
    }

    // Always close the UI state for database, documents, or completed apicalls
    setOpen(false);
  };

  return (
    <div className="flex min-h-screen flex-row">
      {isAdmin && <PasskeyModal />}

      {/* 📞 LIVEKIT VOICE CALL OVERLAY */}
      {isCallActive && token && (
        <>
          <div className="fixed right-4 bottom-4 z-[9999] w-fit rounded-xl bg-white p-4 shadow-2xl dark:bg-gray-900">
            <LiveKitRoom
              video={false}
              audio={true}
              token={token}
              serverUrl={livekitUrl}
              onDisconnected={endCall}
              onError={(e) => console.error("LiveKit error:", e)}
              data-lk-theme="default"
              className="flex h-full w-full items-center justify-center"
            >
              <VoiceAssistantControl onDisconnect={endCall} />
              <RoomAudioRenderer />
            </LiveKitRoom>
          </div>
          <EndCallButton onClick={endCall} />
        </>
      )}

      <section className="remove-scrollbar container w-full">
        <div className="ml-0 flex flex-col gap-0">
          <div className="rounded-1 flex w-full flex-row items-center gap-5 bg-blue-300 p-4">
            <div className="flex items-center gap-5">
              <Image
                src={"/assets/icons/logo-full.svg"}
                width={200}
                height={40}
                alt="patient"
                className="h-auto w-auto"
              />
              <span className="hidden text-2xl font-bold sm:block">Hospital Management System</span>
            </div>
            <Image
              src="/assets/icons/phone.svg"
              width={40}
              height={10}
              alt="phone"
              title="Call to schedule an appointment"
              onClick={handlePhoneCall}
              className="ml-auto h-10 cursor-pointer rounded-full bg-green-500 p-2"
            />
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
                className="mt-2 ml-[50%] cursor-pointer"
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
          priority
        />
        <div className="absolute top-0 right-0 mt-[3px] mr-[3px] p-5">
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
        {open && <ChatBox onClose={closeChat} type={type} sessionId={chatSessionId} />}
      </div>
    </div>
  );
};

export default HomeContent;
