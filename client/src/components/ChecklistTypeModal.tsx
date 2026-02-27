import { X, ListTodo, CalendarClock } from "lucide-react";

type ChecklistTypeModalProps = {
  onSelect: (type: "regular" | "daily") => void;
  onClose: () => void;
};

export default function ChecklistTypeModal({
  onSelect,
  onClose,
}: ChecklistTypeModalProps) {
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
        zIndex: 3000,
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
          maxWidth: "320px",
          boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h3 style={{ margin: 0, color: "white", fontSize: "18px" }}>
            Välj typ av lista
          </h3>
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

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <button
            onClick={() => onSelect("regular")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "16px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "12px",
              color: "white",
              cursor: "pointer",
              textAlign: "left",
              transition: "background 0.2s",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "rgba(255,255,255,0.1)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "rgba(255,255,255,0.05)")
            }
          >
            <div
              style={{
                background: "#84cc16",
                padding: "8px",
                borderRadius: "8px",
                color: "#000",
              }}
            >
              <ListTodo size={20} />
            </div>
            <div>
              <div style={{ fontWeight: "bold", fontSize: "15px" }}>
                Vanlig checklista
              </div>
              <div style={{ fontSize: "12px", color: "#888" }}>
                Tom lista för egna punkter
              </div>
            </div>
          </button>

          <button
            onClick={() => onSelect("daily")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "16px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "12px",
              color: "white",
              cursor: "pointer",
              textAlign: "left",
              transition: "background 0.2s",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "rgba(255,255,255,0.1)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "rgba(255,255,255,0.05)")
            }
          >
            <div
              style={{
                background: "#3b82f6",
                padding: "8px",
                borderRadius: "8px",
                color: "#000",
              }}
            >
              <CalendarClock size={20} />
            </div>
            <div>
              <div style={{ fontWeight: "bold", fontSize: "15px" }}>
                Dagsplanering
              </div>
              <div style={{ fontSize: "12px", color: "#888" }}>
                06:00 - 23:00
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
