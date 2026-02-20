import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Link as LinkIcon, Image as ImageIcon } from "lucide-react";

interface ImageUrlModalProps {
  onConfirm: (url: string) => void;
  onClose: () => void;
  title?: string; // Möjlighet att ändra rubrik (t.ex. "Infoga länk")
  placeholder?: string;
}

export default function ImageUrlModal({
  onConfirm,
  onClose,
  title = "Infoga bild från URL",
  placeholder = "https://exempel.se/bild.png",
}: ImageUrlModalProps) {
  const [url, setUrl] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Fokusera input direkt
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (url.trim()) {
      onConfirm(url.trim());
      onClose();
    }
  };

  return createPortal(
    <div
      className="nodrag"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(4px)",
        zIndex: 5000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#1e1e24",
          border: "1px solid #333",
          borderRadius: "16px",
          padding: "24px",
          width: "90%",
          maxWidth: "400px",
          boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          animation: "fadeIn 0.2s ease-out",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "8px",
          }}
        >
          <h3
            style={{
              margin: 0,
              color: "white",
              fontSize: "18px",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            {title.includes("länk") ? (
              <LinkIcon size={20} color="#6366f1" />
            ) : (
              <ImageIcon size={20} color="#6366f1" />
            )}
            {title}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#888",
              cursor: "pointer",
              padding: "4px",
              display: "flex",
            }}
          >
            <X size={20} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "16px" }}
        >
          <input
            ref={inputRef}
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={placeholder}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "8px",
              background: "#111",
              border: "1px solid #444",
              color: "white",
              fontSize: "16px",
              outline: "none",
              boxSizing: "border-box",
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
            }}
          />

          <div
            style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                background: "transparent",
                border: "1px solid #444",
                color: "#ccc",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: 500,
              }}
            >
              Avbryt
            </button>
            <button
              type="submit"
              disabled={!url.trim()}
              style={{
                padding: "8px 20px",
                borderRadius: "8px",
                background: url.trim() ? "#6366f1" : "#333",
                border: "none",
                color: url.trim() ? "white" : "#777",
                cursor: url.trim() ? "pointer" : "not-allowed",
                fontSize: "14px",
                fontWeight: 600,
                transition: "background 0.2s",
              }}
            >
              Infoga
            </button>
          </div>
        </form>
      </div>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>,
    document.body,
  );
}
