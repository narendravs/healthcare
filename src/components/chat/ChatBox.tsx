import { useState } from "react";
import ChatMessage from "@/components/chat/ChatMessage";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

interface ChatBoxProps {
  onClose: (currentDataType:"database" | "documents" | "apicall") => void; 
  type: "database" | "documents" | "apicall";
  sessionId: string;
}

const ChatBox = ({ onClose, type, sessionId }: ChatBoxProps) => {
  const [message, setMessage] = useState([
    { role: "bot", content: "Hello! How can I help you today?" },
  ]);
  const [isPasscodeModalOpen, setIsPasscodeModalOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [dataType, setDataType] = useState<"database" | "documents" | "apicall">(type);
  

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
          body: JSON.stringify({ query: currentInput }),
        });
        const data = await response.json();
        if (data.answer) {
          setMessage((prevMsg) => [
            ...prevMsg,
            { 
              role: "bot", 
              content: data.answer,
              }
          ]);
        }
     }
      // 2. DOCUMENTS ROUTE (Now safely encapsulated within the try block)
      else if (dataType === "documents") {
        const response = await fetch(`/api/mcp-client-remote/mcp-doc-client`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: currentInput }),
        });

        if (!response.ok) throw new Error(`Document search failed with status: ${response.status}`);
        const data = await response.json();
        console.log("Document Search API Response:", data);

        // Defensive check: ensure result is a string before trimming
        const resultText = typeof data.result === 'string' ? data.result : JSON.stringify(data.result);

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
          const botMessage = { role: "bot", content: finalFormattedContent};
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
        const activeSessionId = (sessionId && sessionId.trim() !== "") ? sessionId : (typeof window !== "undefined" ? sessionStorage.getItem("active_chat_session") : null);
      
      if (!activeSessionId) {
        throw new Error("Local session verification failed. Please refresh your browser.");
      }
        const response = await fetch(`/api/aiagents/langchainAgent`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: currentInput, sessionId: activeSessionId }),
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
          const agentOutput = typeof data.output === 'string' ? data.output : "";
          console.log("2. String to be parsed:", agentOutput);

          if (agentOutput.includes("successfully")) {
            setIsPasscodeModalOpen(true);
            isNavigationAction = true;
            finalMessage = "Okay, I've created the appointment. Please enter the passcode to access the admin page.";
            
            setMessage((prevMsg) => [...prevMsg, { role: "bot", content: finalMessage }]);
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
    <div className="absolute top-2 right-2 bottom-2 w-[350px] z-50 ">
      {isPasscodeModalOpen && (
        <div className="absolute z-990 right-[10px] top-[50px]">
          <PasskeyModal />
        </div>
      )}
      <Card className="w-[350px] bg-white dark:bg-gray-800">
        <CardHeader className="flex flex-row items-center justify-content-between">
          <CardTitle className="text-lg">Chat</CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={()=> onClose(dataType)}
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
          </Button>
        </CardHeader>
        <CardContent className="p-3">
          <ScrollArea className="h-[350px] pr-2">
            {message.map((msg, ind) => (
              <ChatMessage key={ind} message={msg} />
            ))}
            {isLoading && (
              <div className="my-2 p-0 w-[max-content] animate-pulse">
                Thinking...
              </div>
            )}
          </ScrollArea>
        </CardContent>
        <CardFooter className="flex p-3 border-t dark:border-gray-700 ">
          <form onSubmit={handleSubmit} className="flex flex-col w-full gap-2 ">
            <Select
              onValueChange={(value: any) => setDataType(value as "database" | "documents" | "apicall")}
              value={dataType}
            >
              <SelectTrigger className="opacity-50">
                <SelectValue placeholder="Select data source" className="opacity-50" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="database" className="opacity-50">Database</SelectItem>
                <SelectItem value="documents" className="opacity-50">Documents</SelectItem>
                <SelectItem value="apicall" className="opacity-50">API Call</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex w-full gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your query...."
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
          </form>
        </CardFooter>
      </Card>
    </div>
  );
};

export default ChatBox;