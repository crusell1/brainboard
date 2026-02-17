import React, { useEffect, useRef, useState } from "react";
import {
  Handle,
  Position,
  NodeResizer,
  useUpdateNodeInternals,
  type Node,
  type NodeProps,
} from "@xyflow/react";

export type NoteData = {
  label: string;
  isEditing?: boolean;
  onChange: (nodeId: string, value: string) => void;
  onStopEditing: (nodeId: string) => void;
  onStartEditing: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
};

export type NoteNodeType = Node<NoteData, "note">;

export default function NoteNode({
  id,
  data,
  selected,
}: NodeProps<NoteNodeType>) {
  const [value, setValue] = useState(data.label ?? "");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const updateNodeInternals = useUpdateNodeInternals();

  useEffect(() => {
    setValue(data.label ?? "");
  }, [data.label]);

  useEffect(() => {
    if (data.isEditing && textareaRef.current) {
      textareaRef.current.focus();
      autoResize();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [data.isEditing]);

  const stopEdit = () => {
    data.onChange(id, value);
    data.onStopEditing(id);
  };
  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;

    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";

    updateNodeInternals(id); // 👈 HÄR
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
      onDoubleClick={(e) => {
        e.stopPropagation();
        data.onStartEditing(id);
      }}
      style={{
        minWidth: 150,
        minHeight: 60,
        width: "100%",
        height: "100%", // 🔥 VIKTIGT
        padding: 16,
        borderRadius: 16,
        background: "#f1f1f1",
        border: selected ? "2px solid #6366f1" : "1px solid #ddd",
        boxShadow: "0 8px 20px rgba(0,0,0,0.15)",
        boxSizing: "border-box",
        position: "relative",
        display: "flex", // 🔥
        flexDirection: "column", // 🔥
      }}
    >
      <NodeResizer
        isVisible={true}
        minWidth={150}
        minHeight={60}
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
            height: "100%",
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
            overflow: "hidden",
          }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
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
          }}
        >
          {value}
        </div>
      )}
    </div>
  );
}
