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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
const ChatBox = ({ onClose }: any) => {
  const [message, setMessage] = useState([
    { role: "bot", content: "Hello! How can I help you today?" },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    if (!input.trim()) return;
    const newMessage = { role: "user", content: input };
    setMessage((prvMsg) => [...prvMsg, newMessage]);
    setInput("");
    try {
      const response = await fetch(
        "/api/embeddings/search/pineconeEmbedSearch",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query: input }),
        }
      );
      const data = await response.json();
      console.log("data.....", data.results);
      if (!response.ok) {
        throw new Error("Failed to Fecth response from API");
      }

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
    <div className="absolute bottom-4 right-4 z-50 ">
      <Card className="w-[350px] bg-white dark:bg-gray-800">
        <CardHeader className="flex flex-row items-center justify-content-between">
          <CardTitle className="text-lg">Chat</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
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
          <ScrollArea className="h-[400px] pr-2">
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
        <CardFooter className="p-3 border-t dark:border-gray-700">
          <form onSubmit={handleSubmit} className="flex w-full gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your query...."
              className="flex-1"
            />
            <Button type="submit" disabled={isLoading}>
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
          </form>
        </CardFooter>
      </Card>
    </div>
  );
};

export default ChatBox;
