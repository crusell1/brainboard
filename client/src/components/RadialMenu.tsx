import React, { useState, useEffect } from "react";
import {
  Type,
  Image as ImageIcon,
  Pencil,
  Mic,
  Sparkles,
  X,
  ArrowLeft,
  FileText,
  Lightbulb,
  Tags,
  AlignLeft,
  Link,
  Upload,
} from "lucide-react";

type RadialMenuProps = {
  x: number;
  y: number;
  isOpen: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
};

type MenuItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  action?: () => void; // Om definierad, körs denna istället för onSelect
};

export default function RadialMenu({
  x,
  y,
  isOpen,
  onClose,
  onSelect,
}: RadialMenuProps) {
  const [level, setLevel] = useState<"main" | "ai" | "image">("main");
  const [isClosing, setIsClosing] = useState(false);

  // Återställ till huvudmenyn varje gång menyn öppnas på nytt
  useEffect(() => {
    if (isOpen) {
      setLevel("main");
      setIsClosing(false);
    }
  }, [isOpen]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 200);
  };

  // Definition av huvudmenyn
  const mainActions: MenuItem[] = [
    { id: "node", label: "Notis", icon: <Type size={24} />, color: "#6366f1" },
    {
      id: "image",
      label: "Bild",
      icon: <ImageIcon size={24} />,
      color: "#10b981",
      action: () => setLevel("image"), // Öppna undermeny för bild
    },
    {
      id: "draw",
      label: "Rita",
      icon: <Pencil size={24} />,
      color: "#f59e0b",
    },
    { id: "voice", label: "Röst", icon: <Mic size={24} />, color: "#ef4444" },
    {
      id: "ai",
      label: "AI",
      icon: <Sparkles size={24} />,
      color: "#8b5cf6",
      action: () => setLevel("ai"), // Öppna undermeny
    },
  ];

  // Definition av AI-undermenyn
  const aiActions: MenuItem[] = [
    {
      id: "ai-summary",
      label: "Sammanfatta",
      icon: <FileText size={24} />,
      color: "#8b5cf6",
    },
    {
      id: "ai-idea",
      label: "Ny Idé",
      icon: <Lightbulb size={24} />,
      color: "#eab308",
    },
    {
      id: "ai-tags",
      label: "Föreslå Taggar",
      icon: <Tags size={24} />,
      color: "#ec4899",
    },
    {
      id: "ai-organize",
      label: "Strukturera",
      icon: <AlignLeft size={24} />,
      color: "#3b82f6",
    },
  ];

  // Definition av bild-undermenyn
  const imageActions: MenuItem[] = [
    {
      id: "image-upload",
      label: "Ladda upp",
      icon: <Upload size={24} />,
      color: "#10b981",
    },
    {
      id: "image-url",
      label: "Länk",
      icon: <Link size={24} />,
      color: "#3b82f6",
    },
  ];

  let currentActions = mainActions;
  if (level === "ai") currentActions = aiActions;
  if (level === "image") currentActions = imageActions;

  const radius = 80; // Avstånd från mitten

  if (!isOpen && !isClosing) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none", // Låt klick gå igenom bakgrunden
        zIndex: 2000,
        overflow: "hidden",
      }}
    >
      {/* Meny-container centrerad på klicket */}
      <div
        style={{
          position: "absolute",
          left: x,
          top: y,
          width: 0,
          height: 0,
          pointerEvents: "auto", // Fånga klick på själva menyn
        }}
      >
        {/* Cirkulära knappar */}
        {currentActions.map((item, index) => {
          const total = currentActions.length;
          // Börja på -90 grader (klockan 12)
          const angle = (index * (360 / total) - 90) * (Math.PI / 180);
          const itemX = Math.cos(angle) * radius;
          const itemY = Math.sin(angle) * radius;

          return (
            <button
              key={item.id}
              onMouseDown={(e) => {
                e.stopPropagation(); // 🔥 FIX: Stoppa eventuella drag-events som stjäl fokus
                e.preventDefault(); // 🔥 FIX: Förhindra att knappen stjäl fokus (vilket orsakar onBlur på editorn senare)
              }}
              onClick={(e) => {
                e.stopPropagation(); // 🔥 FIX: Stoppa klicket från att bubbla upp till canvas
                if (item.action) {
                  item.action();
                } else {
                  onSelect(item.id);
                }
              }}
              title={item.label}
              style={{
                position: "absolute",
                transform: `translate(${itemX}px, ${itemY}px) translate(-50%, -50%) scale(${
                  isClosing ? 0 : 1
                })`,
                transition: `transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) ${
                  index * 0.05
                }ms`,
                width: 56,
                height: 56,
                borderRadius: "50%",
                border: "none",
                background: "#222",
                color: item.color,
                boxShadow: `0 0 0 2px ${item.color}, 0 4px 12px rgba(0,0,0,0.5)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              {item.icon}
            </button>
          );
        })}

        {/* Central Stäng/Tillbaka-knapp */}
        <button
          onClick={level === "main" ? handleClose : () => setLevel("main")}
          style={{
            position: "absolute",
            transform: "translate(-50%, -50%)",
            width: 40,
            height: 40,
            borderRadius: "50%",
            border: "none",
            background: "#333",
            color: "#fff",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            zIndex: 10,
          }}
        >
          {level === "main" ? <X size={20} /> : <ArrowLeft size={20} />}
        </button>
      </div>
    </div>
  );
}
