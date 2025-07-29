"use client";
import { useEffect } from "react";

export default function ClearAccessKey() {
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("accessKey");
    }
  }, []);
  return null;
}
