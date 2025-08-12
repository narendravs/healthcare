import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
        className={`p-3 rounded-lg max-w-[70%] ${
          isUser
            ? "bg-blue-500 text-white"
            : "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100"
        }`}
      >
        {message.content}
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
