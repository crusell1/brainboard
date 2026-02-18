import React, { useEffect, useRef, useState } from "react";
import {
  Handle,
  Position,
  NodeResizer,
  useNodeConnections,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import RichTextEditor from "../components/RichTextEditor";
import { Sparkles, Loader2, Tag, Plus, X } from "lucide-react";

export type NoteData = {
  title?: string;
  label: string;
  isEditing?: boolean;
  startListening?: boolean;
  tags?: string[];
  isProcessing?: boolean;
  onMagic?: (nodeId: string) => void;
  onTagsChange?: (nodeId: string, tags: string[]) => void;
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
  const [value, setValue] = useState(data.label ?? "");
  const [title, setTitle] = useState(data.title ?? "");
  const containerRef = useRef<HTMLDivElement>(null);
  const [showTagMenu, setShowTagMenu] = useState(false);
  const [customTag, setCustomTag] = useState("");

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

  // Spara onResize i en ref för att kunna använda den i useEffect utan att skapa loopar
  const onResizeRef = useRef(data.onResize);
  useEffect(() => {
    onResizeRef.current = data.onResize;
  }, [data.onResize]);

  useEffect(() => {
    setValue(data.label ?? "");
  }, [data.label]);

  useEffect(() => {
    setTitle(data.title ?? "");
  }, [data.title]);

  // 🔥 Auto-resize logic: Mät texten och expandera noden om det behövs
  useEffect(() => {
    if (!containerRef.current) return;

    const checkSize = () => {
      // Vi mäter containerns scrollHeight direkt eftersom Tiptap expanderar den
      const contentHeight = containerRef.current!.scrollHeight;
      // Ingen extra buffer behövs om vi mäter containern direkt, men vi sätter en min-höjd
      const totalHeight = contentHeight;

      const currentHeight = containerRef.current!.offsetHeight;
      const currentWidth = containerRef.current!.offsetWidth;

      const minHeight = 150;
      const targetHeight = Math.max(minHeight, totalHeight);

      // Uppdatera bara om höjden skiljer sig markant
      if (Math.abs(targetHeight - currentHeight) > 5) {
        onResizeRef.current?.(id, currentWidth, targetHeight);
      }
    };

    // Kör checkSize direkt och när bredden ändras (ResizeObserver)
    const observer = new ResizeObserver(checkSize);
    observer.observe(containerRef.current);

    // Kör en extra check efter en kort stund för att låta Tiptap rendera klart
    setTimeout(checkSize, 100);

    return () => observer.disconnect();
  }, [value, id, data.isEditing]); // Uppdatera när value eller edit-läge ändras

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
        border: selected ? "2px solid #6366f1" : "1px solid #ddd",
        boxShadow: boxShadow,
        boxSizing: "border-box",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        overflow: "visible", // Viktigt för att glow ska synas utanför
        touchAction: "none", // 🔥 FIX: Förhindra browser-zoom/pan på noden
        willChange: "width, height", // 🔥 FIX: Hint till webbläsaren för prestanda
      }}
    >
      {/* Tags Display (Top Left Label) */}
      {data.tags && data.tags.length > 0 && (
        <div
          className="nodrag"
          style={{
            position: "absolute",
            top: -10,
            left: 16,
            display: "flex",
            gap: 4,
            zIndex: 5,
            flexWrap: "wrap",
            maxWidth: "100%",
            pointerEvents: "none",
          }}
        >
          {data.tags.map((tag, i) => (
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
        </div>
      )}

      <NodeResizer
        isVisible={selected} // Visa bara handles när noden är vald (snyggare)
        minWidth={300}
        minHeight={150}
        onResize={(_e, params) => {
          // Uppdatera bara visuellt medan vi drar (snabbt)
          data.onResize?.(id, params.width, params.height);
        }}
        onResizeEnd={(_e, params) => {
          // Spara till DB när vi släpper (förhindrar lagg)
          data.onResizeEnd?.(id, params.width, params.height);
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
          marginBottom: 8,
          textAlign: "center",
        }}
      />

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
            data.onMagic?.(id);
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
          title="AI✨"
        >
          {data.isProcessing ? (
            <Loader2 size={14} className="animate-spin" color="#6366f1" />
          ) : (
            <Sparkles size={14} color="#6366f1" fill="none" />
          )}
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
            fontSize: 14,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            lineHeight: 1,
            zIndex: 10, // Se till att krysset ligger överst
          }}
        >
          ×
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

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          background: "#3a3a3a",
          borderRadius: 12,
          padding: 12,
          color: "white",
          overflow: "hidden",
        }}
      >
        <RichTextEditor
          content={value}
          isEditing={!!data.isEditing}
          startListeningOnMount={!!data.startListening}
          onChange={(html) => {
            setValue(html);
            data.onChange(id, html);
          }}
          onBlur={stopEdit}
        />
      </div>
    </div>
  );
}
