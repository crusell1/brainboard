import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  type Viewport,
} from "@xyflow/react";
import { supabase } from "../lib/supabase";
import type { Note, DbEdge, DbDrawing } from "../types/database";
import NoteNode, { type NoteData } from "../nodes/NoteNode";
import ImageNode from "../nodes/ImageNode";
import RadialMenu from "../components/RadialMenu";
import DrawingLayer from "../components/DrawingLayer";
import type { Drawing, Point } from "../types/drawing";
import DrawModeControls from "../components/DrawModeControls";
import ShareModal from "../components/ShareModal"; // 🔥 Importera ShareModal
import { Share2 } from "lucide-react"; // 🔥 Importera Share-ikon

const NODE_WIDTH = 300;
const NODE_HEIGHT = 200;

type Snapshot = { nodes: Node[]; edges: Edge[] };

export default function Canvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const nodeTypes = useMemo(() => ({ note: NoteNode, image: ImageNode }), []);

  const [history, setHistory] = useState<Snapshot[]>([
    { nodes: [], edges: [] },
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance<
    Node,
    Edge
  > | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [boardId, setBoardId] = useState<string | null>(null); // 🔥 NY: Håll koll på aktiv board
  // 🔥 FIX: Använd useRef för timeout för att undvika race conditions vid dubbelklick
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showShareModal, setShowShareModal] = useState(false); // 🔥 State för ShareModal

  // State för Radial Menu
  const [menuState, setMenuState] = useState<{
    x: number;
    y: number;
    isOpen: boolean;
  }>({ x: 0, y: 0, isOpen: false });

  // State för Draw Mode
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(
    null,
  );
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);

  // Ref för dold fil-input
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* =========================
     VIEWPORT PERSISTENCE
  ========================== */
  const onMoveEnd = useCallback((_event: unknown, viewport: Viewport) => {
    localStorage.setItem("brainboard-viewport", JSON.stringify(viewport));
  }, []);

  const defaultViewport = useMemo(() => {
    try {
      const saved = localStorage.getItem("brainboard-viewport");
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error("Kunde inte ladda viewport:", e);
    }
    return { x: 0, y: 0, zoom: 1 };
  }, []);

  /* =========================
     SUPABASE INTEGRATION
  ========================== */

  // 1. Hämta data (noder och edges) vid start
  useEffect(() => {
    const fetchNodes = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        return;
      }

      // 🔥 JOIN LOGIC: Kolla om vi har en invite-token i URL:en
      const params = new URLSearchParams(window.location.search);
      const inviteToken = params.get("token");

      if (inviteToken) {
        console.log("🔍 Hittade invite-token, försöker gå med i board...");

        // 1. Hämta inbjudan
        const { data: invite, error: inviteError } = await supabase
          .from("board_invites")
          .select("*")
          .eq("token", inviteToken)
          .single();

        if (inviteError || !invite) {
          alert("Ogiltig eller utgången länk.");
        } else {
          // 2. Kolla om den gått ut
          const now = new Date();
          const expiresAt = invite.expires_at
            ? new Date(invite.expires_at)
            : null;

          if (expiresAt && now > expiresAt) {
            alert("Den här länken har gått ut.");
          } else {
            // 3. Lägg till användaren i board_members
            const { error: joinError } = await supabase
              .from("board_members")
              .insert({
                board_id: invite.board_id,
                user_id: session.user.id,
                role: invite.role || "viewer",
              });

            if (joinError && joinError.code !== "23505") {
              // 23505 = unique violation (redan medlem)
              console.error("Kunde inte gå med i board:", joinError);
              alert("Ett fel uppstod när du försökte gå med.");
            } else {
              console.log("✅ Gick med i board (eller var redan medlem)!");
              // Sätt aktiv board till den vi just gick med i
              setBoardId(invite.board_id);
              // Rensa URL:en snyggt
              window.history.replaceState(
                {},
                document.title,
                window.location.pathname,
              );
              return; // Avbryt resten av initieringen för att ladda den nya boarden via useEffect-dependecy
            }
          }
        }
      }

      // 🔥 NY: Board-logik - Hämta eller skapa board
      let activeBoardId = boardId;

      if (!activeBoardId) {
        // 1. Kolla om användaren har några boards
        const { data: boards } = await supabase
          .from("boards")
          .select("id")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: true }) // 🔥 FIX: Ta alltid den äldsta boarden först (stabiliserar reload)
          .limit(1);

        if (boards && boards.length > 0) {
          activeBoardId = boards[0].id;
        } else {
          // 2. Om inte, skapa en "General" board
          const { data: newBoard, error: createError } = await supabase
            .from("boards")
            .insert({ user_id: session.user.id, title: "General" })
            .select()
            .single();

          if (createError) {
            console.error("Kunde inte skapa board (RLS-fel?):", createError);
          }

          if (newBoard) activeBoardId = newBoard.id;
        }
        if (activeBoardId) setBoardId(activeBoardId);
      }

      if (!activeBoardId) {
        console.error("Kunde inte hitta eller skapa en board.");
        return;
      }

      // Hämta noder (Filtrera på board_id)
      const { data, error } = await supabase
        .from("nodes")
        .select("*")
        .eq("user_id", session.user.id)
        .eq("board_id", activeBoardId); // 🔥 Filtrera på board

      if (error) {
        console.error("Error fetching nodes:", error);
        return;
      }

      if (data) {
        const loadedNodes = data.map((n: Note) => ({
          id: n.id,
          type: n.type || "note", // Använd typ från DB, fallback till note
          position: { x: n.position_x, y: n.position_y },
          style: {
            width: n.width ?? NODE_WIDTH,
            height: n.height ?? (n.type === "image" ? undefined : NODE_HEIGHT),
          },
          data: {
            // Om det är en bild ligger URL:en i content, annars är content texten
            src: n.type === "image" ? n.content : undefined,
            title: n.title ?? "",
            label: n.type === "image" ? "Bild" : n.content,
            color: n.color ?? "#f1f1f1",
            isEditing: false,
            tags: (n as any).tags || [],
            summary: (n as any).summary, // 🔥 Hämta summary
            aiTags: (n as any).ai_tags || [], // 🔥 Hämta ai_tags
          },
        }));
        setNodes(loadedNodes);
      }

      // Hämta edges
      const { data: edgeData, error: edgeError } = await supabase
        .from("edges")
        .select("*")
        .eq("user_id", session.user.id)
        .eq("board_id", activeBoardId); // 🔥 Filtrera på board

      if (edgeError) console.error("Error fetching edges:", edgeError);

      if (edgeData) {
        const loadedEdges = edgeData.map((e: DbEdge) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          // 🔥 FIX: Mappa DB-fält (snake_case) till React Flow (camelCase) explicit
          sourceHandle: e.source_handle,
          targetHandle: e.target_handle,
        }));
        setEdges(loadedEdges);
      }

      // Hämta drawings
      const { data: drawingData, error: drawingError } = await supabase
        .from("drawings")
        .select("*")
        .eq("user_id", session.user.id)
        .eq("board_id", activeBoardId); // 🔥 Filtrera på board

      if (drawingError) console.error("Error fetching drawings:", drawingError);

      if (drawingData) {
        const loadedDrawings = drawingData.map((d: DbDrawing) => ({
          id: d.id,
          points: d.points,
          color: d.color,
          width: d.width,
          createdAt: new Date(d.created_at).getTime(),
        }));
        setDrawings(loadedDrawings);
      }
    };

    fetchNodes();
  }, [setNodes, boardId]); // 🔥 Kör om när boardId sätts

  // 1.5 Realtime Subscription (Synk mellan flikar)
  useEffect(() => {
    if (!boardId) return; // Vänta tills vi har en board

    const channel = supabase
      .channel("brainboard-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "nodes" },
        (payload) => {
          // 🔥 Ignorera events från andra boards
          if (payload.new && (payload.new as any).board_id !== boardId) return;

          if (payload.eventType === "INSERT") {
            const newNote = payload.new as Note;
            setNodes((nds) => {
              // Undvik dubbletter om vi själva skapade den
              if (nds.some((n) => n.id === newNote.id)) return nds;
              return [
                ...nds,
                {
                  id: newNote.id,
                  type: newNote.type || "note",
                  position: { x: newNote.position_x, y: newNote.position_y },
                  style: {
                    width: newNote.width,
                    height:
                      newNote.height ??
                      (newNote.type === "image" ? undefined : 100),
                  },
                  data: {
                    src: newNote.type === "image" ? newNote.content : undefined,
                    title: newNote.title,
                    label: newNote.type === "image" ? "Bild" : newNote.content,
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
                        height:
                          newNote.height ??
                          (newNote.type === "image" ? undefined : 100),
                      },
                      data: {
                        ...n.data,
                        src:
                          newNote.type === "image"
                            ? newNote.content
                            : undefined,
                        title: newNote.title,
                        label:
                          newNote.type === "image" ? "Bild" : newNote.content,
                        color: newNote.color,
                        summary: (newNote as any).summary, // 🔥 Synka summary
                        aiTags: (newNote as any).ai_tags || [], // 🔥 Synka ai_tags
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
  }, [setNodes, boardId]); // 🔥 Uppdatera prenumeration om board ändras

  // 2. Skapa nod i DB
  const createNodeInDb = useCallback(
    async (node: Node) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user || !boardId) {
        console.error("Kan inte spara nod: Board ID saknas!");
        return;
      }

      // Om det är en bild, spara URL (src) i content. Annars spara label (text).
      const contentToSave =
        node.type === "image" ? node.data.src : node.data.label;

      const { error } = await supabase.from("nodes").insert({
        id: node.id,
        user_id: session.user.id,
        board_id: boardId, // 🔥 Koppla till board
        type: node.type, // Spara typen!
        position_x: node.position.x,
        position_y: node.position.y,
        content: contentToSave,
        title: node.data.title ?? "",
        width: node.style?.width ?? NODE_WIDTH,
        height:
          node.style?.height ??
          (node.type === "image" ? undefined : NODE_HEIGHT),
        color: node.data.color ?? "#f1f1f1",
        tags: node.data.tags || [],
      });

      if (error) console.error("Error creating node:", error);
      else console.log("Skapade nod i DB:", node.id);
    },
    [boardId],
  ); // 🔥 Lägg till boardId i deps

  // 3. Spara (Uppdatera) nod i DB
  const saveNodeToDb = useCallback(
    async (node: Node) => {
      const contentToSave =
        node.type === "image" ? node.data.src : node.data.label;

      const { data, error } = await supabase
        .from("nodes")
        .update({
          position_x: node.position.x,
          position_y: node.position.y,
          content: contentToSave,
          title: node.data.title,
          width: node.style?.width,
          height: node.style?.height,
          color: node.data.color,
          tags: node.data.tags || [],
          summary: (node.data as any).summary, // 🔥 FIX: Spara summary
          ai_tags: (node.data as any).aiTags || [], // 🔥 FIX: Spara AI-taggar (mappa camelCase -> snake_case)
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

  // 4.5 Ta bort fil från Storage (Hjälpfunktion)
  const deleteImageFromStorage = async (publicUrl: string) => {
    try {
      // URL format: .../storage/v1/object/public/images/USER_ID/FILENAME
      // Vi behöver extrahera: USER_ID/FILENAME
      // Vi antar att bucketen heter "images" baserat på upload-koden
      const pathParts = publicUrl.split("/images/");
      if (pathParts.length < 2) {
        console.warn("Kunde inte extrahera sökväg från URL:", publicUrl);
        return;
      }

      // Ta den sista delen (om URL:en innehåller flera '/images/' av någon anledning)
      const filePath = pathParts[pathParts.length - 1];

      console.log("Tar bort fil från storage:", filePath);

      const { error } = await supabase.storage
        .from("images")
        .remove([filePath]);

      if (error) console.error("Error removing file from storage:", error);
    } catch (err) {
      console.error("Exception removing file:", err);
    }
  };

  // 5. Skapa Edge i DB
  const createEdgeInDb = useCallback(
    async (edge: Edge) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user || !boardId) return;

      const { error } = await supabase.from("edges").insert({
        id: edge.id,
        user_id: session.user.id,
        source: edge.source,
        target: edge.target,
        source_handle: edge.sourceHandle, // React Flow använder 'sourceHandle'
        target_handle: edge.targetHandle, // React Flow använder 'targetHandle'
        board_id: boardId, // 🔥 Koppla till board
      });
      if (error) console.error("Error creating edge:", error);
    },
    [boardId],
  );

  // 6. Ta bort Edge från DB
  const deleteEdgeFromDb = async (edgeId: string) => {
    const { error } = await supabase.from("edges").delete().eq("id", edgeId);
    if (error) console.error("Error deleting edge:", error);
  };

  // 7. Skapa Drawing i DB
  const createDrawingInDb = useCallback(
    async (drawing: Drawing) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user || !boardId) return;

      const { error } = await supabase.from("drawings").insert({
        id: drawing.id,
        user_id: session.user.id,
        board_id: boardId, // 🔥 Koppla till board
        points: drawing.points, // Supabase hanterar JSON-konvertering automatiskt oftast, annars JSON.stringify
        color: drawing.color,
        width: drawing.width,
      });

      if (error) console.error("Error creating drawing:", error);
    },
    [boardId],
  );

  // 8. Ta bort Drawing från DB
  const deleteDrawingFromDb = async (drawingId: string) => {
    const { error } = await supabase
      .from("drawings")
      .delete()
      .eq("id", drawingId);
    if (error) console.error("Error deleting drawing:", error);
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

  // Gemensam städ-funktion för både "X"-klick och Backspace
  const cleanupNode = useCallback(
    async (node: Node) => {
      // 1. Ta bort från DB
      deleteNodeFromDb(node.id);

      // 2. Om det är en bild, ta bort från Storage
      if (
        node.type === "image" &&
        node.data.src &&
        typeof node.data.src === "string"
      ) {
        await deleteImageFromStorage(node.data.src);
      }
    },
    [deleteNodeFromDb],
  );

  // Hanterare för "X"-klick (Manuell borttagning)
  const deleteNodeManual = useCallback(
    (nodeId: string) => {
      // Hitta noden innan vi tar bort den från state
      const nodeToDelete = nodes.find((n) => n.id === nodeId);

      if (nodeToDelete) {
        cleanupNode(nodeToDelete); // Kör DB/Storage städning

        // Uppdatera React State
        const updatedNodes = nodes.filter((node) => node.id !== nodeId);
        const updatedEdges = edges.filter(
          (e) => e.source !== nodeId && e.target !== nodeId,
        );

        setNodes(updatedNodes);
        setEdges(updatedEdges);
        saveSnapshot(updatedNodes, updatedEdges);
      }
    },
    [nodes, edges, cleanupNode, setNodes, setEdges],
  );

  // Hanterare för Backspace (React Flow event)
  const onNodesDelete = useCallback(
    (deletedNodes: Node[]) => {
      // React Flow har redan tagit bort dem från state visuellt, vi behöver bara städa DB/Storage
      deletedNodes.forEach(cleanupNode);
    },
    [cleanupNode],
  );

  const onResize = useCallback(
    (nodeId: string, width: number, height: number) => {
      setNodes((nds) => {
        const node = nds.find((n) => n.id === nodeId);
        if (node) {
          const updatedNode = {
            ...node,
            style: { ...node.style, width, height },
          };
          return nds.map((n) => (n.id === nodeId ? updatedNode : n));
        }
        return nds;
      });
    },
    [setNodes],
  );

  // 🔥 NY: Spara bara till DB när storleksändringen är KLAR (för prestanda)
  const onResizeEnd = useCallback(
    (nodeId: string, width: number, height: number) => {
      // 🔥 OPTIMERING: Använd instansen istället för 'nodes' state för att slippa omrenderingar
      const node = reactFlowInstance?.getNode(nodeId);
      if (node) {
        const updatedNode = {
          ...node,
          style: { ...node.style, width, height },
        };
        console.log("Resize End: Sparar till DB...", width, height);
        saveNodeToDb(updatedNode);
      }
    },
    [reactFlowInstance, saveNodeToDb],
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

  const updateNodeTags = useCallback(
    (nodeId: string, tags: string[]) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            const newNode = { ...node, data: { ...node.data, tags } };
            saveNodeToDb(newNode);
            return newNode;
          }
          return node;
        }),
      );
    },
    [saveNodeToDb, setNodes],
  );

  const updateNodeAiTags = useCallback(
    (nodeId: string, aiTags: string[]) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            // Vi uppdaterar ai_tags i data-objektet
            const newNode = { ...node, data: { ...node.data, aiTags } };
            saveNodeToDb(newNode);
            return newNode;
          }
          return node;
        }),
      );
    },
    [saveNodeToDb, setNodes],
  );

  const updateNodeSummary = useCallback(
    (nodeId: string, summary: string) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            const newNode = { ...node, data: { ...node.data, summary } };
            saveNodeToDb(newNode);
            return newNode;
          }
          return node;
        }),
      );
    },
    [saveNodeToDb, setNodes],
  );

  const onMagic = useCallback(
    async (nodeId: string, action: "organize" | "analyze" = "organize") => {
      // 🔥 FIX: Använd instansen för att hämta noden, så vi slipper beroende till 'nodes'
      const node = reactFlowInstance?.getNode(nodeId);
      if (!node) return;

      // 🔥 NY: Hämta alla existerande taggar för att guida AI
      const allNodes = reactFlowInstance?.getNodes() || [];
      const existingTags = Array.from(
        new Set(allNodes.flatMap((n) => (n.data.tags as string[]) || [])),
      );

      console.log(`✨ AI Magic (${action}) startad för nod:`, nodeId);

      // 1. Sätt noden i "processing" state
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return { ...node, data: { ...node.data, isProcessing: true } };
          }
          return node;
        }),
      );

      try {
        // 🔥 FIX: Hämta session explicit för att säkerställa att vi har en token
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          throw new Error("Du måste vara inloggad för att använda AI.");
        }

        // 2. Anropa Edge Function på riktigt
        const { data, error } = await supabase.functions.invoke(
          "analyze-node",
          {
            body: {
              nodeId,
              content: node.data.label || "", // Skicka texten (HTML från editorn), fallback till tom sträng
              action: action, // 🔥 Skicka vald action
              availableTags: existingTags, // 🔥 Skicka med befintliga taggar till AI
            },
            // 🔥 FIX: Skicka med token explicit ifall klienten tappat den
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          },
        );

        if (error) throw error;

        console.log("✨ AI svar mottaget:", data);

        // 3. Uppdatera UI med svaret direkt (för snabbhet)
        // Hämta noden igen för att vara säker på att vi har senaste state
        const currentNode = reactFlowInstance?.getNode(nodeId);
        if (currentNode) {
          const updatedData = {
            ...currentNode.data,
            isProcessing: false,
          } as NoteData;

          if (action === "organize") {
            updatedData.label = data.data.content;
          } else if (action === "analyze") {
            updatedData.summary = data.data.summary;

            // 🔥 FIX: Filtrera taggar strikt mot existerande och välj max 1
            const rawTags = (data.data.tags as string[]) || [];
            const validTags = rawTags.filter((t) => existingTags.includes(t));

            updatedData.aiTags = validTags.length > 0 ? [validTags[0]] : [];
          }

          const updatedNode = { ...currentNode, data: updatedData };

          // Uppdatera state
          setNodes((nds) =>
            nds.map((n) => (n.id === nodeId ? updatedNode : n)),
          );

          // Spara till DB
          saveNodeToDb(updatedNode);
        }
      } catch (err) {
        console.error("AI Analysis failed:", err);
        // Återställ processing state vid fel
        setNodes((nds) =>
          nds.map((n) =>
            n.id === nodeId
              ? { ...n, data: { ...n.data, isProcessing: false } }
              : n,
          ),
        );
      }
    },
    [reactFlowInstance, setNodes, saveNodeToDb], // 🔥 FIX: Tog bort 'nodes' från deps för stabilitet
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
        onDelete: deleteNodeManual,
        onResize: onResize,
        onResizeEnd: onResizeEnd, // Skicka med den nya funktionen
        onColorChange: onColorChange,
        onMagic: onMagic,
        onTagsChange: updateNodeTags,
        onAiTagsChange: updateNodeAiTags,
        onSummaryChange: updateNodeSummary,
      },
    }),
    [
      updateNodeTitle,
      updateNodeLabel,
      startEditing,
      stopEditing,
      deleteNodeManual,
      onResize,
      onResizeEnd,
      onColorChange,
      onMagic,
      updateNodeTags,
      updateNodeAiTags,
      updateNodeSummary,
    ],
  );

  /* =========================
     SEARCH LOGIC
  ========================== */
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 1. Debounce: Uppdatera debouncedTerm efter 300ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedTerm(searchTerm);
      setActiveMatchIndex(0);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // 2. Identifiera matchningar och hela det kopplade nätverket (BFS)
  const { matchingNodeIds, visibleNodeIds } = useMemo(() => {
    if (!debouncedTerm)
      return {
        matchingNodeIds: new Set<string>(),
        visibleNodeIds: new Set<string>(),
      };

    const matches = new Set<string>();
    const lowerTerm = debouncedTerm.toLowerCase();

    // Steg 1: Hitta direkta text-matchningar
    nodes.forEach((node) => {
      const label = typeof node.data.label === "string" ? node.data.label : "";
      const title = typeof node.data.title === "string" ? node.data.title : "";

      // 🔥 FIX: Sök även i taggar
      const tags = Array.isArray(node.data.tags) ? node.data.tags : [];
      const hasTagMatch = tags.some((tag) =>
        tag.toLowerCase().includes(lowerTerm),
      );

      if (
        label.toLowerCase().includes(lowerTerm) ||
        title.toLowerCase().includes(lowerTerm) ||
        hasTagMatch
      ) {
        matches.add(node.id);
      }
    });

    // Steg 2: Bygg Adjacency List (Graf) för att kunna traversera
    const adj = new Map<string, string[]>();
    edges.forEach((edge) => {
      if (!adj.has(edge.source)) adj.set(edge.source, []);
      if (!adj.has(edge.target)) adj.set(edge.target, []);

      // Lägg till koppling åt båda hållen (undirected graph)
      adj.get(edge.source)!.push(edge.target);
      adj.get(edge.target)!.push(edge.source);
    });

    // Steg 3: BFS Traversal för att hitta hela subgraphen
    const visited = new Set<string>(matches); // Alla matchningar är automatiskt besökta/synliga
    const queue = Array.from(matches); // Starta sökningen från matchningarna

    while (queue.length > 0) {
      const currentNodeId = queue.shift()!;
      const neighbors = adj.get(currentNodeId) || [];

      for (const neighborId of neighbors) {
        if (!visited.has(neighborId)) {
          visited.add(neighborId); // Markera som synlig
          queue.push(neighborId); // Lägg i kön för att kolla dess grannar
        }
      }
    }

    return { matchingNodeIds: matches, visibleNodeIds: visited };
  }, [nodes, edges, debouncedTerm]);

  // 3. Visualisering: Noder (Krav 3 & 4)
  const displayNodes = useMemo(() => {
    return nodes.map((node) => {
      const isMatch = matchingNodeIds.has(node.id);
      const isVisible = visibleNodeIds.has(node.id);

      // Dimma om sökning pågår men noden inte är en del av det synliga nätverket
      const isDimmed = debouncedTerm !== "" && !isVisible;

      const nodeWithHandlers = createNodeWithHandlers(node);

      return {
        ...nodeWithHandlers,
        hidden: false, // Vi gömmer aldrig noder nu
        style: {
          ...node.style,
          opacity: isDimmed ? 0.2 : 1,
          transition: "opacity 0.3s ease",
        },
        data: {
          ...nodeWithHandlers.data,
          searchTerm: debouncedTerm,
          isMatch: isMatch,
          isConnected: isVisible,
        },
      };
    });
  }, [
    nodes,
    matchingNodeIds,
    visibleNodeIds,
    debouncedTerm,
    createNodeWithHandlers,
  ]);

  // 4. Visualisering: Edges (Krav 3)
  const displayEdges = useMemo(() => {
    if (!debouncedTerm) return edges;

    return edges.map((edge) => {
      // Visa edge tydligt om BÅDA ändarna är en del av det synliga nätverket
      const isRelevant =
        visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target);

      return {
        ...edge,
        style: {
          ...edge.style,
          opacity: isRelevant ? 1 : 0.1,
          stroke: isRelevant ? "#fff" : "#333",
        },
        animated: isRelevant, // Extra tydlighet
      };
    });
  }, [edges, visibleNodeIds, debouncedTerm]);

  // 5. Navigation: Lista över direkta träffar att hoppa mellan
  const navigationMatches = useMemo(() => {
    if (!debouncedTerm) return [];
    return displayNodes.filter((n) => matchingNodeIds.has(n.id));
  }, [displayNodes, matchingNodeIds, debouncedTerm]);

  // 6. Zoom: Panorera till aktiv match
  useEffect(() => {
    if (!reactFlowInstance || navigationMatches.length === 0) return;

    const safeIndex = activeMatchIndex % navigationMatches.length;
    const node = navigationMatches[safeIndex];

    if (node && node.width && node.height) {
      const x = node.position.x + node.width / 2;
      const y = node.position.y + node.height / 2;
      reactFlowInstance.setCenter(x, y, { zoom: 1.2, duration: 500 });
    }
  }, [activeMatchIndex, navigationMatches, reactFlowInstance]);

  // 7. Globala tangentbordsgenvägar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+F / Ctrl+F
      if ((e.metaKey || e.ctrlKey) && (e.key === "f" || e.code === "KeyF")) {
        e.preventDefault();
        e.stopPropagation();
        searchInputRef.current?.focus();
      }
      // Escape
      if (e.key === "Escape") {
        setSearchTerm("");
        searchInputRef.current?.blur();
        // Avsluta draw mode vid escape
        setIsDrawingMode(false);
        setSelectedDrawingId(null);
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedDrawingId) {
        deleteDrawingFromDb(selectedDrawingId); // Ta bort från DB
        setDrawings((prev) => prev.filter((d) => d.id !== selectedDrawingId));
        setSelectedDrawingId(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedDrawingId]); // Lägg till selectedDrawingId i deps

  /* =========================
     DRAWING HANDLERS
  ========================== */

  const onDrawingMouseDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      // Rita endast med vänsterklick (button 0) och om draw mode är aktivt
      if (!isDrawingMode || !reactFlowInstance) return;

      let clientX, clientY;

      if ("touches" in e) {
        // Touch event
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        // Mouse event - kolla vänsterklick
        if (e.button !== 0) return;
        clientX = e.clientX;
        clientY = e.clientY;
      }

      // Stoppa propagation så inte React Flow börjar markera/panorera
      e.stopPropagation();

      const point = reactFlowInstance.screenToFlowPosition({
        x: clientX,
        y: clientY,
      });
      setIsDrawing(true);
      setCurrentPoints([point]);
    },
    [isDrawingMode, reactFlowInstance],
  );

  const onDrawingMouseMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawing || !reactFlowInstance) return;

      e.stopPropagation(); // Förhindra hover-effekter på noder under

      let clientX, clientY;
      if ("touches" in e) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      const point = reactFlowInstance.screenToFlowPosition({
        x: clientX,
        y: clientY,
      });
      setCurrentPoints((prev) => [...prev, point]);
    },
    [isDrawing, reactFlowInstance],
  );

  const onDrawingMouseUp = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawing) return;

      e.stopPropagation(); // Förhindra att klicket går vidare (t.ex. onPaneClick)

      setIsDrawing(false);

      if (currentPoints.length > 1) {
        const newDrawing: Drawing = {
          id: crypto.randomUUID(),
          points: currentPoints,
          color: "#ff0055",
          width: 4,
          createdAt: Date.now(),
        };
        setDrawings((prev) => [...prev, newDrawing]);
        createDrawingInDb(newDrawing); // Spara till DB
      }
      setCurrentPoints([]);
    },
    [isDrawing, currentPoints, createDrawingInDb],
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
    [nodes, edges, historyIndex, createEdgeInDb], // Lägg till edges i deps
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
      // Om vi ritar, gör inget här
      if (isDrawingMode) return;

      // Avmarkera ritning om man klickar på bakgrunden
      setSelectedDrawingId(null);

      // Stäng menyn om den är öppen
      if (menuState.isOpen) {
        setMenuState((prev) => ({ ...prev, isOpen: false }));
        return;
      }

      // Rensa eventuell existerande timer för att vara säker
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
      }

      let x = event.clientX;
      let y = event.clientY;

      // 🔥 FIX: Beräkna koordinater relativt containern för att RadialMenu (absolute) ska hamna rätt
      if (containerRef.current) {
        const bounds = containerRef.current.getBoundingClientRect();
        x -= bounds.left;
        y -= bounds.top;
      }

      // 🔥 FIX: Spara timer i ref. 250ms delay för att vänta på dubbelklick.
      clickTimeoutRef.current = setTimeout(() => {
        setMenuState({ x, y, isOpen: true });
        clickTimeoutRef.current = null;
      }, 300); // 🔥 FIX: Öka till 300ms för att inte blockera långsamma dubbelklick
    },
    [isDrawingMode, menuState.isOpen],
  );

  // 🔥 FIX: Stäng menyn när man klickar på en nod
  const onNodeClick = useCallback(
    (_event: React.MouseEvent, _node: Node) => {
      if (menuState.isOpen) {
        setMenuState((prev) => ({ ...prev, isOpen: false }));
      }
    },
    [menuState.isOpen],
  );

  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      saveNodeToDb(node);
    },
    [saveNodeToDb],
  );

  /* =========================
     IMAGE HANDLING
  ========================== */

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file || !reactFlowInstance) return;

    // 1. Kontrollera att användaren är inloggad
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      console.error("Du måste vara inloggad för att ladda upp bilder");
      return;
    }

    // 2. Förbered filnamn och sökväg (userId/uuid.ext)
    const fileExt = file.name.split(".").pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `${session.user.id}/${fileName}`;

    // 3. Ladda upp till Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("images")
      .upload(filePath, file);

    if (uploadError) {
      console.error("Error uploading image:", uploadError);
      return;
    }

    // 4. Hämta publik URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("images").getPublicUrl(filePath);

    // 5. Skapa nod med URL
    const flowPosition = reactFlowInstance.screenToFlowPosition({
      x: menuState.x,
      y: menuState.y,
    });

    const centeredPosition = {
      x: flowPosition.x - 100,
      y: flowPosition.y - 100,
    };

    const newImageNode: Node = {
      id: crypto.randomUUID(),
      type: "image",
      position: centeredPosition,
      data: {
        src: publicUrl, // Använd URL från Supabase
        label: "Bild",
      },
      // 🔥 VIKTIGT: Sätt en fast standardbredd så bilden inte exploderar i storlek
      style: {
        width: 300,
      },
    };

    // Spara till DB och uppdatera state
    createNodeInDb(newImageNode);

    const updatedNodes = [...nodes, newImageNode];
    setNodes(updatedNodes);
    saveSnapshot(updatedNodes, edges);

    // Återställ input så man kan välja samma fil igen om man vill
    event.target.value = "";
  };

  const handleMenuSelect = (optionId: string) => {
    // Stäng menyn direkt
    setMenuState((prev) => ({ ...prev, isOpen: false }));

    if (optionId === "draw") {
      setIsDrawingMode(true);
      return;
    }

    if (optionId === "image") {
      // Trigga den dolda fil-inputen
      fileInputRef.current?.click();
      return;
    }

    if (optionId === "node") {
      if (!reactFlowInstance) return;

      // 1. Konvertera skärmkoordinater (från menyn) till React Flow-koordinater
      const flowPosition = reactFlowInstance.screenToFlowPosition({
        x: menuState.x,
        y: menuState.y,
      });

      // 2. Centrera noden runt klickpunkten
      const centeredPosition = {
        x: flowPosition.x - NODE_WIDTH / 2,
        y: flowPosition.y - NODE_HEIGHT / 2,
      };

      // 3. Skapa noden (direkt i edit-mode)
      const newNode: Node = {
        id: crypto.randomUUID(),
        type: "note",
        position: centeredPosition,
        data: {
          title: "",
          label: "",
          color: "#f1f1f1",
          isEditing: true, // Fokusera direkt
        },
        style: {
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
        },
      };

      createNodeInDb(newNode);

      const updatedNodes = [...nodes, newNode];
      setNodes(updatedNodes);
      saveSnapshot(updatedNodes, edges);
    }

    if (optionId === "voice") {
      if (!reactFlowInstance) return;

      // 1. Konvertera skärmkoordinater till React Flow-koordinater
      const flowPosition = reactFlowInstance.screenToFlowPosition({
        x: menuState.x,
        y: menuState.y,
      });

      // 2. Centrera noden
      const centeredPosition = {
        x: flowPosition.x - NODE_WIDTH / 2,
        y: flowPosition.y - NODE_HEIGHT / 2,
      };

      // 3. Skapa noden med startListening: true
      const newNode: Node = {
        id: crypto.randomUUID(),
        type: "note",
        position: centeredPosition,
        data: {
          title: "",
          label: "",
          color: "#f1f1f1",
          isEditing: true,
          startListening: true, // 🔥 Detta triggar mikrofonen direkt
        },
        style: { width: NODE_WIDTH, height: NODE_HEIGHT },
      };

      createNodeInDb(newNode);
      const updatedNodes = [...nodes, newNode];
      setNodes(updatedNodes);
      saveSnapshot(updatedNodes, edges);
    }

    // Hantera AI-actions (Placeholder för framtida logik)
    if (optionId.startsWith("ai-")) {
      if (!reactFlowInstance) return;

      // Hitta noden som menyn öppnades över (eller närmaste valda)
      // För enkelhetens skull, låt oss anta att vi jobbar med den senast valda noden eller skapar en ny om ingen är vald.
      // Men i ditt fall verkar menyn öppnas på en tom yta eller över en nod.
      // Om vi klickar "AI" i menyn, vill vi oftast applicera det på en *befintlig* nod om vi högerklickade på den,
      // eller skapa en ny om vi klickade på canvas.

      // I din nuvarande implementation av onPaneClick öppnas menyn på koordinater.
      // Vi behöver veta vilken nod som är "aktiv".
      // Låt oss söka efter en vald nod.
      const selectedNode = nodes.find((n) => n.selected);

      if (selectedNode && optionId === "ai-organize") {
        onMagic(selectedNode.id, "organize");
      }
      // Stäng menyn (redan hanterat i början av funktionen)
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        width: "100vw",
        height: "100vh",
        background: "#111111",
        position: "relative", // 🔥 FIX: Nödvändigt för att RadialMenu (absolute) ska positioneras korrekt relativt denna container
        touchAction: "none", // 🔥 FIX: Förhindrar att webbläsaren zoomar hela sidan på mobil (fixar hackig zoom)
      }}
    >
      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        defaultViewport={defaultViewport}
        onMoveEnd={onMoveEnd}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        minZoom={0.1}
        maxZoom={4}
        // 🔥 RENSA ALLA LÅSNINGAR - Låt React Flow vara React Flow
        panOnDrag={true}
        zoomOnScroll={true}
        zoomOnPinch={true}
        zoomOnDoubleClick={false}
        panOnScroll={false} // VIKTIGT: False så att scroll zoomar istället för panorerar
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgeClick={onEdgeClick}
        onNodesDelete={onNodesDelete} // 🔥 Koppla in Backspace-hantering
        onNodeClick={onNodeClick} // 🔥 FIX: Koppla in klick-hantering för noder
        onPaneClick={onPaneClick}
        onNodeDragStop={onNodeDragStop}
        onInit={(instance) => {
          setReactFlowInstance(
            instance as unknown as ReactFlowInstance<Node, Edge>,
          );
        }}
      >
        <MiniMap />

        {/* Drawing Layer - Ligger inuti ReactFlow för att få tillgång till context */}
        <DrawingLayer
          drawings={drawings}
          currentPoints={currentPoints}
          isDrawingMode={isDrawingMode}
          selectedDrawingId={selectedDrawingId}
          onSelectDrawing={setSelectedDrawingId}
          onDeleteDrawing={(id) => {
            deleteDrawingFromDb(id);
            setDrawings((prev) => prev.filter((d) => d.id !== id));
            setSelectedDrawingId(null);
          }}
          // Vi skickar handlers hit istället för till ReactFlow
          onMouseDown={onDrawingMouseDown}
          onMouseMove={onDrawingMouseMove}
          onMouseUp={onDrawingMouseUp}
          onTouchStart={onDrawingMouseDown}
          onTouchMove={onDrawingMouseMove}
          onTouchEnd={onDrawingMouseUp}
        />

        {/* Ge Controls högre z-index än DrawingLayer (1500) så knapparna går att klicka på */}
        <Controls style={{ zIndex: 2000 }} />
        <Background gap={20} size={1} color="#333" />

        {/* Sök-input */}
        <div
          style={{
            position: "absolute",
            top: 10,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div style={{ position: "relative" }}>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Sök"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (navigationMatches.length === 0) return;
                  if (e.shiftKey) {
                    // Föregående (cyklisk)
                    setActiveMatchIndex((prev) =>
                      prev === 0 ? navigationMatches.length - 1 : prev - 1,
                    );
                  } else {
                    // Nästa (cyklisk)
                    setActiveMatchIndex(
                      (prev) => (prev + 1) % navigationMatches.length,
                    );
                  }
                }
              }}
              style={{
                padding: "8px 32px 8px 12px", // Extra padding höger för krysset
                borderRadius: "8px",
                border: "1px solid #555",
                background: "#222",
                color: "#fff",
                outline: "none",
                minWidth: "200px",
              }}
            />
            {searchTerm && (
              <button
                onClick={() => {
                  setSearchTerm("");
                  searchInputRef.current?.focus();
                }}
                style={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  color: "#888",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "bold",
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Träffräknare */}
          {searchTerm && (
            <div
              style={{
                marginTop: 4,
                fontSize: "12px",
                color: navigationMatches.length > 0 ? "#aaa" : "#ff6b6b",
                background: "rgba(0,0,0,0.5)",
                padding: "2px 8px",
                borderRadius: "4px",
              }}
            >
              {navigationMatches.length === 0
                ? "Inga träffar"
                : `${(activeMatchIndex % navigationMatches.length) + 1} / ${navigationMatches.length} träff${
                    navigationMatches.length === 1 ? "" : "ar"
                  }`}
            </div>
          )}
        </div>

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
          {/* 🔥 Share Button */}
          <button
            onClick={() => setShowShareModal(true)}
            style={{
              background: "#6366f1",
              border: "none",
              borderRadius: "8px",
              padding: "8px 12px",
              color: "white",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontWeight: 600,
              fontSize: "14px",
            }}
          >
            <Share2 size={16} />
            Dela
          </button>

          <button onClick={undo}>↶</button>
          <button onClick={redo}>↷</button>
        </div>

        {/* Indikator för Draw Mode */}
        {isDrawingMode && (
          <DrawModeControls
            onExit={() => {
              setIsDrawingMode(false);
              setSelectedDrawingId(null);
              setIsDrawing(false);
            }}
          />
        )}
      </ReactFlow>

      {/* Radial Menu - Ligger utanför ReactFlow för att använda skärmkoordinater */}
      <RadialMenu
        x={menuState.x}
        y={menuState.y}
        isOpen={menuState.isOpen}
        onClose={() => setMenuState((prev) => ({ ...prev, isOpen: false }))}
        onSelect={handleMenuSelect}
      />

      {/* Dold input för bilduppladdning */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: "none" }}
        accept="image/*"
        onChange={handleFileChange}
      />

      {/* 🔥 Share Modal */}
      {showShareModal && boardId && (
        <ShareModal
          boardId={boardId}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
}
