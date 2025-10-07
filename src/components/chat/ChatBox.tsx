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
  onClose: () => void;
  type: "database" | "documents";
}

const ChatBox = ({ onClose, type }: ChatBoxProps) => {
  const [message, setMessage] = useState([
    { role: "bot", content: "Hello! How can I help you today?" },
  ]);
  const [isPasscodeModalOpen, setIsPasscodeModalOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [dataType, setDataType] = useState<
    "database" | "documents" | "apicall"
  >("database");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim()) return;

    setIsLoading(true);
    const newMessage = { role: "user", content: input };
    setMessage((prvMsg) => [...prvMsg, newMessage]);
    const currentInput = input;
    setInput("");

    try {
      if (dataType === "database") {
        const response = await fetch(
          `/api/embeddings/search/pineconeDBEmbedSearch`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ query: currentInput }),
          }
        );
        if (!response.ok) {
          throw new Error("Failed to fetch response from API");
        }

        const data = await response.json();

        if (data.results && data.results.length > 0) {
          const botMessages = data.results.map((match: any) => ({
            role: "bot",
            content: `${match.metadata?.text}`,
          }));
          setMessage((prevMsg) => [...prevMsg, ...botMessages]);
        } else {
          setMessage((prevMsg) => [
            ...prevMsg,
            {
              role: "bot",
              content:
                "Sorry, I couldn't find any relevant information for your query.",
            },
          ]);
        }
      } else if (dataType === "documents") {
        const response = await fetch(
          `/api/embeddings/search/pineconeDOCEmbedSearch`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ query: currentInput }),
          }
        );
        if (!response.ok) {
          throw new Error("Failed to fetch response from API");
        }

        const data = await response.json();

        if (data.results && data.results.length > 0) {
          const botMessages = data.results.map((match: any) => ({
            role: "bot",
            content: `${match?.relevantContent}`,
          }));
          setMessage((prevMsg) => [...prevMsg, ...botMessages]);
        } else {
          setMessage((prevMsg) => [
            ...prevMsg,
            {
              role: "bot",
              content:
                "Sorry, I couldn't find any relevant information for your query.",
            },
          ]);
        }
      } else if (dataType === "apicall") {
        const response = await fetch(`/api/aiagents/langchainAgent`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query: currentInput }),
        });

        if (!response.ok) {
          // This will catch HTTP errors like 404 or 500
          const errorData = await response.json(); // Or response.text() if it's not JSON
          throw new Error(
            errorData.message || "Failed with HTTP status: " + response.status
          );
        }
        const data = await response.json();
        console.log("1. Raw API Response:", data);
        // Safely attempt to parse the output as JSON
        let isNavigationAction = false;
        let finalMessage = data.output;
        try {
          const agentOutput = data.output;
          console.log("2. String to be parsed:", agentOutput);
          // Check if the string is even valid before parsing
          // if (
          //   agentOutputString.startsWith("{") &&
          //   agentOutputString.endsWith("}")
          // ) {
          //   const result = JSON.parse(agentOutputString);

          //   console.log("3. Parsed JSON object:", result);

          // Check if the parsed object has the expected structure for a navigation action
          //if (result.status === "success" && result.action === "navigate")
          if (agentOutput && agentOutput.includes("successfully")) {
            setIsPasscodeModalOpen(true);
            isNavigationAction = true;
            // You can optionally set a confirmation message here
            finalMessage =
              "Okay, I've created the appointment. Please enter the passcode to access the admin page.";
            setMessage((prevMsg) => [
              ...prevMsg,
              {
                role: "bot",
                content: finalMessage,
              },
            ]);
          }
        } catch (e) {
          // This is a normal message, so no action is needed
          console.error("Agent output is not a JSON object:", e);
        }
        // Update the messages only if it's not a navigation signal
        if (!isNavigationAction) {
          setMessage((prevMsg) => [
            ...prevMsg,
            {
              role: "bot",
              content: finalMessage,
            },
          ]);
        } else {
          setMessage((prevMsg) => [
            ...prevMsg,
            {
              role: "bot",
              content:
                "Sorry, I couldn't find any relevant information for your query.",
            },
          ]);
        }
      }
    } catch (error) {
      console.error("Error fetching chat response:", error);
      setMessage((prevMsg) => [
        ...prevMsg,
        { role: "bot", content: "An error occurred. Please try again." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="absolute top-2 right-2 bottom-2  w-[350px] z-50 ">
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
            onClick={onClose}
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
              className="lucide lucide-x "
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
              <div className="my-2 p-3 rounded-lg bg-gray-299 dark:text-gray-100 animate-pulse">
                Thinking...
              </div>
            )}
          </ScrollArea>
        </CardContent>
        <CardFooter className="flex p-3 border-t dark:border-gray-700 ">
          <form onSubmit={handleSubmit} className="flex flex-col w-full gap-2 ">
            <Select
              onValueChange={(value: any) =>
                setDataType(value as "database" | "documents")
              }
              defaultValue={dataType}
            >
              <SelectTrigger className="opacity-50">
                <SelectValue
                  placeholder="Select data source"
                  className="opacity-50"
                />
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
              </SelectContent>
            </Select>
            <div className="flex w-full gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your query...."
                className="flex-1"
              />
              <Button
                type="submit"
                disabled={isLoading}
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
                  className="lucide lucide-send-horizontal "
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
