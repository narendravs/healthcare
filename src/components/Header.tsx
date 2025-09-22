"use client";
import { useState, ChangeEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import ChatBox from "@/components/chat/ChatBox";
const Header = () => {
  const [open, setOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const type = "documents";
  const handleUploadFile = async () => {
    if (!selectedFile) {
      alert("Please select a file first.");
      return;
    }
    try {
      const formdata = new FormData();
      formdata.append("file", selectedFile);
      const res = await fetch("/api/embeddings/services", {
        method: "POST",
        body: formdata,
      });
      if (res.ok) {
        //Find the input value by its Id and reset its value to empty, to get rid of the selected file
        const fileInput = document.getElementById(
          "file-input"
        ) as HTMLInputElement;
        if (fileInput) {
          fileInput.value = "";
        }
        const data = await res.json();
        alert(data.message);
        setSelectedFile(null);
      } else {
        alert("Upload failed. Please try again.");
        setSelectedFile(null);
      }
    } catch (error) {
      console.error("Upload failed", error);
    }
  };
  const onChangeHandle = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
    if (file) {
      setSelectedFile(file);
      alert(`File selected: ${file.name}. Click 'Upload File' to proceed.`);
    } else {
      setSelectedFile(null);
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
      <div className="flex flex-row items-center justify-content-center gap-2">
        <input
          id="file-input"
          type="file"
          name="file"
          onChange={onChangeHandle}
          className="hidden"
        />
        <label
          htmlFor="file-input"
          className="inline-flex items-center gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-slate-700 hover:bg-slate-100 cursor-pointer"
        >
          <Upload className="h-4 w-4" />
          Choose file
        </label>
        <span className="text-sm text-slate-600 truncate max-w-[25%]">
          {selectedFile ? selectedFile.name : "No file chosen"}
        </span>
        <Button
          onClick={handleUploadFile}
          disabled={!selectedFile}
          className="ml-2 whitespace-nowrap cursor-pointer"
        >
          Upload File
        </Button>
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
