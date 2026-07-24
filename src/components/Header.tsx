"use client";
import { useState, ChangeEvent, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import ChatBox from "@/components/chat/ChatBox";
import { toast } from "sonner";
const Header = () => {
  const [open, setOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // 🌟 Initialize the file input ref correctly
  const fileInputRef = useRef<HTMLInputElement>(null);

  const type = "documents";
  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;

    if (!file) {
      toast.error("Selection Cancelled", {
        description: "Please select a valid file to upload.",
      });
      return;
    }
    setIsProcessing(true);

    toast.info("Uploading file...", {
      description: `Sending ${file.name} to the processing server.`,
    });

    const formData = new FormData();
    formData.append("file", file);
    try {
      const response = await fetch("/api/embeddings/services", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        // Success response from your updated non-blocking route handler
        toast.success("Upload Successful! 🎉", {
          description: data.message,
        });
      } else {
        toast.error("Upload Failed", {
          description: data.message || "An unexpected error occurred.",
        });
      }
    } catch (error) {
      console.error("Network error during upload:", error);
      toast.error("Network Error", {
        description: "Could not establish a connection to the server.",
      });
    } finally {
      setIsProcessing(false);
      // 🌟 Safely clear the HTML input node value via ref so the user can re-select the file later
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const openChat = () => {
    setOpen(true);
  };
  const closeChat = () => {
    setOpen(false);
  };
  return (
    <header className="admin-header rounded-b-lg">
      <Link href="/" className="cursor-pointer">
        <Image
          src="/assets/icons/logo-full.svg"
          height={32}
          width={162}
          alt="logo"
          // className="h-8 w-fit"
        />
      </Link>
      <div className="justify-content-center hidden flex-row items-center gap-2 sm:flex">
        <input
          ref={fileInputRef}
          id="file-input"
          type="file"
          name="file"
          onChange={handleFileChange}
          className="hidden"
        />
        <label
          htmlFor="file-input"
          className={`inline-flex items-center gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-slate-700 transition-all ${
            isProcessing ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-slate-100"
          }`}
        >
          {isProcessing ? (
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {isProcessing ? "Processing..." : "Choose file"}
        </label>
      </div>

      <Button onClick={openChat}>
        <div className="flex flex-row items-center gap-2">
          <p className="">Hey! Chat about uploaded documents?</p>
          <Image
            src="/chat-svgrepo-com.svg"
            alt="chat box"
            width={24}
            height={24}
            className="cursor-pointer"
          />
        </div>
      </Button>
      {open && <ChatBox onClose={closeChat} type={type} />}
      <p className="text-16-semibold">Admin Dashboard</p>
    </header>
  );
};
export default Header;
