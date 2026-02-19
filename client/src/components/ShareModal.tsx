import { useState } from "react";
import { supabase } from "../lib/supabase";
import { X, Copy, Check, Link as LinkIcon, Loader2 } from "lucide-react";

type ShareModalProps = {
  boardId: string;
  onClose: () => void;
};

export default function ShareModal({ boardId, onClose }: ShareModalProps) {
  const [duration, setDuration] = useState<"1h" | "24h" | "forever">("1h");
  const [generatedLink, setGeneratedLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const generateLink = async () => {
    setLoading(true);
    try {
      let expiresAt = null;
      const now = new Date();

      if (duration === "1h") {
        expiresAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
      } else if (duration === "24h") {
        expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
      }

      // Skapa inbjudan i databasen
      const { data, error } = await supabase
        .from("board_invites")
        .insert({
          board_id: boardId,
          expires_at: expiresAt,
          role: "viewer", // Eller 'editor' om du vill tillåta redigering direkt
        })
        .select("token")
        .single();

      if (error) throw error;

      if (data) {
        // Skapa den fullständiga länken
        const url = `${window.location.origin}?token=${data.token}`;
        setGeneratedLink(url);
      }
    } catch (err: any) {
      console.error("Error generating link:", err);
      alert("Kunde inte skapa länk: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 3000,
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
          width: "100%",
          maxWidth: "400px",
          color: "white",
          boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: "20px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <LinkIcon size={20} color="#6366f1" />
            Dela Board
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#888",
              cursor: "pointer",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {!generatedLink ? (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "16px" }}
          >
            <p style={{ margin: 0, color: "#aaa", fontSize: "14px" }}>
              Välj hur länge länken ska vara giltig:
            </p>
            <div style={{ display: "flex", gap: "8px" }}>
              {(["1h", "24h", "forever"] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setDuration(opt)}
                  style={{
                    flex: 1,
                    padding: "10px",
                    borderRadius: "8px",
                    border:
                      duration === opt ? "1px solid #6366f1" : "1px solid #333",
                    background:
                      duration === opt ? "rgba(99, 102, 241, 0.1)" : "#2a2a30",
                    color: duration === opt ? "#fff" : "#888",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: 500,
                  }}
                >
                  {opt === "1h" ? "1 Timme" : opt === "24h" ? "1 Dygn" : "Evig"}
                </button>
              ))}
            </div>

            <button
              onClick={generateLink}
              disabled={loading}
              style={{
                marginTop: "8px",
                padding: "12px",
                background: "#6366f1",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontSize: "16px",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              {loading ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                "Skapa länk"
              )}
            </button>
          </div>
        ) : (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}
          >
            <p style={{ margin: 0, color: "#aaa", fontSize: "14px" }}>
              Här är din inbjudningslänk:
            </p>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                readOnly
                value={generatedLink}
                style={{
                  flex: 1,
                  background: "#111",
                  border: "1px solid #333",
                  borderRadius: "8px",
                  padding: "10px",
                  color: "#fff",
                  outline: "none",
                }}
              />
              <button
                onClick={copyToClipboard}
                style={{
                  background: copied ? "#10b981" : "#333",
                  border: "none",
                  borderRadius: "8px",
                  width: "44px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "white",
                  transition: "background 0.2s",
                }}
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
              </button>
            </div>
            <p style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>
              {duration === "forever"
                ? "Länken går aldrig ut."
                : `Länken slutar fungera om ${duration}.`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
