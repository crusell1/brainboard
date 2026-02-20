import { AlertTriangle } from "lucide-react";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Bekräfta",
  cancelText = "Avbryt",
  isDanger = false,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
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
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: isDanger
                ? "rgba(239, 68, 68, 0.1)"
                : "rgba(99, 102, 241, 0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <AlertTriangle size={20} color={isDanger ? "#ef4444" : "#6366f1"} />
          </div>
          <h3
            style={{
              margin: 0,
              color: "white",
              fontSize: "18px",
              fontWeight: 600,
            }}
          >
            {title}
          </h3>
        </div>

        <p
          style={{
            margin: 0,
            color: "#ccc",
            fontSize: "14px",
            lineHeight: "1.5",
          }}
        >
          {message}
        </p>

        <div
          style={{
            display: "flex",
            gap: "12px",
            justifyContent: "flex-end",
            marginTop: "8px",
          }}
        >
          <button
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
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            style={{
              padding: "8px 20px",
              borderRadius: "8px",
              background: isDanger ? "#ef4444" : "#6366f1",
              border: "none",
              color: "white",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: 600,
              boxShadow: isDanger
                ? "0 4px 12px rgba(239, 68, 68, 0.3)"
                : "0 4px 12px rgba(99, 102, 241, 0.3)",
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
