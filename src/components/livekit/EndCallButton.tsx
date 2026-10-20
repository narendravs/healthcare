"use client";
import { createPortal } from "react-dom";

export default function EndCallButton({ onClick }: { onClick: () => void }) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <button
      type="button"
      onClick={onClick}
      aria-label="End call and close"
      style={{
        position: "fixed",
        top: "max(16px, env(safe-area-inset-top))",
        right: "16px",
        zIndex: 2147483647, // above everything
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "10px 16px",
        borderRadius: "9999px",
        border: "2px solid #ffffff",
        background: "#dc2626",
        color: "#ffffff",
        fontSize: "14px",
        fontWeight: 600,
        cursor: "pointer",
        boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
      }}
    >
      ✕ End call
    </button>,
    document.body
  );
}


