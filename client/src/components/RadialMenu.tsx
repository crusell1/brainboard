import { useEffect, useState } from "react";
import {
  Type,
  Image as ImageIcon,
  Link as LinkIcon,
  Mic,
  Timer,
  X,
  Youtube,
  CheckSquare, // 🔥 FIX: Importera ikonen
} from "lucide-react";

interface RadialMenuProps {
  x: number;
  y: number;
  isOpen: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
}

export default function RadialMenu({
  x,
  y,
  isOpen,
  onClose,
  onSelect,
}: RadialMenuProps) {
  const [visible, setVisible] = useState(false);
  const [hoveredOption, setHoveredOption] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setVisible(true);
    } else {
      const timer = setTimeout(() => setVisible(false), 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!visible && !isOpen) return null;

  // Alternativ i menyn
  const options = [
    { id: "node", Icon: Type, label: "Text", color: "#6366f1" },
    {
      id: "checklist", // 🔥 FIX: Lägg till Checklist-alternativet
      Icon: CheckSquare,
      label: "Checklista",
      color: "#84cc16",
    },
    {
      id: "image-upload",
      Icon: ImageIcon,
      label: "Bild",
      color: "#10b981",
    },
    {
      id: "link",
      Icon: LinkIcon,
      label: "Länk",
      color: "#3b82f6",
    },
    { id: "voice", Icon: Mic, label: "Röst", color: "#f43f5e" },
    {
      id: "pomodoro",
      Icon: Timer,
      label: "Fokus",
      color: "#f59e0b",
    },
    {
      id: "youtube",
      Icon: Youtube,
      label: "Video",
      color: "#ff0000",
    },
  ];

  const radius = 70; // Radie för cirkeln
  const startAngle = -90; // Starta klockan 12
  const angleStep = 360 / options.length;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none", // Låt klick gå igenom bakgrunden
        zIndex: 9999,
        overflow: "hidden",
      }}
    >
      {/* Mörk bakgrund (overlay) */}
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          background: "rgba(0,0,0,0.3)",
          opacity: isOpen ? 1 : 0,
          transition: "opacity 0.2s",
          pointerEvents: isOpen ? "auto" : "none",
        }}
      />

      {/* Meny-container */}
      <div
        style={{
          position: "absolute",
          left: x,
          top: y,
          width: 0,
          height: 0,
          overflow: "visible",
          transform: `scale(${isOpen ? 1 : 0.8})`,
          opacity: isOpen ? 1 : 0,
          transition: "all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
          zIndex: 10000,
        }}
      >
        {/* Stäng-knapp i mitten */}
        <button
          onClick={onClose}
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: "#1e1e24",
            border: "2px solid #333",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            pointerEvents: "auto",
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 10,
            boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
            padding: 0, // 🔥 FIX: Säkerställ att ikonen är centrerad
          }}
        >
          <X size={20} color="white" strokeWidth={1} />
        </button>

        {/* Cirkulära knappar */}
        {options.map((opt, index) => {
          const angle = (startAngle + index * angleStep) * (Math.PI / 180);
          // Beräkna position för knappen
          const btnX = Math.cos(angle) * radius;
          const btnY = Math.sin(angle) * radius;

          const Icon = opt.Icon;
          const isHovered = hoveredOption === opt.id;

          return (
            <div
              key={opt.id}
              onMouseEnter={() => setHoveredOption(opt.id)}
              onMouseLeave={() => setHoveredOption(null)}
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: `translate(calc(-50% + ${btnX}px), calc(-50% + ${btnY}px))`,
                pointerEvents: "auto",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                zIndex: isHovered ? 100 : 1, // 🔥 FIX: Lyft upp vid hover så texten syns över andra knappar
              }}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log("RadialMenu: Valde", opt.id);
                  onSelect(opt.id);
                }}
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: "50%",
                  background: "#2a2a30",
                  border: `2px solid ${opt.color}`,
                  color: opt.color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
                  transition: "transform 0.1s",
                  padding: 0, // 🔥 FIX: Säkerställ att ikonen är centrerad
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.transform = "scale(1.1)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.transform = "scale(1)")
                }
              >
                <Icon size={24} color={opt.color} strokeWidth={1} />
              </button>
              <span
                style={{
                  position: "absolute", // 🔥 FIX: Gör texten absolut så den inte påverkar centreringen av knappen
                  top: "100%", // Placera under knappen
                  marginTop: 8,
                  fontSize: 10,
                  fontWeight: 600,
                  color: "white",
                  textShadow: "0 1px 2px black",
                  background: "rgba(0,0,0,0.5)",
                  padding: "2px 4px",
                  borderRadius: 4,
                  opacity: isHovered ? 1 : 0, // Visa bara vid hover
                  transition: "opacity 0.2s",
                  whiteSpace: "nowrap",
                }}
              >
                {opt.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
