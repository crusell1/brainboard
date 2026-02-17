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

type StoredNode = {
  id: string;
  type?: string;
  position: { x: number; y: number };
  width?: number;
  height?: number;
  data?: { label?: unknown };
};

type StoredState = {
  nodes: StoredNode[];
  edges: Edge[];
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  };
};

function loadInitialState(): StoredState {
  try {
    const saved = localStorage.getItem("brainboard");
    if (!saved) return { nodes: [], edges: [] };

    const parsed = JSON.parse(saved);

    const nodes = (parsed.nodes || []) as StoredNode[];
    const edges = (parsed.edges || []) as Edge[];
    const viewport = parsed.viewport;

    // Uppdatera id-räknaren så vi inte krockar
    const ids = nodes
      .map((n) => {
        const m = String(n.id).match(/^node_(\d+)$/);
        return m ? Number(m[1]) : -1;
      })
      .filter((n) => n >= 0);

    if (ids.length > 0) id = Math.max(...ids) + 1;

    return { nodes, edges, viewport };
  } catch {
    return { nodes: [], edges: [] };
  }
}

export default function Canvas() {
  // 🔥 Läs localStorage innan states initieras (stabilt, ingen race)
  const initial = useRef<StoredState>(loadInitialState());

  const storedNodes = initial.current.nodes.map((n) => ({
    id: n.id,
    type: n.type ?? "note",
    position: n.position,
    width: n.width,
    height: n.height,
    data: {
      label: typeof n.data?.label === "string" ? n.data.label : "",
      isEditing: false,
    },
  }));

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(storedNodes);

  const storedEdges = initial.current.edges || [];

  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(storedEdges);

  const nodeTypes = { note: NoteNode };

  const [history, setHistory] = useState<Snapshot[]>([
    { nodes: [], edges: [] },
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);
  const lastClick = useRef<number>(0);

  /* =========================
     HISTORY HELPERS
  ========================== */

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

  // Initiera history från initialt laddade data (så ctrl+z känns rätt)
  useEffect(() => {
    saveSnapshot(nodes, edges);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  /* =========================
     NODE HANDLERS
  ========================== */

  const updateNodeLabel = (nodeId: string, value: string) => {
    setNodes((nds) => {
      const updated = nds.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, label: value } }
          : node,
      );
      saveSnapshot(updated, edges);
      return updated;
    });
  };

  const startEditing = (nodeId: string) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, isEditing: true } }
          : node,
      ),
    );
  };

  const stopEditing = (nodeId: string) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, isEditing: false } }
          : node,
      ),
    );
  };

  const deleteNode = (nodeId: string) => {
    setNodes((nds) => {
      const updated = nds.filter((node) => node.id !== nodeId);
      saveSnapshot(updated, edges);
      return updated;
    });

    // ta även bort edges kopplade till noden
    setEdges((eds) => {
      const updated = eds.filter(
        (e) => e.source !== nodeId && e.target !== nodeId,
      );
      saveSnapshot(nodes, updated);
      return updated;
    });
  };

  const createNodeWithHandlers = (node: Node): Node => ({
    ...node,
    data: {
      ...node.data,
      onChange: updateNodeLabel,
      onStartEditing: startEditing,
      onStopEditing: stopEditing,
      onDelete: deleteNode,
    },
  });

  /* =========================
     PERSISTENCE (SAVE)
  ========================== */

  useEffect(() => {
    const cleanNodes: StoredNode[] = nodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: node.position,
      width: node.width,
      height: node.height,
      data: { label: node.data?.label ?? "" },
    }));

    const viewport = reactFlowInstance.current?.getViewport();

    localStorage.setItem(
      "brainboard",
      JSON.stringify({
        nodes: cleanNodes,
        edges,
        viewport,
      }),
    );
  }, [nodes, edges]);

  /* =========================
     FLOW EVENTS
  ========================== */

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

        const newNode: Node = createNodeWithHandlers({
          id: getId(),
          type: "note",
          position: centeredPosition,
          data: {
            label: "",
            isEditing: true,
          },
          style: {
            width: 150,
          },
        });

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
        nodes={nodes.map(createNodeWithHandlers)}
        edges={edges}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        minZoom={0.1}
        maxZoom={4}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        zoomOnDoubleClick={false}
        onInit={(instance) => {
          reactFlowInstance.current = instance;

          const saved = initial.current.viewport;

          if (saved) {
            setTimeout(() => {
              instance.setViewport(saved);
            }, 0);
          }
        }}
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
