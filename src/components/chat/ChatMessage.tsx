"use client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import ReactMarkdown from "react-markdown"; // 🟩 Added Markdown Parser
import { Play, Pause, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type chatMessageProps = {
  key: number;
  message: { role: string; content: string; audioUrl?: string };
};
const ChatMessage = ({ message }: chatMessageProps) => {
  const isUser = message.role === "user";
  const avatar = isUser ? "You" : "Bot";
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Auto-cleanup Blob URLs to prevent memory leaks when messages unmount
  useEffect(() => {
    return () => {
      if (message.audioUrl && message.audioUrl.startsWith("blob:")) {
        URL.revokeObjectURL(message.audioUrl);
      }
    };
  }, [message.audioUrl]);

  const toggleAudio = async () => {
    if (!audioRef.current) return;

    try {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        // Reset playback position if finished
        if (audioRef.current.ended) {
          audioRef.current.currentTime = 0;
        }
        await audioRef.current.play();
        setIsPlaying(true);
      }
    } catch (err) {
      console.error("Audio playback error:", err);
      setIsPlaying(false);
    }
  };

  return (
    <div className={`my-2 flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <Avatar>
          <AvatarFallback>AI</AvatarFallback>
        </Avatar>
      )}
      <div
        className={`text-md max-w-[75%] rounded-lg p-3 break-words ${
          isUser
            ? "bg-blue-500 text-white"
            : "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100"
        }`}
      >
        <div className="prose dark:prose-invert prose-xs prose-p:my-0 prose-p:py-0 prose-p:leading-normal max-w-none">
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>

        {/* 🎧 Interactive Audio Player Control */}
        {message.audioUrl && (
          <div className="mt-3 flex items-center gap-2 border-t border-gray-300 pt-2 dark:border-gray-600">
            <audio
              ref={audioRef}
              src={message.audioUrl}
              onEnded={() => setIsPlaying(false)}
              className="hidden"
            />
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={toggleAudio}
              className="bg-background/50 hover:bg-background h-7 w-7 shrink-0 rounded-full"
              title={isPlaying ? "Pause audio" : "Play audio"}
            >
              {isPlaying ? (
                <Pause className="text-primary h-3.5 w-3.5 fill-current" />
              ) : (
                <Play className="text-primary ml-0.5 h-3.5 w-3.5 fill-current" />
              )}
            </Button>
            <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-300">
              <Volume2
                className={`h-3.5 w-3.5 ${isPlaying ? "animate-pulse text-blue-500" : ""}`}
              />
              <span>{isPlaying ? "Playing audio..." : "Listen to response"}</span>
            </div>
          </div>
        )}
      </div>
      {isUser && (
        <Avatar>
          <AvatarFallback>AI</AvatarFallback>
        </Avatar>
      )}
    </div>
  );
};

export default ChatMessage;
