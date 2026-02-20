import { useEffect } from "react";
import {
  Handle,
  Position,
  useNodeConnections,
  NodeResizer,
  useUpdateNodeInternals,
} from "@xyflow/react";
import type { NodeProps, Node } from "@xyflow/react";

export type ImageNodeData = {
  src: string;
  label?: string;
  onDelete?: (id: string) => void;
  onResize?: (id: string, width: number, height: number) => void;
  onResizeEnd?: (id: string, width: number, height: number) => void;
};

export type ImageNodeType = Node<ImageNodeData, "image">;

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

export default function ImageNode({
  id,
  data,
  selected,
}: NodeProps<ImageNodeType>) {
  const updateNodeInternals = useUpdateNodeInternals();

  useEffect(() => {
    updateNodeInternals(id);
  }, [id, updateNodeInternals]);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "auto", // Låt innehållet styra höjden igen
        borderRadius: 12,
        border: selected ? "2px solid #6366f1" : "2px solid transparent",
        boxShadow: selected ? "0 0 15px rgba(99, 102, 241, 0.4)" : "none",
        transition: "all 0.2s ease",
        background: "transparent",
        lineHeight: 0, // Tar bort extra utrymme under bilden
        touchAction: "none", // 🔥 FIX: Förhindra browser-zoom/pan på noden
        willChange: "width, height", // 🔥 FIX: Hint till webbläsaren för prestanda
      }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={100}
        minHeight={100}
        keepAspectRatio={true}
        onResize={(_e, params) => {
          data.onResize?.(id, params.width, params.height);
        }}
        onResizeEnd={(_e, params) => {
          data.onResizeEnd?.(id, params.width, params.height);
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

      <SmartHandle
        id="top"
        type="source"
        position={Position.Top}
        selected={selected}
        style={{
          background: "#555",
          width: 10,
          height: 10,
          border: "2px solid #fff",
          zIndex: 10,
          top: -5,
        }}
      />
      <SmartHandle
        id="right"
        type="source"
        position={Position.Right}
        selected={selected}
        style={{
          background: "#555",
          width: 10,
          height: 10,
          border: "2px solid #fff",
          zIndex: 10,
          right: -5,
        }}
      />
      <SmartHandle
        id="bottom"
        type="source"
        position={Position.Bottom}
        selected={selected}
        style={{
          background: "#555",
          width: 10,
          height: 10,
          border: "2px solid #fff",
          zIndex: 10,
          bottom: -5,
        }}
      />
      <SmartHandle
        id="left"
        type="source"
        position={Position.Left}
        selected={selected}
        style={{
          background: "#555",
          width: 10,
          height: 10,
          border: "2px solid #fff",
          zIndex: 10,
          left: -5,
        }}
      />

      {/* Bilden med transform */}
      <img
        src={data.src}
        alt="Image Node"
        style={{
          width: "100%",
          height: "auto", // Basera på bredd, men transform sköter resten
          borderRadius: 12,
          display: "block",
          pointerEvents: "none",
          userSelect: "none",
        }}
      />

      {selected && (
        <div
          className="nodrag"
          onClick={(e) => {
            e.stopPropagation();
            data.onDelete?.(id);
          }}
          style={{
            position: "absolute",
            top: -10,
            right: -10,
            width: 24, // Mindre och diskretare
            height: 24,
            borderRadius: "50%",
            background: "#ff0055",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
            zIndex: 100,
            fontSize: "16px",
            lineHeight: 1,
            border: "2px solid #fff",
          }}
        >
          ✕
        </div>
      )}
    </div>
  );
}
