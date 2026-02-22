import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  Handle,
  Position,
  NodeResizer,
  useNodeConnections,
  useUpdateNodeInternals,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import RichTextEditor from "../components/RichTextEditor";
import { supabase } from "../lib/supabase";
import { Sparkles, Loader2, Tag, Plus, X, Wand2, FileText } from "lucide-react";
import { BaseNode } from "../components/BaseNode";

export type NoteData = {
  title?: string;
  label: string;
  isEditing?: boolean;
  startListening?: boolean;
  tags?: string[];
  aiTags?: string[]; // 🔥 NY: AI-genererade taggar
  summary?: string; // 🔥 NY: AI-sammanfattning
  isProcessing?: boolean;
  onMagic?: (nodeId: string, action: "organize" | "analyze") => void;
  onTagsChange?: (nodeId: string, tags: string[]) => void;
  onAiTagsChange?: (nodeId: string, tags: string[]) => void;
  onSummaryChange?: (nodeId: string, summary: string) => void;
  onChange: (nodeId: string, value: string) => void;
  onStopEditing: (nodeId: string) => void;
  onStartEditing: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
  onResize?: (
    nodeId: string,
    width: number,
    height: number,
    x?: number,
    y?: number,
  ) => void;
  onResizeStart?: (nodeId: string) => void; // 🔥 NY: För att låsa noden vid resize
  onResizeEnd?: (
    nodeId: string,
    width: number,
    height: number,
    x?: number,
    y?: number,
  ) => void;
  onColorChange?: (nodeId: string, color: string) => void;
  onTitleChange?: (nodeId: string, title: string) => void;
  searchTerm?: string; // Ny prop för sökning
  isMatch?: boolean;
  isConnected?: boolean;
  color?: string;
};

export type NoteNodeType = Node<NoteData, "note">;

const COLORS = [
  "#f1f1f1",
  "#ffef9e",
  "#ffc4c4",
  "#b8e6ff",
  "#b5ffc6",
  "#e7c6ff",
  "#ffd8b1",
];

const DEFAULT_TAGS = [
  "skola",
  "fritid",
  "spel",
  "träning",
  "mat",
  "arbete",
  "idé",
  "viktigt",
];

const TAG_COLORS = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#84cc16",
  "#10b981",
  "#06b6d4",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#d946ef",
  "#f43f5e",
];

const getTagColor = (tag: string) => {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % TAG_COLORS.length;
  return TAG_COLORS[index];
};

// Helper component that only shows the handle if selected or connected
const SmartHandle = ({
  id,
  type,
  position,
  style,
  selected,
}: {
  id: string;
  type: "source" | "target";
  position: Position;
  style?: React.CSSProperties;
  selected?: boolean;
}) => {
  const sourceConnections = useNodeConnections({
    handleType: "source",
    handleId: id,
  });
  const targetConnections = useNodeConnections({
    handleType: "target",
    handleId: id,
  });
  const isConnected =
    sourceConnections.length > 0 || targetConnections.length > 0;
  const isVisible = selected || isConnected;

  return (
    <Handle
      id={id}
      type={type}
      position={position}
      style={{
        ...style,
        opacity: isVisible ? 1 : 0,
        pointerEvents: isVisible ? "all" : "none",
      }}
    />
  );
};

export default function NoteNode({
  id,
  data,
  selected,
}: NodeProps<NoteNodeType>) {
  const updateNodeInternals = useUpdateNodeInternals();
  const [value, setValue] = useState(data.label ?? "");
  const [title, setTitle] = useState(data.title ?? "");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null); // 🔥 NY: Wrapper för att mäta innehåll säkert
  const [showTagMenu, setShowTagMenu] = useState(false);
  const [showMagicMenu, setShowMagicMenu] = useState(false);
  const [customTag, setCustomTag] = useState("");
  const isResizingRef = useRef(false); // 🔥 Håll koll på om vi drar manuellt
  const [dynamicMinHeight, setDynamicMinHeight] = useState(150); // 🔥 Håll koll på innehållets höjd

  const toggleTag = (tag: string) => {
    const currentTags = data.tags || [];
    let newTags;
    if (currentTags.includes(tag)) {
      newTags = currentTags.filter((t) => t !== tag);
    } else {
      newTags = [...currentTags, tag];
    }
    data.onTagsChange?.(id, newTags);
  };

  const addCustomTag = () => {
    if (!customTag.trim()) return;
    const currentTags = data.tags || [];
    if (!currentTags.includes(customTag.trim())) {
      data.onTagsChange?.(id, [...currentTags, customTag.trim()]);
    }
    setCustomTag("");
  };

  const approveAiTag = (tag: string) => {
    const currentTags = data.tags || [];
    const currentAiTags = data.aiTags || [];

    // 1. Lägg till i vanliga taggar (om den inte redan finns)
    if (!currentTags.includes(tag)) {
      data.onTagsChange?.(id, [...currentTags, tag]);
    }

    // 2. Ta bort från AI-taggar
    const newAiTags = currentAiTags.filter((t) => t !== tag);
    data.onAiTagsChange?.(id, newAiTags);
  };

  const deleteAiTag = (tag: string) => {
    const currentAiTags = data.aiTags || [];
    const newAiTags = currentAiTags.filter((t) => t !== tag);
    data.onAiTagsChange?.(id, newAiTags);
  };

  // Spara onResize i en ref för att kunna använda den i useEffect utan att skapa loopar
  const onResizeRef = useRef(data.onResize);
  useEffect(() => {
    onResizeRef.current = data.onResize;
  }, [data.onResize]);

  // 🔥 NY: Uppdatera handles när storleken ändras (viktigt för realtid/edges)
  useEffect(() => {
    requestAnimationFrame(() => {
      updateNodeInternals(id);
    });
  }, [id, updateNodeInternals]);

  useEffect(() => {
    // 🔥 FIX: Uppdatera bara värdet från props om vi INTE redigerar själva.
    // Detta förhindrar att "gammal" data från React-state skriver över det vi nyss skrev (lagget).
    if (!data.isEditing) {
      setValue(data.label ?? "");
    }
  }, [data.label, data.isEditing]);

  useEffect(() => {
    setTitle(data.title ?? "");
  }, [data.title]);

  // 🔥 NY: Hantera bilduppladdning inuti editorn
  const handleImageUpload = async (file: File): Promise<string | null> => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        alert("Du måste vara inloggad för att ladda upp bilder.");
        return null;
      }

      const fileExt = file.name.split(".").pop() || "png";
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${session.user.id}/${fileName}`;

      const { error } = await supabase.storage
        .from("images")
        .upload(filePath, file);
      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from("images")
        .getPublicUrl(filePath);
      return urlData.publicUrl;
    } catch (error) {
      console.error("Upload failed:", error);
      return null;
    }
  };

  // 🔥 Auto-resize logic: Mät texten och expandera noden om det behövs
  const checkSize = useCallback(() => {
    // Använd requestAnimationFrame för att garantera att vi mäter efter render
    requestAnimationFrame(() => {
      if (!containerRef.current || !contentRef.current) return;

      // Mät innehållet (inklusive padding eftersom contentRef har padding)
      const contentHeight = contentRef.current.scrollHeight;

      // Total nödvändig höjd (Header ca 48px + content)
      const requiredHeight = 48 + contentHeight;

      setDynamicMinHeight(requiredHeight);

      if (isResizingRef.current) return;

      const currentHeight = containerRef.current.offsetHeight;
      const currentWidth = containerRef.current.offsetWidth;

      // Expandera bara om innehållet faktiskt kräver mer plats än vad som finns.
      // Vi tvingar inte ihop noden om användaren har gjort den större manuellt.
      if (requiredHeight > currentHeight + 2) {
        onResizeRef.current?.(id, currentWidth, requiredHeight);
      }
    });
  }, [id, data.isEditing, data.summary]);

  // 🔥 FIX: Använd useLayoutEffect för att mäta INNAN paint (löser flimmer/sync-problem)
  useLayoutEffect(() => {
    // Vi observerar contentRef eftersom det är där texten och summary bor
    const target = contentRef.current;
    if (!target) return;

    // 1. ResizeObserver: Lyssna på storleksändringar (t.ex. radbrytning)
    const resizeObserver = new ResizeObserver(() => {
      checkSize();
    });
    resizeObserver.observe(target);

    // 2. MutationObserver: Lyssna på DOM-ändringar (t.ex. när summary läggs till/tas bort)
    const mutationObserver = new MutationObserver(() => {
      checkSize();
    });
    mutationObserver.observe(target, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    // Kör check direkt
    checkSize();

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [
    checkSize,
    data.summary,
    data.tags,
    data.aiTags,
    data.isProcessing,
    value,
  ]);

  const stopEdit = () => {
    // Spara sker via onChange i RichTextEditor, här signalerar vi bara stop
    data.onStopEditing(id);
  };

  // ✅ Tydlig style så handles syns på vit node
  const handleStyle: React.CSSProperties = {
    width: 10,
    height: 10,
    background: "#111",
    border: "2px solid #fff",
  };

  // Beräkna box-shadow baserat på sökstatus
  const isSearchActive = !!data.searchTerm;
  if (isSearchActive) {
    // Logik för sök-glow kan läggas till här om önskat
  }

  // Header Actions (Knappar)
  const headerActions = (
    <>
      {/* Tag Button */}
      <div
        className="nodrag"
        onClick={(e) => {
          e.stopPropagation();
          setShowTagMenu(!showTagMenu);
          setShowMagicMenu(false);
        }}
        style={{
          width: 34,
          height: 34,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          borderRadius: 4,
          background: showTagMenu ? "rgba(255,255,255,0.1)" : "transparent",
        }}
        title="Taggar"
      >
        <Tag size={22} color={data.color || "#6366f1"} />
      </div>

      {/* Magic Button (AI) */}
      <div
        className="nodrag"
        onClick={(e) => {
          e.stopPropagation();
          setShowMagicMenu(!showMagicMenu);
          setShowTagMenu(false);
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
        style={{
          width: 34,
          height: 34,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          borderRadius: 4,
          background: showMagicMenu ? "rgba(255,255,255,0.1)" : "transparent",
        }}
        title="Städa, rätta & strukturera ✨"
      >
        {data.isProcessing ? (
          <Loader2 size={22} className="animate-spin" color="#6366f1" />
        ) : (
          <Sparkles size={22} color="#6366f1" fill="none" />
        )}
      </div>

      {/* Delete Button */}
      <div
        className="nodrag"
        onClick={(e) => {
          e.stopPropagation();
          data.onDelete?.(id);
        }}
        style={{
          width: 34,
          height: 34,
          borderRadius: 4,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: "#ef4444",
        }}
        title="Ta bort"
      >
        <X size={24} />
      </div>
    </>
  );

  // Title Component
  const titleComponent = isEditingTitle ? (
    <input
      className="nodrag"
      autoFocus
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      onBlur={() => {
        data.onTitleChange?.(id, title);
        setIsEditingTitle(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          data.onTitleChange?.(id, title);
          setIsEditingTitle(false);
        }
      }}
      placeholder="Rubrik..."
      style={{
        width: "100%",
        background: "transparent",
        border: "none",
        outline: "none",
        fontSize: 30,
        fontWeight: 600,
        color: "inherit",
        padding: 0,
        margin: 0,
      }}
    />
  ) : (
    <div
      onClick={(e) => {
        e.stopPropagation();
        setIsEditingTitle(true);
      }}
      style={{
        width: "100%",
        fontSize: 30,
        fontWeight: 600,
        color: title ? "inherit" : "rgba(255,255,255,0.4)",
        cursor: "text",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
    >
      {title || "Rubrik..."}
    </div>
  );

  return (
    <BaseNode
      id={id}
      ref={containerRef}
      selected={selected}
      title={titleComponent}
      icon={<FileText size={24} />}
      headerActions={headerActions}
      accentColor={data.color || "#6366f1"} // 🔥 Använd vald färg för border/glow
      onDoubleClick={(e) => {
        e.stopPropagation();
        data.onStartEditing(id);
      }}
      style={{
        width: "100%",
        height: "100%",
        zIndex: 50, // 🔥 FIX: Se till att resizer ligger överst
        // Problem 1: Tydligare border och glow hanteras nu av BaseNode via accentColor
      }}
    >
      <NodeResizer
        isVisible={selected} // Visa bara handles när noden är vald (snyggare)
        minWidth={300}
        minHeight={Math.max(150, dynamicMinHeight)} // 🔥 Använd dynamisk höjd
        onResizeStart={() => {
          isResizingRef.current = true; // 🔥 Pausa auto-resize
          data.onResizeStart?.(id); // 🔥 Signalera till Canvas att vi börjar ändra storlek
        }}
        onResize={(_e, params) => {
          // Uppdatera bara visuellt medan vi drar (snabbt)
          data.onResize?.(id, params.width, params.height, params.x, params.y); // 🔥 Skicka med x/y
        }}
        onResizeEnd={(_e, params) => {
          isResizingRef.current = false; // 🔥 Återaktivera auto-resize
          // Spara till DB när vi släpper (förhindrar lagg)
          data.onResizeEnd?.(
            id,
            params.width,
            params.height,
            params.x,
            params.y,
          ); // 🔥 Skicka med x/y
          checkSize(); // 🔥 Säkerställ att vi inte lämnar noden i ett ogiltigt läge
        }}
        handleStyle={{
          width: 40, // 🔥 Öka touch-ytan rejält för mobil
          height: 40,
          background: "transparent",
          border: "none",
          touchAction: "none", // 🔥 Viktigt för att förhindra scroll/pan vid resize
        }}
        lineStyle={{
          border: "none",
        }}
      />

      {/* Problem 2: Färgprickar flyttade till egen rad ovanför headern */}
      {selected && (
        <div
          className="nodrag"
          style={{
            position: "absolute",
            top: -40, // Flyttad upp ovanför headern
            left: 0,
            display: "flex",
            gap: 6,
            zIndex: 10,
          }}
        >
          {COLORS.map((c) => (
            <div
              key={c}
              onClick={(e) => {
                e.stopPropagation();
                data.onColorChange?.(id, c);
              }}
              style={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                background: c, // Behåll originalfärgerna för paletten
                cursor: "pointer",
                border:
                  data.color === c
                    ? "2px solid #fff"
                    : "1px solid rgba(255,255,255,0.2)",
                boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
              }}
            />
          ))}
        </div>
      )}

      {/* Tag Menu Popover */}
      {selected && showTagMenu && (
        <div
          className="nodrag"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            top: 50,
            right: -10,
            width: 240,
            background: "rgba(30, 30, 35, 0.95)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: 12,
            padding: 12,
            zIndex: 100,
            boxShadow: "0 10px 30px -5px rgba(0,0,0,0.6)",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            animation: "fadeIn 0.2s ease-out",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#888",
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            Hantera Taggar
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {DEFAULT_TAGS.map((tag) => {
              const isActive = data.tags?.includes(tag);
              return (
                <div
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  style={{
                    fontSize: "12px",
                    padding: "6px 10px",
                    borderRadius: 8,
                    cursor: "pointer",
                    background: isActive
                      ? getTagColor(tag)
                      : "rgba(255,255,255,0.05)",
                    color: isActive ? "white" : "#ccc",
                    border: isActive
                      ? `1px solid ${getTagColor(tag)}`
                      : "1px solid rgba(255,255,255,0.1)",
                    transition: "all 0.2s",
                    fontWeight: 500,
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive)
                      e.currentTarget.style.background =
                        "rgba(255,255,255,0.1)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive)
                      e.currentTarget.style.background =
                        "rgba(255,255,255,0.05)";
                  }}
                >
                  {tag}
                </div>
              );
            })}
          </div>
          <div
            style={{
              display: "flex",
              gap: 8,
              borderTop: "1px solid rgba(255,255,255,0.1)",
              paddingTop: 12,
            }}
          >
            <input
              value={customTag}
              onChange={(e) => setCustomTag(e.target.value)}
              placeholder="Skapa ny tagg..."
              style={{
                flex: 1,
                background: "rgba(0,0,0,0.3)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "white",
                fontSize: "13px",
                padding: "8px 12px",
                borderRadius: 8,
                outline: "none",
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") addCustomTag();
              }}
            />
            <button
              onClick={addCustomTag}
              style={{
                background: "#6366f1",
                border: "none",
                color: "white",
                borderRadius: 8,
                cursor: "pointer",
                padding: "0 10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background 0.2s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "#4f46e5")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "#6366f1")
              }
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Magic Menu Popover */}
      {selected && showMagicMenu && (
        <div
          className="nodrag"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            top: 50,
            right: -10,
            width: 220,
            background: "rgba(30, 30, 35, 0.95)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: 12,
            padding: 8,
            zIndex: 100,
            boxShadow: "0 10px 30px -5px rgba(0,0,0,0.6)",
            display: "flex",
            flexDirection: "column",
            gap: 4,
            animation: "fadeIn 0.2s ease-out",
          }}
        >
          <div
            style={{
              padding: "4px 8px",
              fontSize: 11,
              fontWeight: 700,
              color: "#888",
              textTransform: "uppercase",
              letterSpacing: 0.5,
              marginBottom: 4,
            }}
          >
            AI Assistent
          </div>

          <div
            onClick={() => {
              data.onMagic?.(id, "organize");
              setShowMagicMenu(false);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px",
              cursor: "pointer",
              borderRadius: 8,
              transition: "all 0.2s",
              background: "transparent",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "rgba(255,255,255,0.05)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "rgba(99, 102, 241, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#6366f1",
              }}
            >
              <Wand2 size={16} />
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#eee" }}>
                Strukturera
              </span>
              <span style={{ fontSize: 11, color: "#888" }}>
                Städa & formatera text
              </span>
            </div>
          </div>
          <div
            onClick={() => {
              data.onMagic?.(id, "analyze");
              setShowMagicMenu(false);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px",
              cursor: "pointer",
              borderRadius: 8,
              transition: "all 0.2s",
              background: "transparent",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "rgba(255,255,255,0.05)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "rgba(16, 185, 129, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#10b981",
              }}
            >
              <FileText size={16} />
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#eee" }}>
                Analysera
              </span>
              <span style={{ fontSize: 11, color: "#888" }}>
                Sammanfatta & tagga
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 🔥 Visual Resize Handle (Bottom Right) - Visar var man ska dra */}
      {selected && (
        <div
          style={{
            position: "absolute",
            bottom: 5,
            right: 5,
            width: 16,
            height: 16,
            borderRight: "3px solid #6366f1",
            borderBottom: "3px solid #6366f1",
            borderBottomRightRadius: 4,
            pointerEvents: "none", // Klick går igenom till den osynliga NodeResizer-handtaget
            zIndex: 20,
            opacity: 0.8,
          }}
        />
      )}

      {/* Problem 3: Handles positioneras nu relativt BaseNode (hela noden) */}
      <SmartHandle
        id="top"
        type="source"
        position={Position.Top}
        style={handleStyle}
        selected={selected}
      />
      <SmartHandle
        id="right"
        type="source"
        position={Position.Right}
        style={handleStyle}
        selected={selected}
      />
      <SmartHandle
        id="bottom"
        type="source"
        position={Position.Bottom}
        style={handleStyle}
        selected={selected}
      />
      <SmartHandle
        id="left"
        type="source"
        position={Position.Left}
        style={handleStyle}
        selected={selected}
      />

      {/* 🔥 NY: Content Wrapper som vi mäter på */}
      <div
        ref={contentRef}
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          flex: 1,
          padding: "16px", // Padding inuti content area
          boxSizing: "border-box", // 🔥 FIX: Se till att padding inte spräcker bredden
        }}
      >
        {/* Tags Display (Top of content) */}
        {((data.tags && data.tags.length > 0) ||
          (data.aiTags && data.aiTags.length > 0)) && (
          <div
            className="nodrag"
            style={{
              display: "flex",
              gap: 4,
              flexWrap: "wrap",
              marginBottom: 12,
              pointerEvents: "auto",
            }}
          >
            {data.tags?.map((tag, i) => (
              <div
                key={i}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleTag(tag);
                }}
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  background: getTagColor(tag),
                  color: "white",
                  padding: "2px 6px 2px 8px",
                  borderRadius: "12px",
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                  boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  cursor: "pointer",
                }}
                title="Klicka för att ta bort"
              >
                <Tag size={8} strokeWidth={3} />
                {tag}
                <X size={8} strokeWidth={3} style={{ opacity: 0.7 }} />
              </div>
            ))}

            {/* 🔥 NY: Visa AI-taggar */}
            {data.aiTags?.map((tag, i) => (
              <div
                key={`ai-${i}`}
                onClick={(e) => {
                  e.stopPropagation();
                  approveAiTag(tag);
                }}
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  background: "transparent",
                  color: getTagColor(tag),
                  padding: "2px 6px 2px 6px",
                  borderRadius: "12px",
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                  border: `1px dashed ${getTagColor(tag)}`, // Streckad kant för AI
                  cursor: "pointer",
                }}
                title="Klicka för att godkänna (flytta till vanliga taggar)"
              >
                <Sparkles size={8} strokeWidth={3} />
                {tag}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteAiTag(tag);
                  }}
                  style={{ display: "flex", alignItems: "center" }}
                >
                  <X size={8} strokeWidth={3} style={{ opacity: 0.7 }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Editor Container (Transparent nu) */}
        <div
          style={{
            color: "white",
            display: "flex",
            flexDirection: "column",
            minHeight: "60px",
            flex: 1,
          }}
        >
          <RichTextEditor
            content={value}
            isEditing={!!data.isEditing}
            startListeningOnMount={!!data.startListening}
            onImageUpload={handleImageUpload}
            onChange={(html) => {
              setValue(html);
              data.onChange(id, html);
            }}
            onBlur={stopEdit}
          />

          {/* 🔥 FIX: Sammanfattning */}
          {data.summary && (
            <div
              className="summary-container"
              style={{
                marginTop: 12,
                paddingTop: 12,
                borderTop: "1px solid rgba(255, 255, 255, 0.1)",
                fontSize: "15px",
                color: "#ccc",
                fontStyle: "italic",
                position: "relative",
                lineHeight: "1.5",
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  marginBottom: 4,
                  alignItems: "center",
                  color: "#6366f1",
                  fontWeight: 600,
                  fontSize: "12px",
                  textTransform: "uppercase",
                }}
              >
                <Sparkles size={12} />
                AI Sammanfattning
              </div>
              {data.summary}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  data.onSummaryChange?.(id, "");
                }}
                style={{
                  position: "absolute",
                  top: 12,
                  right: 0,
                  cursor: "pointer",
                  opacity: 0.6,
                  padding: 4,
                }}
                title="Ta bort sammanfattning"
              >
                <X size={14} />
              </div>
            </div>
          )}
        </div>
      </div>
    </BaseNode>
  );
}
