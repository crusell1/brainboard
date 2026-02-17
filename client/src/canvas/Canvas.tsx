import { useCallback, useRef } from "react";
import {
  ReactFlow,
  addEdge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  ConnectionMode,
  type Connection,
  type Node,
  type Edge,
  type ReactFlowInstance,
} from "@xyflow/react";

import NoteNode from "../nodes/NoteNode";

let id = 0;
const getId = () => `node_${id++}`;

const NODE_WIDTH = 150;
const NODE_HEIGHT = 40;

export default function Canvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const nodeTypes = {
    note: NoteNode,
  };

  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);

  const lastClick = useRef<number>(0);

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges],
  );

  const onPaneClick = useCallback(
    (event: React.MouseEvent) => {
      const now = Date.now();
      const DOUBLE_CLICK_DELAY = 250;

      if (now - lastClick.current < DOUBLE_CLICK_DELAY) {
        if (!reactFlowInstance.current) return;

        const flowPosition = reactFlowInstance.current.screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });

        const centeredPosition = {
          x: flowPosition.x - NODE_WIDTH / 2,
          y: flowPosition.y - NODE_HEIGHT / 2,
        };

        const newNode: Node = {
          id: getId(),
          position: centeredPosition,
          data: { label: "New Node" },
          type: "note",
        };

        setNodes((nds) => [...nds, newNode]);
      }

      lastClick.current = now;
    },
    [setNodes],
  );
  const onEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      setEdges((eds) => eds.filter((e) => e.id !== edge.id));
    },
    [setEdges],
  );

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "#111111",
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onPaneClick={onPaneClick}
        onEdgeClick={onEdgeClick}
        zoomOnDoubleClick={false}
        onInit={(instance) => (reactFlowInstance.current = instance)}
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
