import { useState, useRef } from "react";
import ChatMessage from "@/components/chat/ChatMessage";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectTrigger,
  SelectItem,
  SelectContent,
  SelectValue,
} from "@/components/ui/select";
import PasskeyModal from "@/components/PasskeyModal";
import { Mic, Square, Volume2, X, Send } from "lucide-react";

interface ChatBoxProps {
  onClose: (currentDataType: "database" | "documents" | "apicall" | "tts_stt") => void;
  type: "database" | "documents" | "apicall" | "tts_stt";
  sessionId: string;
}

const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Spanish (Español)" },
  { code: "fr", label: "French (Français)" },
  { code: "de", label: "German (Deutsch)" },
  { code: "hi", label: "Hindi (हिंदी)" },
  { code: "ar", label: "Arabic (الهندية)" },
];

// Map basic placeholders for supported languages
const PLACEHOLDERS: Record<string, string> = {
  en: "Type your query...",
  es: "Escriba su consulta...",
  fr: "Saisissez votre requête...",
  de: "Geben Sie Ihre Anfrage ein...",
  hi: "अपनी क्वेरी टाइप करें...",
  ar: "اكتب استفسارك...",
};

const RECORDING_PLACEHOLDERS: Record<string, string> = {
  en: "Listening...",
  es: "Escuchando...",
  fr: "Écoute en cours...",
  de: "Zuhören...",
  hi: "सुन रहा हूँ...",
  ar: "جاري الاستماع...",
};

const ChatBox = ({ onClose, type, sessionId }: ChatBoxProps) => {
  const [message, setMessage] = useState([
    { role: "bot", content: "Hello! How can I help you today?" },
  ]);
  const [isPasscodeModalOpen, setIsPasscodeModalOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [dataType, setDataType] = useState<"database" | "documents" | "apicall" | "tts_stt">(type);
  const [voiceSubSource, setVoiceSubSource] = useState<"documents" | "database" | "apicall">(
    "documents"
  );

  const [targetLanguage, setTargetLanguage] = useState<string>("en");

  const mediaRecordRef = useRef<MediaRecorder | null>(null);
  const audioChunkRef = useRef<Blob[]>([]);

  // 🟢 Helper to get valid sessionId (Prop -> SessionStorage fallback)
  const resolveSessionId = (): string => {
    const activeId =
      sessionId && sessionId.trim() !== ""
        ? sessionId
        : typeof window !== "undefined"
          ? sessionStorage.getItem("active_chat_session")
          : null;

    if (!activeId) {
      throw new Error("Local session verification failed. Please refresh your browser.");
    }
    return activeId;
  };

  // Start Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecordRef.current = new MediaRecorder(stream);
      audioChunkRef.current = [];

      mediaRecordRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunkRef.current.push(event.data);
        }
      };

      mediaRecordRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunkRef.current, { type: "audio/webm" });
        // Create a temporary local URL for audio playback
        const audioUrl = URL.createObjectURL(audioBlob);
        // Show audio file status inside the Input Box visually
        const audioFileName = `audio_record_${Date.now()}.webm`;
        setMessage((prevMsg) => [
          ...prevMsg,
          {
            role: "bot",
            content: `🎙️ Audio Recording (${(audioBlob.size / 1024).toFixed(1)} KB)`,
            audioUrl: audioUrl,
          },
        ]);
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = reader.result as string;
          await processVoiceSTTQuery(base64Audio);
        };
      };
      mediaRecordRef.current.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Microphone access denied:", error);
    }
  };

  // Stop Recording
  const stopRecording = () => {
    if (mediaRecordRef.current && mediaRecordRef.current.state !== "inactive") {
      mediaRecordRef.current.stop();
      setIsRecording(false);
    }
  };

  // STT Flow: Transcribe Voice -> Query Vector MCP Route
  const processVoiceSTTQuery = async (base64Audio: string) => {
    setIsLoading(true);
    try {
      // 🟢 Resolve Session ID safely
      const activeSessionId = resolveSessionId();
      const response = await fetch(`/api/huggingface/speech`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "speech-to-text",
          payload: base64Audio,
          source: voiceSubSource, // 👈 Target sub-source passed
          sessionId: activeSessionId,
          targetLanguage: targetLanguage,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "STT processing failed.");
      setMessage((prevMsg) => [...prevMsg, { role: "user", content: data.transcribedText }]);
      const formattedContent = `🎙️ **Voice Query Transcribed**\n\n🟢 [Source: Vector Database]\n----------------------------------------\n${data.result}`;
      setMessage((prevMsg) => [...prevMsg, { role: "bot", content: formattedContent }]);
    } catch (error: any) {
      console.error("STT Execution Error:", error);
      setMessage((prev) => [
        ...prev,
        { role: "bot", content: "Failed to transcribe and process audio input." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // 🔊 TTS FLOW: Send Text Query -> Get Answer -> Play Audio
  const processTextTTSQuery = async (text: string) => {
    if (!text) return;
    const textQuery = text.trim();
    setIsLoading(true);
    setInput("");
    try {
      // 🟢 Resolve Session ID safely
      const activeSessionId = resolveSessionId();
      setMessage((prevMsg) => [...prevMsg, { role: "user", content: text }]);
      console.log("=== TTS DEBUG LOGS ===", textQuery);
      const response = await fetch(`/api/huggingface/speech`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "text-to-speech",
          payload: {
            text: textQuery,
            source: voiceSubSource, // 👈 Target sub-source passed
            sessionId: activeSessionId,
            targetLanguage: targetLanguage,
          },
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "TTS processing failed.");
      }
      const data = await response.json();
      let audioUrl: string | undefined;

      if (data.audio) {
        let uint8Array: Uint8Array;

        if (typeof data.audio === "string") {
          // Handle Base64 string response
          const base64Clean = data.audio.replace(/^data:audio\/\w+;base64,/, "");
          const binaryString = atob(base64Clean);
          uint8Array = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            uint8Array[i] = binaryString.charCodeAt(i);
          }
        } else if (Array.isArray(data.audio)) {
          // Handle raw byte array response [114, 73, 70, 70, ...]
          uint8Array = new Uint8Array(data.audio);
        } else if (data.audio.data && Array.isArray(data.audio.data)) {
          // Handle Buffer JSON object { type: 'Buffer', data: [...] }
          uint8Array = new Uint8Array(data.audio.data);
        } else {
          throw new Error("Unrecognized audio data structure");
        }

        // Detect MIME type or fallback to audio/wav / audio/mpeg
        const audioBlob = new Blob([uint8Array], { type: "audio/wav" });

        // Ensure the Blob is not empty (0 bytes causes ERR_REQUEST_RANGE_NOT_SATISFIABLE)
        if (audioBlob.size > 0) {
          audioUrl = URL.createObjectURL(audioBlob);
        } else {
          console.error("Generated audio blob has 0 bytes.");
        }
      }

      const formattedContent = `📝 **Text Query**\n\n🟢 [Source: Vector Database]\n----------------------------------------\n${data.result}`;
      setMessage((prevMsg) => [
        ...prevMsg,
        { role: "bot", content: formattedContent, audioUrl: audioUrl },
      ]);
      if (!response.ok) throw new Error(data.error || "TTS processing failed.");
    } catch (error) {
      console.error("TTS Execution Error:", error);
      setMessage((prev) => [
        ...prev,
        { role: "bot", content: "Failed to process text-to-speech query." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim()) return;

    setIsLoading(true);
    const newMessage = { role: "user", content: input };
    setMessage((prvMsg) => [...prvMsg, newMessage]);
    const currentInput = input;
    setInput("");

    // 🟩 ONE TRY BLOCK TO RULE THEM ALL
    try {
      // 1. DATABASE ROUTE
      if (dataType === "database") {
        const response = await fetch(`/api/mcp-client-remote/mcp-db-client`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: currentInput, targetLanguage }),
        });

        const data = await response.json();
        console.log("Database API Response:", data);
        if (data.answer) {
          const isVerified = data?.isVerified;
          const answer = data?.answer;
          const tableName = data?.tableName || "Unknown Table";

          let finalFormattedContent = "";

          if (isVerified) {
            // 🟢 CASE A: Data exists and is cleanly verified
            const verificationBadge = `🟢 [Verified Ground-Truth Source: ${tableName}]\n`;
            finalFormattedContent = `${verificationBadge}----------------------------------------\n${answer}`;
          } else {
            // 🔴 CASE B: Data does not exist in the table or verification failed
            const verificationBadge = `🔴 [Data Source Notice: ${tableName}]\n`;
            // Create a highly human-readable, clear fallback response for the user
            const userReadableFallback = `We searched the system, but no matching records could be found in the "${tableName}" database table. Please check your query parameters and try again.`;
            finalFormattedContent = `${verificationBadge}----------------------------------------\n${userReadableFallback}`;
          }
          setMessage((prevMsg) => [
            ...prevMsg,
            {
              role: "bot",
              content: finalFormattedContent,
            },
          ]);
        } else {
          // Fallback for empty payload
          setMessage((prevMsg) => [
            ...prevMsg,
            {
              role: "bot",
              content: `⚠️ Received response from server, but no content payload was generated.`,
            },
          ]);
        }
      }
      // 2. DOCUMENTS ROUTE (Now safely encapsulated within the try block)
      else if (dataType === "documents") {
        const response = await fetch(`/api/mcp-client-remote/mcp-doc-client`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: currentInput, targetLanguage }),
        });

        const data = await response.json();
        console.log("Document Search API Response:", data);

        // Defensive check: ensure result is a string before trimming
        const resultText =
          typeof data.result === "string" ? data.result : JSON.stringify(data.result);

        if (resultText && resultText.trim().length > 0) {
          // 1. Extract flags from the metadata object safely
          const isDocGenuine = data.meta?.isValidated;
          const checkedFile = data.meta?.documentChecked || "Unknown Document";

          // 2. Format a professional, clean string badge to prepend to the message content
          const verificationBadge = isDocGenuine
            ? `🟢 [Verified Ground-Truth Source: ${checkedFile}]\n`
            : `🔴 [Warning: File Verification Failure for ${checkedFile}]\n`;

          // 3. Concatenate the header banner directly with the main AI prose response
          const finalFormattedContent = `${verificationBadge}----------------------------------------\n${resultText}`;

          // 4. Update state using strictly 'role' and 'content' properties
          const botMessage = { role: "bot", content: finalFormattedContent };
          setMessage((prevMsg) => [...prevMsg, botMessage]);
        } else {
          setMessage((prevMsg) => [
            ...prevMsg,
            { role: "bot", content: "I couldn't find any relevant documents for that query." },
          ]);
        }
      }
      // 3. API CALL ROUTE
      else if (dataType === "apicall") {
        // 🟩 FALLBACK: If state hasn't propagated, read directly from storage
        const activeSessionId = resolveSessionId();

        if (!activeSessionId) {
          throw new Error("Local session verification failed. Please refresh your browser.");
        }
        const response = await fetch(`/api/aiagents/langchainAgent`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: currentInput, sessionId: activeSessionId, targetLanguage }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed with HTTP status: " + response.status);
        }

        const data = await response.json();
        console.log("1. Raw API Response:", data);

        let isNavigationAction = false;
        let finalMessage = data.output;

        try {
          const agentOutput = typeof data.output === "string" ? data.output : "";
          console.log("2. String to be parsed:", agentOutput);

          // 🟢 FIXED: Check top-level JSON properties returned by your API
          const isNavigateAction = data.action === "navigate" || data.targetRoute === "/admin";
          console.log("3. Navigation Action is present:", isNavigateAction);

          if (data.action === "navigate") {
            isNavigationAction = true;
            finalMessage =
              "Okay, I've created the appointment. Please enter the passcode to access the admin page.";

            setMessage((prevMsg) => [...prevMsg, { role: "bot", content: finalMessage }]);
            setIsPasscodeModalOpen(true);
          } else if (dataType === "tts_stt") {
            await processTextTTSQuery(currentInput);
            return;
          }
        } catch (e) {
          console.error("Agent output parse handling exception:", e);
        }

        if (!isNavigationAction) {
          setMessage((prevMsg) => [
            ...prevMsg,
            { role: "bot", content: finalMessage || "Response handled successfully." },
          ]);
        }
      } else if (dataType === "tts_stt") {
        await processTextTTSQuery(currentInput);
        return;
      }
    } catch (error) {
      // 🟩 TRAPS ALL RUNTIME OR NETWORK FAILS ACROSS EVERY DATA OPTION
      console.error("❌ CRITICAL EXCEPTION CAUGHT IN SUBMIT:", error);
      setMessage((prevMsg) => [
        ...prevMsg,
        { role: "bot", content: "An error occurred. Please try again." },
      ]);
    } finally {
      // 🟩 FIXED: Properly structured finally block to tear down the loading animations
      setIsLoading(false);
    }
  };

  return (
    <div className="absolute top-2 right-2 bottom-2 z-50 w-[350px]">
      {isPasscodeModalOpen && (
        <div className="absolute top-[50px] right-[10px] z-990">
          <PasskeyModal />
        </div>
      )}
      <Card className="w-[350px] bg-white dark:bg-gray-800">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="justify-content-between flex flex-row items-center justify-center gap-1">
            <CardTitle className="text-lg">Chat</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onClose(dataType)}
              className="cursor-pointer"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-x"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
              {/* <X className="h-4 w-4 text-gray-500 hover:text-gray-700 dark:hover:text-white" /> */}
            </Button>
          </div>
          <Select value={targetLanguage} onValueChange={(val) => setTargetLanguage(val)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select Language" />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_LANGUAGES.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>
                  {lang.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-3">
          <ScrollArea className="h-[350px] pr-2">
            {message.map((msg, ind) => (
              <ChatMessage key={ind} message={msg} />
            ))}
            {isLoading && <div className="my-2 w-[max-content] animate-pulse p-0">Thinking...</div>}
          </ScrollArea>
        </CardContent>
        <CardFooter className="flex border-t p-3 dark:border-gray-700">
          <form onSubmit={handleSubmit} className="flex w-full flex-col gap-2">
            <Select
              onValueChange={(value: any) =>
                setDataType(value as "database" | "documents" | "apicall" | "tts_stt")
              }
              value={dataType}
            >
              <SelectTrigger className="opacity-50">
                <SelectValue placeholder="Select data source" className="opacity-50" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="database" className="opacity-50">
                  Database
                </SelectItem>
                <SelectItem value="documents" className="opacity-50">
                  Documents
                </SelectItem>
                <SelectItem value="apicall" className="opacity-50">
                  API Call
                </SelectItem>
                <SelectItem value="tts_stt" className="opacity-50">
                  TTS/STT
                </SelectItem>
              </SelectContent>
            </Select>

            {/* 🟢 Sub-source Dropdown (Renders conditionally when mode is TTS/STT) */}
            {dataType === "tts_stt" && (
              <Select value={voiceSubSource} onValueChange={(val: any) => setVoiceSubSource(val)}>
                <SelectTrigger className="bg-muted/40 h-8 text-xs">
                  <SelectValue placeholder="Target Voice Source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="documents">📄 Documents </SelectItem>
                  <SelectItem value="database">🗄️ Database </SelectItem>
                  <SelectItem value="apicall">🤖 API Call (Scheduling appointment)</SelectItem>
                </SelectContent>
              </Select>
            )}
            {/* Input controls based on selection */}
            {dataType === "tts_stt" ? (
              <div className="relative flex w-full items-center">
                {/* 🎙️ 1. Start/Stop Recording Button (Embedded Left) */}
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isLoading}
                  className={`absolute left-1 z-10 h-7 w-7 rounded-full p-0 transition-colors hover:cursor-pointer ${
                    isRecording
                      ? "animate-pulse bg-red-500 text-white hover:bg-red-600"
                      : "text-green-600 hover:bg-green-700 dark:hover:bg-green-500"
                  }`}
                  title={isRecording ? "Stop Recording" : "Start Recording"}
                >
                  {isRecording ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-6 w-6" />}
                </Button>

                {/* ⌨️ 2. Input Field (Padded to clear both internal buttons) */}
                <Input
                  key={`${targetLanguage}-${isRecording}`}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    isRecording
                      ? RECORDING_PLACEHOLDERS[targetLanguage] || "Listening..."
                      : PLACEHOLDERS[targetLanguage] || "Type query or record..."
                  }
                  className="w-full text-xs focus-visible:ring-1"
                  disabled={isLoading}
                  autoFocus
                />

                {/* 🔊 3. Speak (TTS) Button (Embedded Right) */}
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={(e) => {
                    e.preventDefault();
                    processTextTTSQuery(input);
                  }}
                  disabled={isLoading || !input.trim() || isRecording}
                  className="absolute right-9 z-10 h-7 w-7 rounded-full p-0 text-gray-500 hover:cursor-pointer hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-700"
                  title="Speak (TTS)"
                >
                  <Volume2 className="h-6 w-6 gap-3" />
                </Button>
              </div>
            ) : (
              <div className="flex w-full gap-2">
                <Input
                  key={targetLanguage}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={PLACEHOLDERS[targetLanguage] || "Type your query..."}
                  className="flex-1"
                />
                <Button type="submit" disabled={isLoading} className="cursor-pointer">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="lucide lucide-send-horizontal"
                  >
                    <path d="m3 3 3 9-3 9 19-9Z" />
                    <path d="M6 12h16" />
                  </svg>
                </Button>
              </div>
            )}
          </form>
        </CardFooter>
      </Card>
    </div>
  );
};

export default ChatBox;
