import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import {
  X,
  Copy,
  Check,
  Link as LinkIcon,
  Loader2,
  Trash2,
  Clock,
  Users,
} from "lucide-react";

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
          maxWidth: "450px",
          color: "white",
          boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
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
              fontSize: "20px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <Users size={20} color="#6366f1" />
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

        {/* Skapa ny länk sektion */}
        <div
          style={{
            background: "#2a2a30",
            padding: "16px",
            borderRadius: "12px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <label
            style={{ fontSize: "12px", color: "#aaa", fontWeight: "bold" }}
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
                  padding: "8px",
                  borderRadius: "8px",
                  border:
                    duration === opt ? "1px solid #6366f1" : "1px solid #444",
                  background:
                    duration === opt ? "rgba(99, 102, 241, 0.1)" : "#333",
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
              padding: "10px",
              background: "#6366f1",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            {loading ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <>
                <LinkIcon size={16} /> Skapa inbjudningslänk
              </>
            )}
          </button>
        </div>

        {/* Lista över aktiva länkar */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <label
            style={{ fontSize: "12px", color: "#aaa", fontWeight: "bold" }}
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
                    background: "#111",
                    padding: "10px",
                    borderRadius: "8px",
                    border: "1px solid #333",
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
                      <Clock size={12} color="#888" />
                      {formatExpiry(invite.expires_at)}
                    </div>
                    <span style={{ fontSize: "11px", color: "#666" }}>
                      Roll: {invite.role}
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={() => copyToClipboard(invite.token, invite.id)}
                      title="Kopiera länk"
                      style={{
                        background: copiedId === invite.id ? "#10b981" : "#333",
                        border: "none",
                        borderRadius: "6px",
                        width: "32px",
                        height: "32px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        color: "white",
                        transition: "background 0.2s",
                      }}
                    >
                      {copiedId === invite.id ? (
                        <Check size={18} color="#ffffff" />
                      ) : (
                        <Copy size={18} color="#ffffff" />
                      )}
                    </button>
                    <button
                      onClick={() => revokeInvite(invite.id)}
                      title="Återkalla (ta bort)"
                      style={{
                        background: "rgba(239, 68, 68, 0.1)",
                        border: "1px solid rgba(239, 68, 68, 0.3)",
                        borderRadius: "6px",
                        width: "40px",
                        height: "40px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        color: "#ef4444",
                      }}
                    >
                      <Trash2 size={20} style={{ stroke: "#ef4444" }} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
