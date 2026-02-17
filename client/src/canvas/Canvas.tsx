import { useCallback, useEffect, useRef, useState } from "react";
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

type Snapshot = { nodes: Node[]; edges: Edge[] };

export default function Canvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const nodeTypes = { note: NoteNode };

  const [history, setHistory] = useState<Snapshot[]>([
    { nodes: [], edges: [] },
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const saveSnapshot = (nextNodes: Node[], nextEdges: Edge[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ nodes: nextNodes, edges: nextEdges });
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex === 0) return;
    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    setNodes(history[newIndex].nodes);
    setEdges(history[newIndex].edges);
  };

  const redo = () => {
    if (historyIndex >= history.length - 1) return;
    const newIndex = historyIndex + 1;
    setHistoryIndex(newIndex);
    setNodes(history[newIndex].nodes);
    setEdges(history[newIndex].edges);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "z" && !e.shiftKey) {
          e.preventDefault();
          undo();
        }
        if (e.key === "y" || (e.key === "Z" && e.shiftKey)) {
          e.preventDefault();
          redo();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);
  const lastClick = useRef<number>(0);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => {
        const updated = addEdge(connection, eds);
        saveSnapshot(nodes, updated);
        return updated;
      });
    },
    [nodes, historyIndex],
  );

  const onEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      setEdges((eds) => {
        const updated = eds.filter((e) => e.id !== edge.id);
        saveSnapshot(nodes, updated);
        return updated;
      });
    },
    [nodes, historyIndex],
  );

  const onPaneClick = useCallback(
    (event: React.MouseEvent) => {
      const now = Date.now();

      if (now - lastClick.current < 250) {
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
          type: "note",
          position: centeredPosition,
          data: { label: "", isEditing: false },
        };

        setNodes((nds) => {
          const updated = [...nds, newNode];
          saveSnapshot(updated, edges);
          return updated;
        });
      }

      lastClick.current = now;
    },
    [edges, historyIndex],
  );

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#111111" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        minZoom={0.1}
        maxZoom={4}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onPaneClick={onPaneClick}
        onEdgeClick={onEdgeClick}
        zoomOnDoubleClick={false}
        onInit={(instance) => (reactFlowInstance.current = instance)}
        fitView
      >
        <MiniMap />
        <Controls />
        <Background gap={20} size={1} color="#333" />

        <div
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            display: "flex",
            gap: 8,
            zIndex: 1000,
          }}
        >
          <button onClick={undo}>↶</button>
          <button onClick={redo}>↷</button>
        </div>
      </ReactFlow>
    </div>
  );
}
