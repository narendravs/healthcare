import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import ReactMarkdown from "react-markdown"; // 🟩 Added Markdown Parser

type chatMessageProps = {
  key: number;
  message: { role: string; content: string };
};
const ChatMessage = ({ message }: chatMessageProps) => {
  const isUser = message.role === "user";
  const avatar = isUser ? "You" : "Bot";

  return (
    <div
      className={`flex gap-3 my-2 ${isUser ? "justify-end" : "justify-start"}`}
    >
      {!isUser && (
        <Avatar>
          <AvatarFallback>AI</AvatarFallback>
        </Avatar>
      )}
      <div
        className={`p-3 rounded-lg max-w-[75%] text-md break-words ${
          isUser
            ? "bg-blue-500 text-white"
            : "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100"
        }`}
      >
        <div className="prose dark:prose-invert prose-xs max-w-none 
            prose-p:my-0 
            prose-p:py-0 
            prose-p:leading-normal"
          >
          <ReactMarkdown>
          {message.content}
          </ReactMarkdown>
          </div>
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
