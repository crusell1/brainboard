import React, { useEffect, useRef, useState } from "react";
import {
  Handle,
  Position,
  NodeResizer,
  type Node,
  type NodeProps,
} from "@xyflow/react";

export type NoteData = {
  title?: string;
  label: string;
  isEditing?: boolean;
  onChange: (nodeId: string, value: string) => void;
  onStopEditing: (nodeId: string) => void;
  onStartEditing: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
  onResize?: (nodeId: string, width: number, height: number) => void;
  onColorChange?: (nodeId: string, color: string) => void;
  onTitleChange?: (nodeId: string, title: string) => void;
  color?: string;
};

export type NoteNodeType = Node<NoteData, "note">;

const COLORS = ["#f1f1f1", "#ffef9e", "#ffc4c4", "#b8e6ff", "#b5ffc6"];

export default function NoteNode({
  id,
  data,
  selected,
}: NodeProps<NoteNodeType>) {
  const [value, setValue] = useState(data.label ?? "");
  const [title, setTitle] = useState(data.title ?? "");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (data.isEditing && textareaRef.current) {
      textareaRef.current.focus();
      // Vi tar bort autoResize här för att respektera den manuella storleken
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [data.isEditing]);

  // 🔥 Auto-resize logic: Mät texten och expandera noden om det behövs
  useEffect(() => {
    if (!shadowRef.current || !containerRef.current) return;

    const checkSize = () => {
      const contentHeight = shadowRef.current!.scrollHeight;
      const totalHeight = contentHeight + 80; // padding + title + buffer

      const currentHeight = containerRef.current!.offsetHeight;
      const currentWidth = containerRef.current!.offsetWidth;

      const minHeight = 90;
      const targetHeight = Math.max(minHeight, totalHeight);

      // Uppdatera bara om höjden skiljer sig markant
      if (Math.abs(targetHeight - currentHeight) > 5) {
        onResizeRef.current?.(id, currentWidth, targetHeight);
      }
    };

    // Kör checkSize direkt och när bredden ändras (ResizeObserver)
    const observer = new ResizeObserver(checkSize);
    observer.observe(containerRef.current);

    // Kör även när texten ändras
    checkSize();

    return () => observer.disconnect();
  }, [value, id]); // 🔥 VIKTIGT: Tog bort 'data' från beroenden för att stoppa kraschen

  const stopEdit = () => {
    data.onChange(id, value);
    data.onStopEditing(id);
  };

  // ✅ Tydlig style så handles syns på vit node
  const handleStyle: React.CSSProperties = {
    width: 10,
    height: 10,
    background: "#111",
    border: "2px solid #fff",
  };

  return (
    <div
      ref={containerRef}
      onDoubleClick={(e) => {
        e.stopPropagation();
        data.onStartEditing(id);
      }}
      style={{
        minWidth: 150,
        minHeight: 90,
        width: "100%",
        height: "100%",
        padding: "12px 12px 32px 12px",
        borderRadius: 16,
        background: data.color ?? "#f1f1f1",
        border: selected ? "2px solid #6366f1" : "1px solid #ddd",
        boxShadow: "0 8px 20px rgba(0,0,0,0.15)",
        boxSizing: "border-box",
        position: "relative",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <NodeResizer
        isVisible={selected} // Visa bara handles när noden är vald (snyggare)
        minWidth={150}
        minHeight={60}
        onResize={(_e, params) => {
          // Skicka upp nya storleken till Canvas för att sparas
          data.onResize?.(id, params.width, params.height);
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

      {/* Shadow Div för mätning (osynlig) */}
      <div
        ref={shadowRef}
        style={{
          position: "absolute",
          left: 16,
          top: 16,
          width: "calc(100% - 32px)",
          visibility: "hidden",
          pointerEvents: "none",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          padding: 12,
          fontSize: 14,
          fontFamily: "inherit",
          lineHeight: "normal",
          boxSizing: "border-box",
          zIndex: -1,
        }}
      >
        {value}
        {value.endsWith("\n") && <br />}
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

      <Handle
        id="top"
        type="source"
        position={Position.Top}
        style={handleStyle}
      />
      <Handle
        id="right"
        type="source"
        position={Position.Right}
        style={handleStyle}
      />
      <Handle
        id="bottom"
        type="source"
        position={Position.Bottom}
        style={handleStyle}
      />
      <Handle
        id="left"
        type="source"
        position={Position.Left}
        style={handleStyle}
      />

      {data.isEditing ? (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={stopEdit}
          style={{
            width: "100%",
            flex: 1,
            borderRadius: 12,
            border: "none",
            outline: "none",
            resize: "none",
            padding: 12,
            background: "#3a3a3a",
            color: "white",
            fontSize: 14,
            boxSizing: "border-box",
            wordBreak: "break-word",
            overflowWrap: "break-word",
            whiteSpace: "pre-wrap",
            overflow: "hidden", // Eller "auto" om du vill ha scrollbar
            fontFamily: "inherit",
            lineHeight: "normal",
          }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            flex: 1,
            borderRadius: 12,
            padding: 12,
            background: "#3a3a3a",
            color: "white",
            fontSize: 14,
            boxSizing: "border-box",
            wordBreak: "break-word",
            overflowWrap: "break-word",
            whiteSpace: "pre-wrap",
            overflow: "hidden",
            fontFamily: "inherit",
            lineHeight: "normal",
          }}
        >
          {value}
        </div>
      )}
    </div>
  );
}
