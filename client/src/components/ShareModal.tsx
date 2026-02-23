import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Loader2 } from "lucide-react";

type ShareModalProps = {
  boardId: string;
  onClose: () => void;
};

type Invite = {
  id: string;
  token: string;
  expires_at: string | null;
  role: string;
  created_at: string;
};

export default function ShareModal({ boardId, onClose }: ShareModalProps) {
  const [duration, setDuration] = useState<"1h" | "24h" | "forever">("1h");
  const [loading, setLoading] = useState(false);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Hämta aktiva inbjudningar vid start
  useEffect(() => {
    fetchInvites();
  }, [boardId]);

  const fetchInvites = async () => {
    const { data, error } = await supabase
      .from("board_invites")
      .select("*")
      .eq("board_id", boardId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching invites:", error);
    } else {
      // Filtrera bort utgångna länkar i frontend för tydlighet (eller visa dem som inaktiva)
      const activeInvites = (data as Invite[]).filter((invite) => {
        if (!invite.expires_at) return true; // Evig
        return new Date(invite.expires_at) > new Date();
      });
      setInvites(activeInvites);
    }
  };

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
      const { error } = await supabase.from("board_invites").insert({
        board_id: boardId,
        expires_at: expiresAt,
        role: "editor", // 🔥 Sätt rollen till editor enligt önskemål
      });

      if (error) throw error;

      // Uppdatera listan
      await fetchInvites();
    } catch (err: any) {
      console.error("Error generating link:", err);
      alert("Kunde inte skapa länk: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const revokeInvite = async (inviteId: string) => {
    const { error } = await supabase
      .from("board_invites")
      .delete()
      .eq("id", inviteId);

    if (error) {
      alert("Kunde inte återkalla länk.");
    } else {
      setInvites((prev) => prev.filter((i) => i.id !== inviteId));
    }
  };

  const copyToClipboard = (token: string, id: string) => {
    const url = `${window.location.origin}?token=${token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatExpiry = (dateString: string | null) => {
    if (!dateString) return "Går aldrig ut";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffHrs = Math.ceil(diffMs / (1000 * 60 * 60));

    if (diffHrs < 1) return "< 1 timme kvar";
    if (diffHrs < 24) return `${diffHrs} timmar kvar`;
    return date.toLocaleDateString();
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 3000,
        animation: "fadeIn 0.2s ease-out",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "linear-gradient(145deg, #1e1e24, #1a1a20)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "24px",
          padding: "32px",
          width: "100%",
          maxWidth: "480px",
          color: "white",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          display: "flex",
          flexDirection: "column",
          gap: "24px",
          animation: "scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: "24px",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: "12px",
              background: "linear-gradient(to right, #fff, #a5b4fc)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#6366f1"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            Dela Board
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "none",
              borderRadius: "50%",
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ccc",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "rgba(255,255,255,0.1)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "rgba(255,255,255,0.05)")
            }
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#cccccc"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Skapa ny länk sektion */}
        <div
          style={{
            background: "rgba(0,0,0,0.2)",
            padding: "20px",
            borderRadius: "16px",
            border: "1px solid rgba(255,255,255,0.05)",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <label
            style={{
              fontSize: "11px",
              color: "#818cf8",
              fontWeight: "700",
              letterSpacing: "0.5px",
              textTransform: "uppercase",
            }}
          >
            SKAPA NY LÄNK
          </label>
          <div style={{ display: "flex", gap: "8px" }}>
            {(["1h", "24h", "forever"] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => setDuration(opt)}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: "10px",
                  border:
                    duration === opt
                      ? "1px solid #6366f1"
                      : "1px solid rgba(255,255,255,0.1)",
                  background:
                    duration === opt
                      ? "rgba(99, 102, 241, 0.2)"
                      : "rgba(255,255,255,0.05)",
                  color: duration === opt ? "#fff" : "#888",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: 500,
                  transition: "all 0.2s",
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
              padding: "12px",
              background: "#6366f1",
              color: "white",
              border: "none",
              borderRadius: "10px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              transition: "background 0.2s",
              boxShadow: "0 4px 12px rgba(99, 102, 241, 0.3)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#4f46e5")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#6366f1")}
          >
            {loading ? (
              <Loader2 className="animate-spin" size={16} color="white" />
            ) : (
              <>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                </svg>{" "}
                Skapa inbjudningslänk
              </>
            )}
          </button>
        </div>

        {/* Lista över aktiva länkar */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <label
            style={{
              fontSize: "11px",
              color: "#aaa",
              fontWeight: "700",
              letterSpacing: "0.5px",
              textTransform: "uppercase",
            }}
          >
            AKTIVA LÄNKAR ({invites.length})
          </label>

          {invites.length === 0 ? (
            <p style={{ fontSize: "13px", color: "#666", fontStyle: "italic" }}>
              Inga aktiva länkar just nu.
            </p>
          ) : (
            <div
              style={{
                maxHeight: "200px",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              {invites.map((invite) => (
                <div
                  key={invite.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "rgba(0,0,0,0.3)",
                    padding: "12px",
                    borderRadius: "12px",
                    border: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "2px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "13px",
                        color: "#fff",
                      }}
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#888"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                      </svg>
                      {formatExpiry(invite.expires_at)}
                    </div>
                    <span style={{ fontSize: "11px", color: "#666" }}>
                      Behörighet:{" "}
                      <span style={{ color: "#ccc" }}>{invite.role}</span>
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={() => copyToClipboard(invite.token, invite.id)}
                      title="Kopiera länk"
                      style={{
                        background:
                          copiedId === invite.id
                            ? "#10b981"
                            : "rgba(255,255,255,0.1)",
                        border: "none",
                        borderRadius: "8px",
                        width: "36px",
                        height: "36px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        color: "white",
                        transition: "background 0.2s",
                      }}
                    >
                      {copiedId === invite.id ? (
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="white"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      ) : (
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="white"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect
                            x="9"
                            y="9"
                            width="13"
                            height="13"
                            rx="2"
                            ry="2"
                          ></rect>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                      )}
                    </button>
                    <button
                      onClick={() => revokeInvite(invite.id)}
                      title="Återkalla (ta bort)"
                      style={{
                        background: "rgba(239, 68, 68, 0.1)",
                        border: "1px solid rgba(239, 68, 68, 0.3)",
                        borderRadius: "8px",
                        width: "36px",
                        height: "36px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        color: "#ef4444",
                      }}
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#ef4444"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleUp {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
