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
import { supabase } from "../lib/supabase";
import type { Note, DbEdge } from "../types/database";
import NoteNode from "../nodes/NoteNode";

const NODE_WIDTH = 200;
const NODE_HEIGHT = 100;

type Snapshot = { nodes: Node[]; edges: Edge[] };

export default function Canvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const nodeTypes = { note: NoteNode };

  const [history, setHistory] = useState<Snapshot[]>([
    { nodes: [], edges: [] },
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);
  const lastClick = useRef<number>(0);

  /* =========================
     SUPABASE INTEGRATION
  ========================== */

  // 1. Hämta data (noder och edges) vid start
  useEffect(() => {
    const fetchNodes = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) return;

      // Hämta noder
      const { data, error } = await supabase
        .from("nodes")
        .select("*")
        .eq("user_id", session.user.id);

      if (error) {
        console.error("Error fetching nodes:", error);
        return;
      }

      if (data) {
        const loadedNodes = data.map((n: Note) => ({
          id: n.id,
          type: "note",
          position: { x: n.position_x, y: n.position_y },
          style: {
            width: n.width ?? 200, // 🔥 Fix: Standardvärde om null
            height: n.height ?? 100,
          },
          data: {
            title: n.title ?? "",
            label: n.content,
            color: n.color ?? "#f1f1f1",
            isEditing: false,
          },
        }));
        setNodes(loadedNodes);
      }

      // Hämta edges
      const { data: edgeData, error: edgeError } = await supabase
        .from("edges")
        .select("*")
        .eq("user_id", session.user.id);

      if (edgeError) console.error("Error fetching edges:", edgeError);

      if (edgeData) {
        const loadedEdges = edgeData.map((e: DbEdge) => ({
          id: e.id,
          source: e.source,
          target: e.target,
        }));
        setEdges(loadedEdges);
      }
    };

    fetchNodes();
  }, [setNodes]);

  // 1.5 Realtime Subscription (Synk mellan flikar)
  useEffect(() => {
    const channel = supabase
      .channel("brainboard-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "nodes" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newNote = payload.new as Note;
            setNodes((nds) => {
              // Undvik dubbletter om vi själva skapade den
              if (nds.some((n) => n.id === newNote.id)) return nds;
              return [
                ...nds,
                {
                  id: newNote.id,
                  type: "note",
                  position: { x: newNote.position_x, y: newNote.position_y },
                  style: { width: newNote.width, height: newNote.height },
                  data: {
                    title: newNote.title,
                    label: newNote.content,
                    color: newNote.color,
                    isEditing: false,
                  },
                } as Node,
              ];
            });
          }
          if (payload.eventType === "UPDATE") {
            const newNote = payload.new as Note;
            setNodes((nds) =>
              nds.map((n) =>
                n.id === newNote.id
                  ? {
                      ...n,
                      position: {
                        x: newNote.position_x,
                        y: newNote.position_y,
                      },
                      style: {
                        ...n.style,
                        width: newNote.width,
                        height: newNote.height,
                      },
                      data: {
                        ...n.data,
                        title: newNote.title,
                        label: newNote.content,
                        color: newNote.color,
                      },
                    }
                  : n,
              ),
            );
          }
          if (payload.eventType === "DELETE") {
            setNodes((nds) => nds.filter((n) => n.id !== payload.old.id));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [setNodes]);

  // 2. Skapa nod i DB
  const createNodeInDb = useCallback(async (node: Node) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return;

    const { error } = await supabase.from("nodes").insert({
      id: node.id,
      user_id: session.user.id,
      position_x: node.position.x,
      position_y: node.position.y,
      content: node.data.label,
      title: node.data.title ?? "",
      width: node.style?.width ?? 200,
      height: node.style?.height ?? 100,
      color: node.data.color ?? "#f1f1f1",
    });

    if (error) console.error("Error creating node:", error);
    else console.log("Skapade nod i DB:", node.id);
  }, []);

  // 3. Spara (Uppdatera) nod i DB
  const saveNodeToDb = useCallback(
    async (node: Node) => {
      const { data, error } = await supabase
        .from("nodes")
        .update({
          position_x: node.position.x,
          position_y: node.position.y,
          content: node.data.label,
          title: node.data.title,
          width: node.style?.width,
          height: node.style?.height,
          color: node.data.color,
          // Vi skickar med updated_at för att vara säkra på att Supabase ser ändringen
          updated_at: new Date().toISOString(),
        })
        .eq("id", node.id)
        .select(); // Vi ber om data tillbaka för att se om något uppdaterades

      if (error) {
        console.error("Error updating node:", error);
      } else if (data.length === 0) {
        // Om ingen rad uppdaterades, fanns inte noden. Skapa den nu!
        console.warn("Noden fanns inte, skapar den nu:", node.id);
        await createNodeInDb(node);
      } else {
        console.log(
          `Sparade nod ${node.id}: ${node.style?.width}x${node.style?.height}`,
        );
      }
    },
    [createNodeInDb],
  );

  // 4. Ta bort nod från DB
  const deleteNodeFromDb = useCallback(async (nodeId: string) => {
    const { error } = await supabase.from("nodes").delete().eq("id", nodeId);
    if (error) console.error("Error deleting node:", error);
  }, []);

  // 5. Skapa Edge i DB
  const createEdgeInDb = async (edge: Edge) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return;

    const { error } = await supabase.from("edges").insert({
      id: edge.id,
      user_id: session.user.id,
      source: edge.source,
      target: edge.target,
    });
    if (error) console.error("Error creating edge:", error);
  };

  // 6. Ta bort Edge från DB
  const deleteEdgeFromDb = async (edgeId: string) => {
    const { error } = await supabase.from("edges").delete().eq("id", edgeId);
    if (error) console.error("Error deleting edge:", error);
  };

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
    // Obs: Undo/Redo sparar inte automatiskt till DB i denna version för att spara prestanda,
    // men man skulle kunna lägga till en saveNodeToDb här för alla påverkade noder.
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

  /* =========================
     NODE HANDLERS
  ========================== */

  const updateNodeLabel = (nodeId: string, value: string) => {
    // 🔥 FIX: Beräkna nya noder först, sen spara. Inga side-effects i setNodes!
    const updatedNodes = nodes.map((node) => {
      if (node.id === nodeId) {
        const newNode = { ...node, data: { ...node.data, label: value } };
        saveNodeToDb(newNode); // Spara till DB
        return newNode;
      }
      return node;
    });

    setNodes(updatedNodes);
    saveSnapshot(updatedNodes, edges);
  };

  const updateNodeTitle = (nodeId: string, title: string) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          const newNode = { ...node, data: { ...node.data, title } };
          saveNodeToDb(newNode);
          return newNode;
        }
        return node;
      }),
    );
    // Vi sparar inte snapshot för varje bokstav i titeln, onBlur sköter DB-sparandet
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
    deleteNodeFromDb(nodeId); // Ta bort från DB

    // 🔥 FIX: Beräkna nya noder och edges utanför set-funktionen
    const updatedNodes = nodes.filter((node) => node.id !== nodeId);
    const updatedEdges = edges.filter(
      (e) => e.source !== nodeId && e.target !== nodeId,
    );

    setNodes(updatedNodes);
    setEdges(updatedEdges);
    saveSnapshot(updatedNodes, updatedEdges);
  };

  const onResize = useCallback(
    (nodeId: string, width: number, height: number) => {
      setNodes((nds) => {
        const node = nds.find((n) => n.id === nodeId);
        if (node) {
          const updatedNode = {
            ...node,
            style: { ...node.style, width, height },
          };
          // Vi sparar här inne för att vara 100% säkra på att vi har rätt version av noden
          console.log("Resize: Sparar till DB...", width, height);
          saveNodeToDb(updatedNode);
          return nds.map((n) => (n.id === nodeId ? updatedNode : n));
        }
        return nds;
      });
    },
    [saveNodeToDb, setNodes],
  );

  const onColorChange = useCallback(
    (nodeId: string, color: string) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            const updated = { ...node, data: { ...node.data, color } };
            saveNodeToDb(updated);
            return updated;
          }
          return node;
        }),
      );
    },
    [saveNodeToDb, setNodes],
  );

  const createNodeWithHandlers = useCallback(
    (node: Node): Node => ({
      ...node,
      data: {
        ...node.data,
        onChange: updateNodeLabel,
        onTitleChange: updateNodeTitle,
        onStartEditing: startEditing,
        onStopEditing: stopEditing,
        onDelete: deleteNode,
        onResize: onResize,
        onColorChange: onColorChange,
      },
    }),
    [
      updateNodeTitle,
      updateNodeLabel,
      startEditing,
      stopEditing,
      deleteNode,
      onResize,
      onColorChange,
    ],
  );

  /* =========================
     FLOW EVENTS
  ========================== */

  const onConnect = useCallback(
    (connection: Connection) => {
      const newEdge = { ...connection, id: crypto.randomUUID() } as Edge;
      const updatedEdges = addEdge(newEdge, edges);
      setEdges(updatedEdges);
      createEdgeInDb(newEdge); // Spara till DB
      saveSnapshot(nodes, updatedEdges);
    },
    [nodes, edges, historyIndex], // Lägg till edges i deps
  );

  const onEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      const updatedEdges = edges.filter((e) => e.id !== edge.id);
      setEdges(updatedEdges);
      deleteEdgeFromDb(edge.id); // Ta bort från DB
      saveSnapshot(nodes, updatedEdges);
    },
    [nodes, edges, historyIndex],
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
          id: crypto.randomUUID(),
          type: "note",
          position: centeredPosition,
          data: {
            title: "",
            label: "",
            color: "#f1f1f1",
            isEditing: true,
          },
          style: {
            width: 200,
            height: 100, // Vi sätter en start-höjd också för säkerhets skull
          },
        };

        createNodeInDb(newNode);

        // 🔥 FIX
        const updatedNodes = [...nodes, newNode];
        setNodes(updatedNodes);
        saveSnapshot(updatedNodes, edges);
      }

      lastClick.current = now;
    },
    [nodes, edges, historyIndex], // Lägg till nodes i deps
  );

  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      saveNodeToDb(node);
    },
    [saveNodeToDb],
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
        onNodeDragStop={onNodeDragStop}
        zoomOnDoubleClick={false}
        onInit={(instance) => {
          reactFlowInstance.current = instance;
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
