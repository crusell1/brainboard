import { useCallback } from "react";
import {
  ReactFlow,
  addEdge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
  type Edge,
} from "@xyflow/react";

let id = 0;
const getId = () => `node_${id++}`;

export default function Canvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges],
  );

  const addNode = () => {
    const newNode: Node = {
      id: getId(),
      position: {
        x: Math.random() * 600,
        y: Math.random() * 400,
      },
      data: { label: "New Node" },
      type: "default",
    };

    setNodes((nds) => [...nds, newNode]);
  };

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "#111111",
      }}
    >
      <button
        onClick={addNode}
        style={{
          position: "absolute",
          zIndex: 10,
          top: 15,
          left: 15,
          padding: "8px 14px",
          borderRadius: 6,
          border: "none",
          background: "#1f1f1f",
          color: "white",
          cursor: "pointer",
        }}
      >
        Add Node
      </button>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
        nodesDraggable
        nodesConnectable
      >
        <MiniMap
          style={{ backgroundColor: "#1a1a1a" }}
          nodeColor={() => "#ffffff"}
        />

        <Controls
          style={{
            background: "#1a1a1a",
            color: "#000",
          }}
        />

        <Background gap={20} size={1} color="#333" />
      </ReactFlow>
    </div>
  );
}
