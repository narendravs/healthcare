"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import PasskeyModal from "@/components/PasskeyModal";
import PatientForm from "@/components/forms/PatientForm";
import { useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { Moon, Sun, Mic, PhoneOff, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ChatBox from "@/components/chat/ChatBox";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useVoiceAssistant,
  BarVisualizer,
} from "@livekit/components-react";
import "@livekit/components-styles";

// Separate inner component to consume LiveKit room hooks safely inside LiveKitRoom context
export function VoiceAssistantControl({ onDisconnect }: { onDisconnect: () => void }) {
  const { state, audioTrack, agent } = useVoiceAssistant();

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/75 backdrop-blur-md">
      <div className="flex w-[380px] flex-col items-center rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900">
        <div className="relative mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40">
          <span className="absolute h-full w-full animate-ping rounded-full bg-green-500 opacity-25"></span>
          <Volume2 className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>

        <h3 className="mb-1 text-lg font-bold text-gray-800 dark:text-white">
          CarePulse LiveKit Agent
        </h3>
        <p className="mb-3 min-h-[30px] text-center text-xs text-gray-600 capitalize dark:text-gray-300">
          Status: {state}
        </p>

        {/* LiveKit Audio Visualizer */}
        <div className="my-2 flex h-16 w-full items-center justify-center">
          <BarVisualizer
            state={state}
            barCount={5}
            trackRef={audioTrack}
            className="flex h-full items-center gap-1"
          />
        </div>

        <RoomAudioRenderer />

        <Button
          onClick={onDisconnect}
          variant="destructive"
          className="mt-4 w-full cursor-pointer gap-2"
        >
          <PhoneOff className="h-4 w-4" /> End Call
        </Button>
      </div>
    </div>
  );
}
