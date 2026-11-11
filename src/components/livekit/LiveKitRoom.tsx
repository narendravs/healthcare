"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import PasskeyModal from "@/components/PasskeyModal";
import PatientForm from "@/components/forms/PatientForm";
import { useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { PhoneOff, Volume2 } from "lucide-react";
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

// Audio utility helper: plays a short 200ms disconnect tone
function playDisconnectSound() {
  try {
    const audioCtx = getAudioContext();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(440, audioCtx.currentTime); // A4 note
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.2);
  } catch (e) {
    console.error("AudioContext blocked or unsupported", e);
  }
}

// Singleton AudioContext to prevent WebRTC / Audio resource locking
let sharedAudioCtx: AudioContext | null = null;
let ringbackInterval: NodeJS.Timeout | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!sharedAudioCtx || sharedAudioCtx.state === "closed") {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      sharedAudioCtx = new AudioContextClass();
    }
  }
  if (sharedAudioCtx && sharedAudioCtx.state === "suspended") {
    sharedAudioCtx.resume();
  }
  return sharedAudioCtx;
}

// Starts a looping ringback tone while waiting for the agent
function startRingbackTone() {
  if (ringbackInterval) return;

  const playBeep = () => {
    try {
      const audioCtx = getAudioContext();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.4); // 400ms beep duration
    } catch (e) {
      console.error("AudioContext blocked or unsupported", e);
    }
  };

  playBeep();
  ringbackInterval = setInterval(playBeep, 2000); // Repeats every 2 seconds
}

// Halts the ringback tone loop
function stopRingbackTone() {
  if (ringbackInterval) {
    clearInterval(ringbackInterval);
    ringbackInterval = null;
  }
}

// Separate inner component to consume LiveKit room hooks safely inside LiveKitRoom context
export function VoiceAssistantControl({ onDisconnect }: { onDisconnect: () => void }) {
  const { state, audioTrack, agent } = useVoiceAssistant();
  const [isEnding, setIsEnding] = useState(false);

  // Automatically monitor LiveKit connection states to start/stop the ringback audio
  useEffect(() => {
    if (state === "connecting" || state === "initializing") {
      startRingbackTone();
    } else {
      stopRingbackTone();
    }

    return () => {
      stopRingbackTone();
    };
  }, [state]);

  const handleEndCall = () => {
    setIsEnding(true);
    stopRingbackTone();
    playDisconnectSound();

    // Brief delay to let the user hear the disconnect beep before unmounting/disconnecting
    setTimeout(() => {
      onDisconnect();
    }, 250);
  };

  // Determine indicator styles based on connection/ending state
  const isCallActive = state === "connected" || state === "listening" || state === "speaking";

  const indicatorColor = isEnding ? "bg-red-500" : isCallActive ? "bg-green-500" : "bg-amber-500";

  const containerBg = isEnding
    ? "bg-red-100 dark:bg-red-900/40"
    : isCallActive
      ? "bg-green-100 dark:bg-green-900/40"
      : "bg-amber-100 dark:bg-amber-900/40";

  const textColor = isEnding
    ? "text-red-600 dark:text-red-400"
    : isCallActive
      ? "text-green-600 dark:text-green-400"
      : "text-amber-600 dark:text-amber-400";

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/75 backdrop-blur-md">
      <div className="flex w-[380px] flex-col items-center rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900">
        <div
          className={`${containerBg} relative mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40`}
        >
          <span
            className={`absolute h-full w-full animate-ping rounded-full ${indicatorColor} bg-green-500 opacity-25`}
          ></span>
          <Volume2 className={`h-8 w-8 ${textColor}`} />
        </div>

        <h3 className="mb-1 text-lg font-bold text-gray-800 dark:text-white">
          CarePulse LiveKit Agent
        </h3>

        <p className="mb-3 min-h-[30px] text-center text-xs text-gray-600 capitalize dark:text-gray-300">
          Status: {isEnding ? "Ending call..." : state}
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
          disabled={isEnding}
          variant="destructive"
          className="mt-4 w-full cursor-pointer gap-2"
        >
          <PhoneOff className="h-4 w-4" /> {isEnding ? "Disconnecting..." : "End Call"}
        </Button>
      </div>
    </div>
  );
}
