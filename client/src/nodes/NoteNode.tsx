import React, {
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
  onResize?: (nodeId: string, width: number, height: number) => void;
  onResizeEnd?: (nodeId: string, width: number, height: number) => void;
  onColorChange?: (nodeId: string, color: string) => void;
  onTitleChange?: (nodeId: string, title: string) => void;
  searchTerm?: string; // Ny prop för sökning
  isMatch?: boolean;
  isConnected?: boolean;
  color?: string;
};

export type NoteNodeType = Node<NoteData, "note">;

const COLORS = ["#f1f1f1", "#ffef9e", "#ffc4c4", "#b8e6ff", "#b5ffc6"];

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
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
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
    updateNodeInternals(id);
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
      if (!containerRef.current || !innerRef.current) return;

      // 1. Header-höjd (där innerRef börjar)
      const headerHeight = innerRef.current.offsetTop;

      // 2. Mät innehållet i den mörka rutan (Editor + Summary)
      let contentHeight = 0;
      const editorWrapper = innerRef.current.querySelector(
        ".rich-text-editor-wrapper",
      );
      if (editorWrapper) {
        contentHeight += editorWrapper.scrollHeight;
      } else {
        contentHeight += 60; // Fallback
      }

      const summaryEl = innerRef.current.querySelector(".summary-container");
      if (summaryEl) {
        contentHeight += summaryEl.scrollHeight + 12; // +12px margin-top
      }

      // 3. Total nödvändig höjd
      // Header + Content + DarkBoxPadding (24) + NodePadding (16)
      const requiredHeight = headerHeight + contentHeight + 24 + 16;

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
    const target = contentRef.current || innerRef.current;
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
  let boxShadow = "0 8px 20px rgba(0,0,0,0.15)"; // Default skugga

  if (isSearchActive) {
    if (data.isMatch) {
      // Stark glow för match
      boxShadow =
        "0 0 0 3px rgba(255, 255, 0, 0.8), 0 0 20px rgba(255, 255, 0, 0.6)";
    } else if (data.isConnected) {
      // Mild glow för kopplade
      boxShadow =
        "0 0 0 2px rgba(180, 120, 255, 0.6), 0 0 12px rgba(180, 120, 255, 0.4)";
    } else {
      boxShadow = "none"; // Ingen skugga för övriga vid sökning
    }
  }

  return (
    <div
      ref={containerRef}
      onDoubleClick={(e) => {
        e.stopPropagation();
        data.onStartEditing(id);
      }}
      style={{
        minWidth: 300,
        minHeight: 150,
        width: "100%",
        height: "100%",
        padding: "16px",
        borderRadius: 16,
        background: data.color ?? "#f1f1f1",
        border: selected ? "2px solid #6366f1" : "1px solid rgba(0,0,0,0.1)",
        boxShadow: boxShadow,
        boxSizing: "border-box",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        overflow: "visible", // Viktigt för att glow ska synas utanför
        touchAction: "none", // 🔥 FIX: Förhindra browser-zoom/pan på noden
        willChange: "width, height", // 🔥 FIX: Hint till webbläsaren för prestanda
        zIndex: 50, // 🔥 FIX: Se till att resizer ligger överst
      }}
    >
      {/* Tags Display (Top Left Label) */}
      {((data.tags && data.tags.length > 0) ||
        (data.aiTags && data.aiTags.length > 0)) && (
        <div
          className="nodrag"
          style={{
            position: "absolute",
            top: 0,
            left: 16,
            display: "flex",
            gap: 4,
            zIndex: 5,
            flexWrap: "wrap",
            maxWidth: "100%",
            pointerEvents: "none",
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
                fontSize: "10px",
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
                pointerEvents: "auto",
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
                fontSize: "10px",
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
                pointerEvents: "auto",
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

      <NodeResizer
        isVisible={selected} // Visa bara handles när noden är vald (snyggare)
        minWidth={300}
        minHeight={Math.max(150, dynamicMinHeight)} // 🔥 Använd dynamisk höjd
        onResizeStart={() => {
          isResizingRef.current = true; // 🔥 Pausa auto-resize
        }}
        onResize={(_e, params) => {
          // Uppdatera bara visuellt medan vi drar (snabbt)
          data.onResize?.(id, params.width, params.height);
        }}
        onResizeEnd={(_e, params) => {
          isResizingRef.current = false; // 🔥 Återaktivera auto-resize
          // Spara till DB när vi släpper (förhindrar lagg)
          data.onResizeEnd?.(id, params.width, params.height);
          checkSize(); // 🔥 Säkerställ att vi inte lämnar noden i ett ogiltigt läge
        }}
        handleStyle={{
          width: 8,
          height: 8,
          background: "transparent",
          border: "none",
        }}
        lineStyle={{
          border: "none",
        }}
      />

      {/* Titel-input */}
      {/* 🔥 FIX: Wrapper för att skydda titeln från att täckas av editorn */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          marginBottom: 8,
          flexShrink: 0, // Förhindra att titeln krymper
        }}
      >
        <input
          className="nodrag"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => data.onTitleChange?.(id, title)}
          placeholder="Rubrik..."
          style={{
            width: "100%",
            background: "transparent",
            border: "none",
            outline: "none",
            fontSize: 16,
            fontWeight: "bold",
            color: "#111",
            textAlign: "center",
          }}
        />
      </div>

      {/* Färgpalett (visas när vald) */}
      {selected && (
        <div
          style={{
            position: "absolute",
            top: -35,
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
                background: c,
                cursor: "pointer",
                border:
                  data.color === c ? "2px solid #6366f1" : "1px solid #999",
                boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
              }}
            />
          ))}
        </div>
      )}

      {/* Tag Button */}
      {selected && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            setShowTagMenu(!showTagMenu);
            setShowMagicMenu(false);
          }}
          style={{
            position: "absolute",
            top: 2,
            right: 46, // Till vänster om Magic-knappen
            width: 16,
            height: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            zIndex: 10,
          }}
          title="Taggar"
        >
          <Tag size={14} color="#6366f1" />
        </div>
      )}

      {/* Tag Menu Popover */}
      {selected && showTagMenu && (
        <div
          className="nodrag"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            top: 24,
            right: 0,
            width: 200,
            background: "#222",
            border: "1px solid #444",
            borderRadius: 8,
            padding: 8,
            zIndex: 20,
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {DEFAULT_TAGS.map((tag) => {
              const isActive = data.tags?.includes(tag);
              return (
                <div
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  style={{
                    fontSize: "11px",
                    padding: "4px 8px",
                    borderRadius: 12,
                    cursor: "pointer",
                    background: isActive ? getTagColor(tag) : "#333",
                    color: isActive ? "white" : "#ccc",
                    border: isActive
                      ? `1px solid ${getTagColor(tag)}`
                      : "1px solid #555",
                    transition: "all 0.1s",
                  }}
                >
                  {tag}
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <input
              value={customTag}
              onChange={(e) => setCustomTag(e.target.value)}
              placeholder="Ny tagg..."
              style={{
                flex: 1,
                background: "#111",
                border: "1px solid #444",
                color: "white",
                fontSize: "12px",
                padding: "4px 8px",
                borderRadius: 4,
                outline: "none",
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") addCustomTag();
              }}
            />
            <button
              onClick={addCustomTag}
              style={{
                background: "#444",
                border: "none",
                color: "white",
                borderRadius: 4,
                cursor: "pointer",
                padding: "0 8px",
                display: "flex",
                alignItems: "center",
              }}
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Magic Button (AI) */}
      {selected && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            setShowMagicMenu(!showMagicMenu);
            setShowTagMenu(false);
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault(); // 🔥 FIX: Förhindra fokus-stöld
          }}
          style={{
            position: "absolute",
            top: 2,
            right: 24, // Till vänster om krysset
            width: 16,
            height: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            zIndex: 10,
          }}
          title="Städa, rätta & strukturera ✨"
        >
          {data.isProcessing ? (
            <Loader2 size={14} className="animate-spin" color="#6366f1" />
          ) : (
            <Sparkles size={14} color="#6366f1" fill="none" />
          )}
        </div>
      )}

      {/* Magic Menu Popover */}
      {selected && showMagicMenu && (
        <div
          className="nodrag"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            top: 24,
            right: 0,
            width: 180,
            background: "#222",
            border: "1px solid #444",
            borderRadius: 8,
            padding: 4,
            zIndex: 20,
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <div
            onClick={() => {
              data.onMagic?.(id, "organize");
              setShowMagicMenu(false);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px",
              fontSize: "12px",
              color: "#eee",
              cursor: "pointer",
              borderRadius: 4,
              transition: "background 0.1s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#333")}
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
          >
            <Wand2 size={14} color="#6366f1" />
            <span>Städa text</span>
          </div>
          <div
            onClick={() => {
              data.onMagic?.(id, "analyze");
              setShowMagicMenu(false);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px",
              fontSize: "12px",
              color: "#eee",
              cursor: "pointer",
              borderRadius: 4,
              transition: "background 0.1s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#333")}
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
          >
            <FileText size={14} color="#10b981" />
            <span>Analysera</span>
          </div>
        </div>
      )}

      {selected && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            data.onDelete?.(id);
          }}
          style={{
            position: "absolute",
            top: 2,
            right: 2,
            width: 16,
            height: 16,
            borderRadius: 3,
            background: "transparent",
            color: "#111",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            zIndex: 10, // Se till att krysset ligger överst
          }}
        >
          <X size={14} />
        </div>
      )}

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

      {/* 🔥 FIX: innerRef är nu en transparent wrapper för både editor och summary */}
      <div
        ref={innerRef}
        style={{
          display: "flex",
          flexDirection: "column",
          position: "relative",
          zIndex: 1,
          width: "100%", // 🔥 FIX: Säkerställ att den fyller bredden
          flex: 1, // 🔥 FIX: Fyll ut vertikalt utrymme i noden
          minHeight: 0, // Viktigt för flex-nesting
        }}
      >
        {/* 🔥 NY: Content Wrapper som vi mäter på */}
        <div
          ref={contentRef}
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            flex: 1, // 🔥 FIX: Låt denna växa också
            flexShrink: 0, // 🔥 FIX: Förhindra krympning
          }}
        >
          {/* Editor Container (Mörk ruta) */}
          <div
            style={{
              background: "#3a3a3a",
              borderRadius: 12,
              padding: 12,
              color: "white",
              display: "flex",
              flexDirection: "column",
              minHeight: "60px", // Minsta höjd för editorn
              flex: 1, // 🔥 FIX: Låt editorn växa och fylla utrymmet (knuffar ner summary)
              flexShrink: 0, // 🔥 FIX: Förhindra krympning
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

            {/* 🔥 FIX: Sammanfattning flyttad INUTI den mörka rutan */}
            {data.summary && (
              <div
                className="summary-container"
                style={{
                  marginTop: 12,
                  paddingTop: 12,
                  borderTop: "1px solid rgba(255, 255, 255, 0.1)",
                  fontSize: "13px",
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
                    fontSize: "11px",
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
      </div>
    </div>
  );
}
