import React, { useEffect, useRef, useState } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";

export type NoteData = {
  label: string;
  isEditing?: boolean;
  onChange: (nodeId: string, value: string) => void;
  onStopEditing: (nodeId: string) => void;
  onStartEditing: (nodeId: string) => void;
};

export type NoteNodeType = Node<NoteData, "note">;

export default function NoteNode({
  id,
  data,
  selected,
}: NodeProps<NoteNodeType>) {
  const [value, setValue] = useState(data.label ?? "");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setValue(data.label ?? "");
  }, [data.label]);

  useEffect(() => {
    if (data.isEditing && textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [data.isEditing]);

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
      onDoubleClick={(e) => {
        e.stopPropagation();
        data.onStartEditing(id);
      }}
      style={{
        width: 220,
        minHeight: 80,
        padding: 16,
        borderRadius: 16,
        background: "#f1f1f1",
        border: selected ? "2px solid #6366f1" : "1px solid #ddd",
        boxShadow: "0 8px 20px rgba(0,0,0,0.15)",
        boxSizing: "border-box",
        position: "relative",
      }}
    >
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
            minHeight: 40,
            borderRadius: 12,
            border: "none",
            outline: "none",
            resize: "none",
            padding: 12,
            background: "#3a3a3a",
            color: "white",
            fontSize: 14,
            boxSizing: "border-box",
          }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            minHeight: 40,
            borderRadius: 12,
            padding: 12,
            background: "#3a3a3a",
            color: "white",
            fontSize: 14,
            boxSizing: "border-box",
            whiteSpace: "pre-wrap",
          }}
        >
          {value}
        </div>
      )}
    </div>
  );
}
