import { useState, useEffect, useRef } from "react";
import {
  Handle,
  Position,
  type NodeProps,
  type Node,
  useUpdateNodeInternals,
  useNodeConnections,
} from "@xyflow/react";
import { Link as LinkIcon, ExternalLink, X } from "lucide-react";

export type LinkNodeData = {
  url: string;
  title?: string;
  color?: string;
  onTitleChange?: (id: string, title: string) => void;
  onDelete?: (id: string) => void;
};

export type LinkNodeType = Node<LinkNodeData, "link">;

const SmartHandle = ({
  type,
  position,
  style,
  selected,
}: {
  type: "source" | "target";
  position: Position;
  style?: React.CSSProperties;
  selected?: boolean;
}) => {
  const connections = useNodeConnections({
    handleType: type,
  });
  const isConnected = connections.length > 0;
  const isVisible = selected || isConnected;

  return (
    <Handle
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

export default function LinkNode({
  id,
  data,
  selected,
}: NodeProps<LinkNodeType>) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(data.title || data.url);
  const inputRef = useRef<HTMLInputElement>(null);
  const updateNodeInternals = useUpdateNodeInternals();

  useEffect(() => {
    requestAnimationFrame(() => {
      updateNodeInternals(id);
    });
  }, [id, updateNodeInternals]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    setIsEditing(false);
    if (title.trim()) {
      data.onTitleChange?.(id, title);
    } else {
      // Fallback till URL om titeln är tom
      setTitle(data.url);
      data.onTitleChange?.(id, data.url);
    }
  };

  const handleClick = () => {
    // Öppna länk om vi inte redigerar
    if (!isEditing) {
      window.open(data.url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div
      style={{
        background: "rgba(30, 30, 35, 0.9)",
        backdropFilter: "blur(10px)",
        padding: "16px 32px",
        borderRadius: "42px",
        border: selected
          ? "2px solid #3b82f6"
          : "1px solid rgba(59, 130, 246, 0.5)",
        boxShadow: selected
          ? "0 0 20px rgba(59, 130, 246, 0.4)"
          : "0 4px 10px rgba(0,0,0,0.3)",
        display: "flex",
        alignItems: "center",
        gap: "16px",
        minWidth: "320px",
        maxWidth: "500px",
        transition: "all 0.2s ease",
        cursor: "pointer",
        position: "relative",
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setIsEditing(true);
      }}
    >
      {/* Handles för kopplingar */}
      <SmartHandle
        type="target"
        position={Position.Left}
        style={{ background: "#3b82f6", width: 8, height: 8 }}
        selected={selected}
      />
      <SmartHandle
        type="source"
        position={Position.Right}
        style={{ background: "#3b82f6", width: 8, height: 8 }}
        selected={selected}
      />

      {/* Ikon */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(59, 130, 246, 0.2)",
          borderRadius: "50%",
          width: 56,
          height: 56,
          flexShrink: 0,
        }}
        onClick={handleClick}
      >
        <LinkIcon size={28} color="#3b82f6" />
      </div>

      {/* Innehåll */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        {isEditing ? (
          <input
            ref={inputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            className="nodrag"
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              borderBottom: "1px solid #3b82f6",
              color: "white",
              fontSize: "20px",
              outline: "none",
              padding: "2px 0",
            }}
          />
        ) : (
          <div
            onClick={handleClick}
            title={data.url}
            style={{
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span
              style={{
                color: "white",
                fontSize: "20px",
                fontWeight: 500,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {title}
            </span>
            <span
              style={{
                fontSize: "14px",
                color: "#888",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {new URL(data.url).hostname}
            </span>
          </div>
        )}
      </div>

      {!isEditing && <ExternalLink size={20} color="#666" />}

      {/* 🔥 Ta bort-knapp (visas endast när vald) */}
      {selected && (
        <div
          className="nodrag"
          onClick={(e) => {
            e.stopPropagation();
            data.onDelete?.(id);
          }}
          style={{
            position: "absolute",
            top: -8,
            right: -8,
            background: "#ef4444",
            color: "white",
            borderRadius: "50%",
            width: 24,
            height: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            border: "2px solid #1e1e24", // Matchar bakgrunden för "cutout"-effekt
            boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
            zIndex: 50,
          }}
          title="Ta bort länk"
        >
          <X size={14} strokeWidth={3} />
        </div>
      )}
    </div>
  );
}
