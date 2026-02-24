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
import PomodoroNode from "../pomodoro/PomodoroNode"; // 🔥 Importera PomodoroNode
import LinkNode from "../nodes/LinkNode"; // 🔥 Importera LinkNode
import YouTubeNode from "../components/YouTubeNode"; // 🔥 Importera YouTubeNode
import RadialMenu from "../components/RadialMenu";
import DrawingLayer from "../components/DrawingLayer";
import CursorLayer from "../components/CursorLayer"; // 🔥 Importera CursorLayer
import type { Drawing, Point } from "../types/drawing";
import DrawModeControls from "../components/DrawModeControls";
import ImageUrlModal from "../components/ImageUrlModal"; // 🔥 Importera ImageUrlModal
import ShareModal from "../components/ShareModal"; // 🔥 Importera ShareModal
import ConfirmModal from "../components/ConfirmModal"; // 🔥 Importera ConfirmModal
import SpotifyPlayer from "../components/SpotifyPlayer"; // 🔥 Importera SpotifyPlayer
import { spotifyApi } from "../lib/spotify"; // 🔥 Importera spotifyApi
import {
  Share2,
  Pencil,
  Check,
  X as XIcon,
  Trash2,
  LogOut,
  Menu,
  Search,
  RotateCcw,
  RotateCw,
  User,
  Wifi,
  WifiOff,
} from "lucide-react"; // 🔥 Importera ikoner

const NODE_WIDTH = 300;
const NODE_HEIGHT = 200;

type Snapshot = { nodes: Node[]; edges: Edge[] };

// Färger för cursors
const CURSOR_COLORS = [
  "#f43f5e",
  "#ec4899",
  "#d946ef",
  "#8b5cf6",
  "#6366f1",
  "#3b82f6",
  "#06b6d4",
  "#10b981",
  "#84cc16",
  "#f59e0b",
  "#f97316",
];
const getRandomColor = () =>
  CURSOR_COLORS[Math.floor(Math.random() * CURSOR_COLORS.length)];

// Typ för cursors
type CursorState = { x: number; y: number; email: string; color: string };

// 🔥 NY: Helper för smartare AI-instruktioner (Heuristik för struktur)
const getSmartCleanupInstructions = (content: string): string => {
  // 1. Normalisera text för analys (ta bort HTML-taggar)
  const text = content.replace(/<[^>]*>/g, " ").trim();
  const lowerText = text.toLowerCase();

  // 2. Intent Detection (Regex för explicita kommandon i slutet)
  // Matchar t.ex: "gör en lista", "sammanfatta detta", "dela upp i kategorier"
  const commandRegex =
    /(?:gör|skapa|omvandla|dela|sammanfatta)\s+.*?(?:lista|punktlista|rubriker|kategorier|sammanfattning|punkter).*$/i;
  const commandMatch = text.match(commandRegex);

  let specificInstruction = "";
  let ignoreCommandInstruction = "";

  if (commandMatch) {
    const command = commandMatch[0];
    // Instruera LLM att ignorera kommandot i outputen
    ignoreCommandInstruction = `
    OBS: Texten slutar med instruktionen: "${command}". 
    Följ denna instruktion för strukturen, men EXKLUDERA själva instruktionstexten från resultatet.
    `;

    if (/lista|punkter|punktlista/i.test(command)) {
      specificInstruction =
        "Formatera innehållet som en tydlig PUNKTLISTA (<ul>).";
    } else if (/rubriker/i.test(command)) {
      specificInstruction =
        "Dela upp innehållet under beskrivande RUBRIKER (<h3>).";
    } else if (/kategorier/i.test(command)) {
      specificInstruction =
        "Gruppera innehållet i 3-5 logiska KATEGORIER med rubriker (<h3>).";
    } else if (/sammanfattning/i.test(command)) {
      specificInstruction =
        "Skriv en kort och kärnfull SAMMANFATTNING av innehållet (<p>).";
    }
  } else {
    // 3. Implicit Heuristics (om inget kommando finns)

    // Uppräkning (många kommatecken eller 'och')
    const commaCount = (text.match(/,/g) || []).length;
    const andCount = (lowerText.match(/\boch\b/g) || []).length;
    const isEnumeration = commaCount > 3 || andCount > 3;

    // Planering / Att-göra
    const isPlanning =
      /\b(att göra|måste|ska|borde|fixa|plan|todo|kom ihåg)\b/i.test(lowerText);

    // Reflektion
    const isReflection =
      /\b(känner|tror|tycker|upplever|insikt|lärdom|tanke)\b/i.test(lowerText);

    if (isEnumeration) {
      specificInstruction =
        "Texten innehåller uppräkningar. Formatera som en PUNKTLISTA (<ul>).";
    } else if (isPlanning) {
      specificInstruction =
        "Texten verkar vara planering. Dela upp i rubriker som 'Att göra', 'Måsten' eller 'Övrigt'.";
    } else if (isReflection) {
      specificInstruction =
        "Texten verkar vara reflektioner. Dela upp i rubriker som 'Tankar', 'Insikter' eller 'Nästa steg'.";
    } else {
      // Default: Blandat / Ostrukturerat
      specificInstruction =
        "Gruppera innehållet i 3-5 logiska KATEGORIER med rubriker (<h3>) för att skapa struktur.";
    }
  }

  return `
    Du är en expert på att strukturera anteckningar.
    Din uppgift: Städa upp texten, rätta stavfel, förbättra grammatik och applicera tydlig struktur.
    
    VIKTIGA REGLER:
    1. Svara ENDAST med valid HTML (inga markdown-block, ingen inledning).
    2. Håll texten kompakt och lättläst (max 6-10 rader om möjligt).
    3. Behåll viktig information, ändra inte betydelsen.
    4. Använd svenska.
    ${ignoreCommandInstruction}

    STRUKTUR:
    ${specificInstruction}
    
    Använd <h3> för rubriker, <ul> för listor och <p> för löpande text.
  `.trim();
};

export default function Canvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const nodeTypes = useMemo(
    () => ({
      note: NoteNode,
      image: ImageNode,
      pomodoro: PomodoroNode,
      link: LinkNode,
      youtube: YouTubeNode,
    }),
    [],
  ); // 🔥 Registrera pomodoro

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
  const [availableBoards, setAvailableBoards] = useState<
    { id: string; title: string; isOwner: boolean; ownerEmail?: string }[]
  >([]); // 🔥 NY: Lista alla boards
  // 🔥 FIX: Använd useRef för timeout för att undvika race conditions vid dubbelklick
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showShareModal, setShowShareModal] = useState(false); // 🔥 State för ShareModal
  const [showUrlModal, setShowUrlModal] = useState(false); // 🔥 State för ImageUrlModal
  const [urlModalMode, setUrlModalMode] = useState<"image" | "link">("image"); // 🔥 NY: Håll koll på vad vi skapar
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false); // 🔥 State för ConfirmModal
  const [userEmail, setUserEmail] = useState(""); // 🔥 State för användarens email
  const [isEditingBoardName, setIsEditingBoardName] = useState(false); // 🔥 State för namnbyte
  const [newBoardName, setNewBoardName] = useState("");
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false); // 🔥 State för uppkoppling
  const isRealtimeConnectedRef = useRef(false); // 🔥 Ref för synkron åtkomst i callbacks

  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  // 🔥 NY: Responsivitet
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768); // 🔥 FIX: Initiera direkt för att slippa "flash" av desktop-UI
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

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

  // State för Cursors
  const [cursors, setCursors] = useState<Record<string, CursorState>>({});
  const presenceChannelRef = useRef<any>(null);
  const broadcastChannelRef = useRef<any>(null); // 🔥 Ref för att skicka broadcasts

  // Ref för dold fil-input
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 🔥 Ref för att spåra muspositionen för paste
  const mousePosRef = useRef({ x: 0, y: 0 });

  // 🔥 Ref för att begränsa antalet resize-anrop över nätverket
  const lastResizeBroadcast = useRef(0);

  // 🔥 Ref för att begränsa antalet text-uppdateringar över nätverket
  const lastTextBroadcast = useRef(0);

  // 🔥 Ref för att begränsa antalet drag-anrop över nätverket
  const lastDragBroadcast = useRef(0);

  // 🔥 NY: Håll koll på vilka noder användaren interagerar med just nu (drag/resize)
  // Detta förhindrar att inkommande DB-uppdateringar skriver över lokala pågående ändringar (jitter/loopar).
  const interactingNodeIds = useRef<Set<string>>(new Set());

  // 🔥 Ref för att hålla koll på om någon nod är vald (för att förhindra att menyn öppnas vid avmarkering)
  const isAnyNodeSelected = useRef(false);

  useEffect(() => {
    isAnyNodeSelected.current = nodes.some((n) => n.selected);
  }, [nodes]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

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

  // 1. Hämta data (noder och edges). Utbruten funktion för att kunna återanvändas vid reconnect.
  const fetchBoardData = useCallback(async () => {
    const fetchNodes = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        return;
      }

      setUserEmail(session.user.email || ""); // 🔥 Spara email för visning

      // 🔥 JOIN LOGIC: Kolla om vi har en invite-token i URL:en
      const params = new URLSearchParams(window.location.search);
      const inviteToken = params.get("token");

      if (inviteToken) {
        console.log("🔍 Hittade invite-token, försöker gå med i board...");

        // 🔥 FIX: Använd RPC för att gå med säkert (kringgår RLS)
        const { data: result, error } = await supabase.rpc("join_board", {
          invite_token: inviteToken,
        });

        if (error) {
          console.error("RPC Error:", error);
          alert("Ett fel uppstod: " + error.message);
        } else if (result && result.error) {
          alert(result.error);
        } else if (result && result.success) {
          alert(
            "✅ Du har gått med i boarden! Du kan nu se och redigera innehållet.",
          );
          // setBoardId(result.board_id); // Vänta med att sätta state tills vi hämtat datan nedan
          localStorage.setItem("brainboard-active-board", result.board_id); // 🔥 Spara direkt vid join
          window.history.replaceState(
            {},
            document.title,
            window.location.pathname,
          );
        }
      }

      // 🔥 NY: Board-logik - Hämta eller skapa board

      // 1. Hämta EGNA boards
      const { data: ownedBoards } = await supabase
        .from("boards")
        .select("id, title, created_at")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: true });

      // 2. Hämta DELADE boards (via RPC för att få email)
      const { data: sharedBoards, error: sharedError } = await supabase.rpc(
        "get_shared_boards_details",
      );

      if (sharedError)
        console.error("Error fetching shared boards:", sharedError);

      // 🔥 FIX: Filtrera bort delade boards som jag faktiskt äger (om jag bjudit in mig själv)
      const ownedIds = new Set(ownedBoards?.map((b) => b.id));
      const uniqueSharedBoards = (sharedBoards || []).filter(
        (s: any) => !ownedIds.has(s.board_id),
      );

      // 3. Slå ihop listorna
      const allBoards: {
        id: string;
        title: string;
        isOwner: boolean;
        ownerEmail?: string;
      }[] = [];

      // 🔥 FIX: Enforce "One Board Per User" - Ta bara den första ägda boarden
      if (ownedBoards && ownedBoards.length > 0) {
        const primaryBoard = ownedBoards[0];
        allBoards.push({
          id: primaryBoard.id,
          title: primaryBoard.title || "Namnlös Board",
          isOwner: true,
        });
      }

      allBoards.push(
        ...uniqueSharedBoards.map((s: any) => ({
          id: s.board_id,
          title: s.title || "Delad Board",
          isOwner: false,
          ownerEmail: s.owner_email, // 🔥 Nu har vi ägarens email!
        })),
      );

      // 🔥 FIX: Om vi precis gick med i en board (via länk), se till att den finns i listan
      // Detta löser problemet om RLS är långsamt eller om listan inte uppdaterats än
      const justJoinedId = localStorage.getItem("brainboard-active-board");
      if (justJoinedId && !allBoards.some((b) => b.id === justJoinedId)) {
        // Om den saknas, tvinga in den temporärt så vi inte redirectas bort
        // (Vi vet inte namnet än, men det laddas vid nästa refresh)
        allBoards.push({
          id: justJoinedId,
          title: "Laddar...",
          isOwner: false,
        });
      }

      // 4. Om inga EGNA boards finns, skapa en General
      if (!allBoards.some((b) => b.isOwner)) {
        const { data: newBoard, error: createError } = await supabase
          .from("boards")
          .insert({ user_id: session.user.id, title: "General" })
          .select()
          .single();

        if (createError) console.error("Kunde inte skapa board:", createError);

        if (newBoard) {
          // Lägg till den nya boarden först i listan
          allBoards.unshift({
            id: newBoard.id,
            title: newBoard.title,
            isOwner: true,
          });
        }
      }

      setAvailableBoards(allBoards);

      // 5. Bestäm vilken board som ska visas (State -> LocalStorage -> Första i listan)
      let activeBoardId =
        boardId || localStorage.getItem("brainboard-active-board");

      // Validera att sparad board faktiskt finns kvar i listan
      if (activeBoardId && !allBoards.some((b) => b.id === activeBoardId)) {
        activeBoardId = null;
      }

      // Fallback till första boarden
      if (!activeBoardId) {
        if (allBoards.length > 0) activeBoardId = allBoards[0].id;
      }

      if (activeBoardId) {
        setBoardId(activeBoardId);
        localStorage.setItem("brainboard-active-board", activeBoardId);
      } else {
        return; // Inga boards att visa
      }

      // Hämta noder (Filtrera på board_id)
      const { data, error } = await supabase
        .from("nodes")
        .select("*")
        .eq("board_id", activeBoardId); // 🔥 Filtrera på board

      if (error) {
        console.error("Error fetching nodes:", error);
        return;
      }

      if (data) {
        const loadedNodes = data.map((n: Note) => ({
          id: n.id,
          type: n.type || "note", // Använd typ från DB
          position: { x: n.position_x, y: n.position_y },
          style: {
            width:
              n.type === "link"
                ? undefined
                : (n.width ??
                  (n.type === "pomodoro"
                    ? 340
                    : n.type === "youtube"
                      ? 640
                      : NODE_WIDTH)), // 🔥 Uppdaterad default bredd
            height:
              n.type === "link"
                ? undefined
                : (n.height ??
                  (n.type === "image"
                    ? undefined
                    : n.type === "pomodoro"
                      ? 460 // 🔥 Uppdaterad default höjd
                      : n.type === "youtube"
                        ? 360
                        : NODE_HEIGHT)),
          },
          data: {
            // Om det är en bild ligger URL:en i content, annars är content texten
            src: n.type === "image" ? n.content : undefined,
            url:
              n.type === "link" || n.type === "youtube" ? n.content : undefined, // 🔥 Mappa URL för länkar och youtube
            title: n.title ?? "",
            label:
              n.type === "image"
                ? "Bild"
                : n.type === "link"
                  ? "Länk"
                  : n.content,
            color: n.color ?? "#f1f1f1",
            isEditing: false,
            tags: (n as any).tags || [],
            summary: (n as any).summary, // 🔥 Hämta summary
            aiTags: (n as any).ai_tags || [], // 🔥 Hämta ai_tags
            // 🔥 Pomodoro data mapping
            status: (n as any).status,
            startTime: (n as any).start_time,
            pausedTime: (n as any).paused_time,
            duration: (n as any).duration,
            plantId: (n as any).plant_id,
            plantDna: (n as any).plant_dna, // 🔥 Ladda DNA från DB
            currentFlower: (n as any).current_flower, // 🔥 FIX: Ladda currentFlower
            stats: (n as any).stats,
            currentTime: (n as any).playback_time, // 🔥 Ladda sparad tid för YouTube
            volume: (n as any).volume, // 🔥 Ladda sparad volym
          },
        }));
        setNodes(loadedNodes);
      }

      // Hämta edges
      const { data: edgeData, error: edgeError } = await supabase
        .from("edges")
        .select("*")
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
  }, [boardId, setNodes, setEdges, setDrawings]);

  // Kör fetch vid mount och när boardId ändras
  useEffect(() => {
    fetchBoardData();
  }, [fetchBoardData]);

  // 🔥 NY: Lyssna på window focus för att uppdatera data när man kommer tillbaka till fliken/appen (Mobil-fix!)
  useEffect(() => {
    const onFocus = () => {
      console.log("📱 App i förgrunden - hämtar senaste data...");
      fetchBoardData();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchBoardData]);

  // 1.5 & 1.6 Realtime Subscription (Synk + Cursors i samma kanal)
  useEffect(() => {
    if (!boardId || !userEmail) return;

    const myColor = getRandomColor();

    // 🔥 FIX: En gemensam kanal för allt (bättre prestanda och synk)
    const channel = supabase.channel(`board:${boardId}`, {
      config: {
        presence: {
          key: userEmail,
        },
        broadcast: { self: false }, // 🔥 Ta inte emot mina egna meddelanden
      },
    });

    presenceChannelRef.current = channel;
    broadcastChannelRef.current = channel; // Spara för att kunna skicka

    channel
      // 1. Presence (Cursors)
      .on("presence", { event: "sync" }, () => {
        const newState = channel.presenceState();
        const newCursors: Record<string, CursorState> = {};

        Object.keys(newState).forEach((key) => {
          if (key !== userEmail) {
            const presence = newState[key][0] as any;
            if (presence && presence.x != null && presence.y != null) {
              newCursors[key] = {
                x: presence.x,
                y: presence.y,
                email: key,
                color: presence.color || "#ff0000",
              };
            }
          }
        });
        setCursors(newCursors);
      })
      // 🔥 1.5 Broadcast (Live updates utan DB-fördröjning)
      .on("broadcast", { event: "node-drag" }, ({ payload }) => {
        setNodes((nds) =>
          nds.map((n) => {
            if (n.id === payload.id) {
              if (interactingNodeIds.current.has(n.id)) return n; // 🔥 Ignorera om vi drar själva
              return { ...n, position: payload.position };
            }
            return n;
          }),
        );
      })
      .on("broadcast", { event: "node-change" }, ({ payload }) => {
        setNodes((nds) =>
          nds.map((n) => {
            if (n.id === payload.id) {
              // Uppdatera data (text, färg, etc)
              return {
                ...n,
                data: {
                  ...n.data,
                  ...payload.data,
                },
                style: {
                  ...n.style,
                  ...payload.style,
                },
              };
            }
            return n;
          }),
        );
      })
      // 🔥 NY: Live Resize
      .on("broadcast", { event: "node-resize" }, ({ payload }) => {
        setNodes((nds) =>
          nds.map((n) => {
            if (n.id === payload.id) {
              if (interactingNodeIds.current.has(n.id)) return n; // 🔥 Ignorera om vi ändrar storlek själva
              return {
                ...n,
                position:
                  payload.x !== undefined && payload.y !== undefined
                    ? { x: payload.x, y: payload.y }
                    : n.position, // 🔥 Uppdatera position vid top/left resize
                style: {
                  ...n.style,
                  width: payload.width,
                  height: payload.height,
                },
              };
            }
            return n;
          }),
        );
      })
      // 🔥 NY: Lås nod vid redigering
      .on("broadcast", { event: "node-lock" }, ({ payload }) => {
        setNodes((nds) =>
          nds.map((n) =>
            n.id === payload.id
              ? {
                  ...n,
                  // 🔥 Uppdatera position om den skickas med (krävs för resize från vänster/topp)
                  position:
                    payload.x !== undefined && payload.y !== undefined
                      ? { x: payload.x, y: payload.y }
                      : n.position,
                  style: {
                    ...n.style,
                    width: payload.width,
                    height: payload.height,
                  },
                }
              : n,
          ),
        );
      })
      // 🔥 NY: Lås upp nod
      .on("broadcast", { event: "node-unlock" }, ({ payload }) => {
        setNodes((nds) =>
          nds.map((n) =>
            n.id === payload.id
              ? { ...n, data: { ...n.data, lockedBy: undefined } }
              : n,
          ),
        );
      })
      // 2. Nodes
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "nodes",
          filter: `board_id=eq.${boardId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newNote = payload.new as Note;
            setNodes((nds) => {
              // Undvik dubbletter
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
                    // 🔥 Pomodoro defaults
                    status: (newNote as any).status,
                    startTime: (newNote as any).start_time,
                    pausedTime: (newNote as any).paused_time,
                    duration: (newNote as any).duration,
                    plantId: (newNote as any).plant_id,
                    plantDna: (newNote as any).plant_dna, // 🔥 Synka DNA live
                    currentFlower: (newNote as any).currentFlower, // 🔥 Synka currentFlower
                    stats: (newNote as any).stats,
                  },
                } as Node,
              ];
            });
          }
          if (payload.eventType === "UPDATE") {
            const newNote = payload.new as Note;
            setNodes((nds) =>
              nds.map((n) => {
                if (n.id === newNote.id) {
                  // 🔥 VIKTIGT: Om VI interagerar med noden just nu (drar/resizar),
                  // ignorera remote-uppdateringar för position/storlek för att undvika "rubber-banding".
                  if (interactingNodeIds.current.has(n.id)) {
                    return n;
                  }

                  return {
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
                        newNote.type === "image" ? newNote.content : undefined,
                      title: newNote.title,
                      label:
                        newNote.type === "image" ? "Bild" : newNote.content,
                      color: newNote.color,
                      summary: (newNote as any).summary, // 🔥 Synka summary
                      aiTags: (newNote as any).ai_tags || [], // 🔥 Synka ai_tags
                      // 🔥 Pomodoro sync
                      status: (newNote as any).status,
                      startTime: (newNote as any).start_time,
                      pausedTime: (newNote as any).paused_time,
                      duration: (newNote as any).duration,
                      plantId: (newNote as any).plant_id,
                      plantDna: (newNote as any).plant_dna, // 🔥 Synka DNA live
                      currentFlower: (newNote as any).currentFlower, // 🔥 Synka currentFlower
                      stats: (newNote as any).stats,
                    },
                  };
                }
                return n;
              }),
            );
          }
          if (payload.eventType === "DELETE") {
            setNodes((nds) => nds.filter((n) => n.id !== payload.old.id));
          }
        },
      )
      // 3. Edges
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "edges",
          filter: `board_id=eq.${boardId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newEdge = payload.new as DbEdge;
            setEdges((eds) => {
              if (eds.some((e) => e.id === newEdge.id)) return eds;
              return [
                ...eds,
                {
                  id: newEdge.id,
                  source: newEdge.source,
                  target: newEdge.target,
                  sourceHandle: newEdge.source_handle,
                  targetHandle: newEdge.target_handle,
                },
              ];
            });
          }
          if (payload.eventType === "DELETE") {
            setEdges((eds) => eds.filter((e) => e.id !== payload.old.id));
          }
          if (payload.eventType === "UPDATE") {
            const updatedEdge = payload.new as DbEdge;
            setEdges((eds) =>
              eds.map((e) =>
                e.id === updatedEdge.id
                  ? {
                      ...e,
                      source: updatedEdge.source,
                      target: updatedEdge.target,
                      sourceHandle: updatedEdge.source_handle,
                      targetHandle: updatedEdge.target_handle,
                    }
                  : e,
              ),
            );
          }
        },
      )
      // 4. Drawings
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "drawings",
          filter: `board_id=eq.${boardId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newDrawing = payload.new as DbDrawing;
            setDrawings((dwgs) => {
              if (dwgs.some((d) => d.id === newDrawing.id)) return dwgs;
              return [
                ...dwgs,
                {
                  id: newDrawing.id,
                  points: newDrawing.points,
                  color: newDrawing.color,
                  width: newDrawing.width,
                  createdAt: new Date(newDrawing.created_at).getTime(),
                },
              ];
            });
          }
          if (payload.eventType === "DELETE") {
            setDrawings((dwgs) => dwgs.filter((d) => d.id !== payload.old.id));
          }
          if (payload.eventType === "UPDATE") {
            const updatedDrawing = payload.new as DbDrawing;
            setDrawings((dwgs) =>
              dwgs.map((d) =>
                d.id === updatedDrawing.id
                  ? {
                      ...d,
                      points: updatedDrawing.points,
                      color: updatedDrawing.color,
                      width: updatedDrawing.width,
                    }
                  : d,
              ),
            );
          }
        },
      )
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          console.log("✅ Realtime connected for board:", boardId);
          setIsRealtimeConnected(true);
          isRealtimeConnectedRef.current = true;
          await channel.track({
            x: null,
            y: null,
            color: myColor,
            email: userEmail,
          });
        }
        if (status === "CHANNEL_ERROR") {
          console.error("❌ Realtime connection failed");
          setIsRealtimeConnected(false);
          isRealtimeConnectedRef.current = false;
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [boardId, userEmail, setNodes, setEdges, setDrawings]);

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
        node.type === "image"
          ? node.data.src
          : node.type === "link" || node.type === "youtube"
            ? node.data.url
            : node.data.label;

      const { error } = await supabase.from("nodes").insert({
        id: node.id,
        user_id: session.user.id,
        board_id: boardId, // 🔥 Koppla till board
        type: node.type, // Spara typen!
        position_x: node.position.x,
        position_y: node.position.y,
        content: contentToSave,
        title: node.data.title ?? "",
        width:
          node.type === "link" ? undefined : (node.style?.width ?? NODE_WIDTH),
        height:
          node.type === "link"
            ? undefined
            : (node.style?.height ??
              (node.type === "image"
                ? undefined
                : node.type === "pomodoro"
                  ? 460 // 🔥 Uppdaterad default höjd vid skapande
                  : node.type === "youtube"
                    ? 360
                    : NODE_HEIGHT)),
        color: node.data.color ?? "#f1f1f1",
        tags: node.data.tags || [],
        // 🔥 Spara Pomodoro-specifik data (kräver att DB-kolumner finns eller att vi använder en JSONB-kolumn 'data')
        // För enkelhetens skull antar vi här att vi kan spara extra fält i en JSONB-kolumn eller liknande.
        // Om du använder Supabase och 'content' är text, kanske du vill serialisera detta där,
        // eller lägga till kolumner i 'nodes'-tabellen: status, start_time, etc.
        // Här visar jag hur man skickar det om kolumnerna finns (mappat till snake_case):
        status: (node.data as any).status,
        start_time: (node.data as any).startTime,
        paused_time: (node.data as any).pausedTime,
        duration: (node.data as any).duration,
        plant_id: (node.data as any).plantId,
        plant_dna: (node.data as any).plantDna, // 🔥 Spara DNA till DB
        current_flower: (node.data as any).currentFlower, // 🔥 FIX: Spara currentFlower
        stats: (node.data as any).stats,
        playback_time: (node.data as any).currentTime, // 🔥 Spara YouTube-tid
        volume: (node.data as any).volume, // 🔥 Spara volym
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
        node.type === "image"
          ? node.data.src
          : node.type === "link" || node.type === "youtube"
            ? node.data.url
            : node.data.label;

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
          // 🔥 Pomodoro update
          status: (node.data as any).status,
          start_time: (node.data as any).startTime,
          paused_time: (node.data as any).pausedTime,
          duration: (node.data as any).duration,
          plant_id: (node.data as any).plantId,
          plant_dna: (node.data as any).plantDna, // 🔥 Uppdatera DNA i DB
          current_flower: (node.data as any).currentFlower, // 🔥 FIX: Uppdatera currentFlower
          stats: (node.data as any).stats,
          playback_time: (node.data as any).currentTime, // 🔥 Uppdatera YouTube-tid
          volume: (node.data as any).volume, // 🔥 Uppdatera volym
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

  // 🔥 Debounce-funktion för att spara till DB (minskar anrop)
  const debouncedSaveNodeRef = useRef<any>(null);
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    debouncedSaveNodeRef.current = (node: Node) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => saveNodeToDb(node), 1000); // Spara till DB efter 1s inaktivitet
    };
  }, [saveNodeToDb]);

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

  // 9. Byt namn på board
  const updateBoardTitle = async () => {
    if (!boardId || !newBoardName.trim()) return;

    const { error } = await supabase
      .from("boards")
      .update({ title: newBoardName })
      .eq("id", boardId);

    if (error) {
      console.error("Error updating board title:", error);
      alert("Kunde inte byta namn (du kanske inte äger boarden?)");
    } else {
      setAvailableBoards((prev) =>
        prev.map((b) => (b.id === boardId ? { ...b, title: newBoardName } : b)),
      );
      setIsEditingBoardName(false);
    }
  };

  // 11. Lämna en delad board
  const handleLeaveBoard = async () => {
    if (!boardId) return;

    // Stäng modalen först
    setShowLeaveConfirm(false);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("board_members")
      .delete()
      .eq("board_id", boardId)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error leaving board:", error);
      alert("Kunde inte lämna boarden.");
    } else {
      // Uppdatera listan och byt till min egen board
      const remaining = availableBoards.filter((b) => b.id !== boardId);
      setAvailableBoards(remaining);
      // Byt till första tillgängliga (vilket borde vara min egen board)
      if (remaining.length > 0) {
        setBoardId(remaining[0].id);
        localStorage.setItem("brainboard-active-board", remaining[0].id);
      } else {
        window.location.reload();
      }
    }
  };

  const handleLogout = async () => {
    spotifyApi.logout(); // 🔥 Rensa Spotify-tokens vid utloggning
    await supabase.auth.signOut();
    window.location.reload();
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
      // 🔥 FIX: Ignorera global undo/redo om vi är i ett textfält (låt Tiptap hantera det)
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

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

  // 🔥 Hantera musrörelser för cursors
  const lastCursorUpdate = useRef(0);
  const handleCursorMove = useCallback(
    (e: React.MouseEvent) => {
      if (!reactFlowInstance || !presenceChannelRef.current || !userEmail)
        return;

      const now = Date.now();
      // 🔥 FIX: Uppdatering var 50ms (20fps) räcker och minskar nätverks-jitter
      if (now - lastCursorUpdate.current > 50) {
        lastCursorUpdate.current = now;

        const position = reactFlowInstance.screenToFlowPosition({
          x: e.clientX,
          y: e.clientY,
        });

        // 🔥 FIX: Skicka alltid cursor-position (ta bort strikt check) för att garantera att de syns
        presenceChannelRef.current.track({
          x: position.x,
          y: position.y,
          email: userEmail,
          color:
            presenceChannelRef.current.presenceState()[userEmail]?.[0]?.color ||
            "#ff0000",
        });
      }
    },
    [reactFlowInstance, userEmail],
  );

  /* =========================
     NODE HANDLERS
  ========================== */

  const updateNodeLabel = useCallback((nodeId: string, value: string) => {
    // 1. Broadcasta direkt till andra (Live!) - Throttlad för prestanda
    const now = Date.now();
    if (
      now - lastTextBroadcast.current > 50 &&
      isRealtimeConnectedRef.current
    ) {
      lastTextBroadcast.current = now;
      broadcastChannelRef.current?.send({
        type: "broadcast",
        event: "node-change",
        payload: { id: nodeId, data: { label: value } },
      });
    }

    // 2. Uppdatera state funktionellt (förhindrar loopar och stale closures)
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          const newNode = { ...node, data: { ...node.data, label: value } };
          // 3. Spara till DB (Debounced)
          debouncedSaveNodeRef.current?.(newNode);
          return newNode;
        }
        return node;
      }),
    );
  }, []); // 🔥 Inga beroenden = stabil funktion

  const updateNodeTitle = useCallback(
    (nodeId: string, title: string) => {
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
    },
    [saveNodeToDb],
  );

  const startEditing = useCallback(
    (nodeId: string) => {
      // 🔥 Broadcasta att vi låser noden
      if (isRealtimeConnectedRef.current) {
        broadcastChannelRef.current?.send({
          type: "broadcast",
          event: "node-lock",
          payload: { id: nodeId, user: userEmail },
        });
      }

      setNodes((nds) =>
        nds.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: { ...node.data, isEditing: true, lockedBy: userEmail }, // Sätt lås lokalt också
              }
            : node,
        ),
      );
    },
    [userEmail],
  );

  const stopEditing = useCallback((nodeId: string) => {
    // 🔥 Broadcasta att vi låser upp noden
    if (isRealtimeConnectedRef.current) {
      broadcastChannelRef.current?.send({
        type: "broadcast",
        event: "node-unlock",
        payload: { id: nodeId },
      });
    }

    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              data: { ...node.data, isEditing: false, lockedBy: undefined }, // Ta bort lås lokalt
            }
          : node,
      ),
    );
  }, []);

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

  // 🔥 NY: Markera att vi börjar ändra storlek
  const onResizeStart = useCallback((nodeId: string) => {
    interactingNodeIds.current.add(nodeId);
  }, []);

  const onResize = useCallback(
    (nodeId: string, width: number, height: number, x?: number, y?: number) => {
      // 🔥 Broadcasta resize live (throttlad till var 30ms för prestanda)
      const now = Date.now();
      if (
        now - lastResizeBroadcast.current > 30 &&
        isRealtimeConnectedRef.current
      ) {
        lastResizeBroadcast.current = now;
        broadcastChannelRef.current?.send({
          type: "broadcast",
          event: "node-resize",
          payload: { id: nodeId, width, height, x, y }, // 🔥 Skicka med x/y
        });
      }

      setNodes((nds) => {
        const node = nds.find((n) => n.id === nodeId);
        if (node) {
          const updatedNode = {
            ...node,
            position:
              x !== undefined && y !== undefined ? { x, y } : node.position, // 🔥 Uppdatera lokalt
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
    (nodeId: string, width: number, height: number, x?: number, y?: number) => {
      // 🔥 Ta bort låsningen
      interactingNodeIds.current.delete(nodeId);

      // 🔥 OPTIMERING: Använd instansen istället för 'nodes' state för att slippa omrenderingar
      const node = reactFlowInstance?.getNode(nodeId);
      if (node) {
        const updatedNode = {
          ...node,
          position:
            x !== undefined && y !== undefined ? { x, y } : node.position, // 🔥 Spara ny position till DB
          style: { ...node.style, width, height },
        };
        console.log("Resize End: Sparar till DB...", width, height);
        saveNodeToDb(updatedNode);
      }
    },
    [reactFlowInstance, saveNodeToDb],
  );

  // 🔥 NY: Hantera start av drag
  const onNodeDragStart = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      interactingNodeIds.current.add(node.id);
    },
    [],
  );

  // 🔥 Live Dragging
  const onNodeDrag = useCallback((_event: React.MouseEvent, node: Node) => {
    // Skicka position till andra direkt
    const now = Date.now();
    if (
      now - lastDragBroadcast.current > 30 &&
      isRealtimeConnectedRef.current
    ) {
      lastDragBroadcast.current = now;
      broadcastChannelRef.current?.send({
        type: "broadcast",
        event: "node-drag",
        payload: { id: node.id, position: node.position },
      });
    }
  }, []);

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

  // 🔥 NY: Generisk data-uppdaterare för PomodoroNode
  const onNodeDataChange = useCallback(
    (nodeId: string, newData: any) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            const updatedNode = { ...node, data: { ...node.data, ...newData } };
            // Spara direkt till DB (eller via debounce om det är frekvent)
            // För timer-status vill vi ofta spara direkt.
            saveNodeToDb(updatedNode);
            return updatedNode;
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
              // 🔥 NY: Skicka med instruktioner för smartare städning (stavfel, listor)
              instructions:
                action === "organize"
                  ? getSmartCleanupInstructions(
                      (node.data.label as string) || "",
                    ) // 🔥 Använd smartare instruktioner
                  : undefined,
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
        onResizeStart: onResizeStart, // 🔥 Koppla in nya handlern
        onResizeEnd: onResizeEnd, // Skicka med den nya funktionen
        onColorChange: onColorChange,
        onMagic: onMagic,
        onTagsChange: updateNodeTags,
        onAiTagsChange: updateNodeAiTags,
        onSummaryChange: updateNodeSummary,
        onDataChange: onNodeDataChange, // 🔥 Skicka med generisk handler
      },
    }),
    [
      updateNodeTitle,
      updateNodeLabel,
      startEditing,
      stopEditing,
      deleteNodeManual,
      onResize,
      onResizeStart,
      onResizeEnd,
      onColorChange,
      onMagic,
      updateNodeTags,
      updateNodeAiTags,
      onNodeDataChange,
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
          currentUserEmail: userEmail, // 🔥 Skicka med inloggad email till noden
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

      // 🔥 FIX: Om någon nod är vald, tolka klicket som avmarkering och öppna INTE menyn
      if (isAnyNodeSelected.current) {
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
      interactingNodeIds.current.delete(node.id); // 🔥 Släpp låsningen
      saveNodeToDb(node);
    },
    [saveNodeToDb],
  );

  /* =========================
     IMAGE HANDLING
  ========================== */

  // 🔥 Hjälpfunktion för att skapa bildnod
  const createImageNode = useCallback(
    (url: string, x: number, y: number) => {
      if (!reactFlowInstance) return;

      const flowPosition = reactFlowInstance.screenToFlowPosition({ x, y });
      const centeredPosition = {
        x: flowPosition.x - 100,
        y: flowPosition.y - 100,
      };

      const newImageNode: Node = {
        id: crypto.randomUUID(),
        type: "image",
        position: centeredPosition,
        data: { src: url, label: "Bild" },
        style: { width: 300 },
      };

      createNodeInDb(newImageNode);
      setNodes((nds) => {
        const updatedNodes = [...nds, newImageNode];
        saveSnapshot(updatedNodes, edges);
        return updatedNodes;
      });
    },
    [reactFlowInstance, createNodeInDb, setNodes, edges, saveSnapshot],
  );

  // 🔥 NY: Hjälpfunktion för att skapa länknod
  const createLinkNode = useCallback(
    (url: string, x: number, y: number) => {
      if (!reactFlowInstance) return;

      const flowPosition = reactFlowInstance.screenToFlowPosition({ x, y });
      const centeredPosition = {
        x: flowPosition.x - 100,
        y: flowPosition.y - 25,
      };

      const newLinkNode: Node = {
        id: crypto.randomUUID(),
        type: "link",
        position: centeredPosition,
        data: { url: url, title: url }, // Titel är URL som default
      };

      createNodeInDb(newLinkNode);
      setNodes((nds) => [...nds, newLinkNode]);
      saveSnapshot([...nodes, newLinkNode], edges);
    },
    [reactFlowInstance, createNodeInDb, setNodes, edges, saveSnapshot, nodes],
  );

  // 🔥 Hjälpfunktion för att ladda upp och skapa bildnod
  const processImageFile = useCallback(
    async (file: File, x: number, y: number) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        alert("Du måste vara inloggad för att ladda upp bilder");
        return;
      }

      const fileExt = file.name.split(".").pop() || "png";
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${session.user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("images")
        .upload(filePath, file);

      if (uploadError) {
        console.error("Error uploading image:", uploadError);
        alert("Kunde inte ladda upp bild.");
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("images").getPublicUrl(filePath);

      createImageNode(publicUrl, x, y);
    },
    [createImageNode],
  );

  // 🔥 Hantera Paste (Ctrl+V)
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      // Ignorera om vi skriver i ett input-fält
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      // 1. Hantera bildfiler (Blob) från urklipp
      if (e.clipboardData) {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf("image") !== -1) {
            const file = items[i].getAsFile();
            if (file) {
              e.preventDefault();
              await processImageFile(
                file,
                mousePosRef.current.x,
                mousePosRef.current.y,
              );
              return; // Avsluta om vi hittade en bildfil
            }
          }
        }

        // 2. Hantera bild-URL (Text) från urklipp
        const text = e.clipboardData.getData("text");
        if (
          text &&
          text.match(/^https?:\/\/.*\.(jpeg|jpg|gif|png|webp|svg)(\?.*)?$/i)
        ) {
          e.preventDefault();
          createImageNode(text, mousePosRef.current.x, mousePosRef.current.y);
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [processImageFile, createImageNode]);

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await processImageFile(file, menuState.x, menuState.y);

    // Återställ input så man kan välja samma fil igen om man vill
    event.target.value = "";
  };

  const handleMenuSelect = (optionId: string) => {
    console.log("Canvas: handleMenuSelect anropad med:", optionId);
    // Stäng menyn direkt
    setMenuState((prev) => ({ ...prev, isOpen: false }));

    if (optionId === "draw") {
      setIsDrawingMode(true);
      return;
    }

    if (optionId === "image-upload") {
      // Trigga den dolda fil-inputen
      fileInputRef.current?.click();
      return;
    }

    // 🔥 FIX: Hantera "link" explicit
    if (optionId === "link") {
      console.log("🔗 Canvas: Öppnar länk-modal");
      setShowUrlModal(true);
      setUrlModalMode("link"); // 🔥 Sätt mode till länk
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

    if (optionId === "pomodoro") {
      if (!reactFlowInstance) return;
      const flowPosition = reactFlowInstance.screenToFlowPosition({
        x: menuState.x,
        y: menuState.y,
      });
      const centeredPosition = {
        x: flowPosition.x - 150, // Halva bredden av PomodoroNode
        y: flowPosition.y - 100,
      };

      // 🔥 Hämta en slumpmässig blomma från DB direkt
      const fetchRandomFlower = async () => {
        const { data: flowers } = await supabase
          .from("flower_definitions")
          .select("*");

        let selectedFlower = null;

        if (flowers && flowers.length > 0) {
          // Weighted random selection
          const totalWeight = flowers.reduce(
            (sum, f) => sum + f.drop_weight,
            0,
          );
          let random = Math.random() * totalWeight;

          for (const flower of flowers) {
            random -= flower.drop_weight;
            if (random <= 0) {
              selectedFlower = flower;
              break;
            }
          }
        }

        const newNode: Node = {
          id: crypto.randomUUID(),
          type: "pomodoro",
          position: centeredPosition,
          data: {
            plantId: "stitchFlower",
            status: "idle",
            stats: { completed: 0, streak: 0, totalMinutes: 0 },
            duration: 25 * 60 * 1000,
            plantDna: selectedFlower?.dna, // Visuellt DNA
            currentFlower: selectedFlower
              ? {
                  // 🔥 Spara info om blomman
                  id: selectedFlower.id,
                  name: selectedFlower.name,
                  rarity: selectedFlower.rarity,
                  description: selectedFlower.description,
                }
              : undefined,
          },
          style: { width: 340, height: 460 }, // 🔥 Uppdaterad storlek för nya noder
        };
        createNodeInDb(newNode);
        setNodes((nds) => [...nds, newNode]);
      };

      fetchRandomFlower();
    }

    if (optionId === "youtube") {
      if (!reactFlowInstance) return;
      const flowPosition = reactFlowInstance.screenToFlowPosition({
        x: menuState.x,
        y: menuState.y,
      });
      const centeredPosition = {
        x: flowPosition.x - 320, // Halva bredden (640/2)
        y: flowPosition.y - 180, // Halva höjden (360/2)
      };

      const newNode: Node = {
        id: crypto.randomUUID(),
        type: "youtube",
        position: centeredPosition,
        data: { url: "", videoId: null, volume: 50, currentTime: 0 },
        style: { width: 640, height: 360 },
      };

      createNodeInDb(newNode);
      setNodes((nds) => [...nds, newNode]);
      saveSnapshot([...nodes, newNode], edges);
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
        cursor: isDrawingMode ? "crosshair" : "default",
        fontFamily: '"Inter", "Roboto", sans-serif',
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
        proOptions={{ hideAttribution: true }}
        // 🔥 RENSA ALLA LÅSNINGAR - Låt React Flow vara React Flow
        panOnDrag={true}
        zoomOnScroll={true}
        zoomOnPinch={true}
        zoomOnDoubleClick={false}
        panOnScroll={false} // VIKTIGT: False så att scroll zoomar istället för panorerar
        selectionOnDrag={false} // 🔥 FIX: Gör att man kan panorera med ett finger på mobil utan att markera
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgeClick={onEdgeClick}
        onNodesDelete={onNodesDelete} // 🔥 Koppla in Backspace-hantering
        onNodeClick={onNodeClick} // 🔥 FIX: Koppla in klick-hantering för noder
        onPaneClick={onPaneClick}
        onNodeDragStop={onNodeDragStop}
        onNodeDragStart={onNodeDragStart} // 🔥 FIX: Koppla in start-hantering
        onNodeDrag={onNodeDrag} // 🔥 FIX: Live dragging
        onInit={(instance) => {
          setReactFlowInstance(
            instance as unknown as ReactFlowInstance<Node, Edge>,
          );
        }}
        onMouseMove={handleCursorMove} // 🔥 Spåra musrörelser
        onMouseLeave={() => {
          // Valfritt: Dölj cursor när man lämnar canvas
          presenceChannelRef.current?.track({
            x: null,
            y: null,
            email: userEmail,
          });
        }}
      >
        <MiniMap
          nodeColor={(n) => (n.data?.color as string) || "#f1f1f1"}
          maskColor="rgba(0, 0, 0, 0.6)" // Mörkare mask för dark mode
          style={
            isMobile
              ? {
                  width: 100,
                  height: 80,
                  bottom: 10,
                  right: 10,
                  opacity: 0.9,
                  backgroundColor: "#1e1e24",
                  border: "1px solid #333",
                }
              : { backgroundColor: "#1e1e24", border: "1px solid #333" }
          }
          onClick={(_, position) => {
            reactFlowInstance?.setCenter(position.x, position.y, {
              zoom: 1,
              duration: 500,
            });
          }}
        />

        {/* 🔥 Cursor Layer - Visar andra användare */}
        <CursorLayer cursors={cursors} />

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
        {!isMobile && (
          <Controls
            style={{ zIndex: 2000, bottom: 15 }}
            showInteractive={true}
          />
        )}
        <Background gap={20} size={1} color="#333" />

        {/* 🔥 DESKTOP: Board Switcher (Top Left) */}
        {!isMobile && (
          <div
            style={{
              position: "absolute",
              top: 10,
              left: 10,
              zIndex: 1000,
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            {isEditingBoardName ? (
              <div style={{ display: "flex", gap: 4 }}>
                <input
                  value={newBoardName}
                  onChange={(e) => setNewBoardName(e.target.value)}
                  style={{
                    background: "#222",
                    color: "white",
                    border: "1px solid #6366f1",
                    padding: "8px",
                    borderRadius: "8px",
                    outline: "none",
                    fontSize: "14px",
                    width: "140px",
                  }}
                  autoFocus
                />
                <button
                  onClick={updateBoardTitle}
                  style={{
                    background: "#10b981",
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer",
                    color: "white",
                    padding: "0 6px",
                  }}
                >
                  <Check size={16} />
                </button>
                <button
                  onClick={() => setIsEditingBoardName(false)}
                  style={{
                    background: "#ef4444",
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer",
                    color: "white",
                    padding: "0 6px",
                  }}
                >
                  <XIcon size={16} />
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <select
                  value={boardId || ""}
                  onChange={(e) => {
                    const newId = e.target.value;
                    setBoardId(newId);
                    localStorage.setItem("brainboard-active-board", newId); // Spara val
                  }}
                  style={{
                    background: "#222",
                    color: "white",
                    border: "1px solid #444",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    outline: "none",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: "14px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                    minWidth: "160px",
                  }}
                >
                  {/* Grupp 1: Min Board (Utan rubrik/optgroup nu) */}
                  {availableBoards
                    .filter((b) => b.isOwner)
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.title}
                      </option>
                    ))}

                  {/* Grupp 2: Delade Boards */}
                  <optgroup label="Delade med mig">
                    {availableBoards.filter((b) => !b.isOwner).length === 0 ? (
                      <option disabled>Inga delade boards</option>
                    ) : (
                      availableBoards
                        .filter((b) => !b.isOwner)
                        .map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.title}{" "}
                            {b.ownerEmail ? `(av ${b.ownerEmail})` : ""}
                          </option>
                        ))
                    )}
                  </optgroup>
                </select>

                {/* Visa bara redigera-knapp om man äger boarden */}
                {availableBoards.find((b) => b.id === boardId)?.isOwner && (
                  <button
                    onClick={() => {
                      const currentBoard = availableBoards.find(
                        (b) => b.id === boardId,
                      );
                      setNewBoardName(currentBoard?.title || "");
                      setIsEditingBoardName(true);
                    }}
                    style={{
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      color: "#666",
                      padding: 4,
                    }}
                    title="Byt namn"
                  >
                    <Pencil size={14} />
                  </button>
                )}

                {/* Visa Lämna-knapp om man INTE äger boarden */}
                {availableBoards.find((b) => b.id === boardId) &&
                  !availableBoards.find((b) => b.id === boardId)?.isOwner && (
                    <button
                      onClick={() => setShowLeaveConfirm(true)}
                      style={{
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        color: "#ef4444", // Röd färg för att indikera "fara"/lämna
                        padding: 4,
                      }}
                      title="Lämna board"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
              </div>
            )}
          </div>
        )}

        {/* 🔥 DESKTOP: Sök-input */}
        {!isMobile && (
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
        )}

        {/* 🔥 DESKTOP: Top Right Buttons */}
        {!isMobile && (
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

            <button
              onClick={undo}
              disabled={historyIndex === 0}
              style={{
                background: "#222",
                border: "1px solid #444",
                borderRadius: "8px",
                padding: "8px",
                color: historyIndex > 0 ? "white" : "#555",
                cursor: historyIndex > 0 ? "pointer" : "default",
                display: "flex",
                alignItems: "center",
                opacity: historyIndex > 0 ? 1 : 0.5,
              }}
              title="Ångra"
            >
              <RotateCcw size={16} />
            </button>
            <button
              onClick={redo}
              disabled={historyIndex >= history.length - 1}
              style={{
                background: "#222",
                border: "1px solid #444",
                borderRadius: "8px",
                padding: "8px",
                color: historyIndex < history.length - 1 ? "white" : "#555",
                cursor:
                  historyIndex < history.length - 1 ? "pointer" : "default",
                display: "flex",
                alignItems: "center",
                opacity: historyIndex < history.length - 1 ? 1 : 0.5,
              }}
              title="Gör om"
            >
              <RotateCw size={16} />
            </button>

            <button
              onClick={handleLogout}
              style={{
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.2)",
                borderRadius: "8px",
                padding: "8px",
                color: "#ef4444",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
              }}
              title="Logga ut"
            >
              <LogOut size={16} />
            </button>
          </div>
        )}

        {/* Indikator för Draw Mode */}
        {isDrawingMode && (
          <DrawModeControls
            onExit={() => {
              setIsDrawingMode(false);
              setSelectedDrawingId(null);
              setIsDrawing(false);
            }}
            style={{ top: 60 }}
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

      {/* 🔥 Spotify Player */}
      <SpotifyPlayer />

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

      {/* 🔥 Confirm Modal (Lämna board) */}
      <ConfirmModal
        isOpen={showLeaveConfirm}
        onClose={() => setShowLeaveConfirm(false)}
        onConfirm={handleLeaveBoard}
        title="Lämna board?"
        message={`Är du säker på att du vill lämna "${availableBoards.find((b) => b.id === boardId)?.title}"? Du kommer inte längre ha åtkomst till den.`}
        confirmText="Lämna"
        isDanger={true}
      />

      {/* 🔥 Image URL Modal */}
      {showUrlModal && (
        <ImageUrlModal
          title={
            urlModalMode === "link" ? "Lägg till länk" : "Infoga bild från URL"
          }
          placeholder={
            urlModalMode === "link"
              ? "https://..."
              : "https://exempel.se/bild.png"
          }
          onConfirm={(url) => {
            if (urlModalMode === "link") {
              createLinkNode(url, menuState.x, menuState.y);
            } else {
              createImageNode(url, menuState.x, menuState.y);
            }
          }}
          onClose={() => setShowUrlModal(false)}
        />
      )}

      {/* 🔥 DESKTOP: "Inloggad som" indikator */}
      {!isMobile && (
        <div
          style={{
            position: "absolute",
            bottom: 10,
            left: 80,
            color: "rgba(255, 255, 255, 0.3)",
            fontSize: "12px",
            pointerEvents: "none",
            userSelect: "none",
            zIndex: 1000,
          }}
        >
          Du är inloggad som: {userEmail}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              marginLeft: 8,
              gap: 4,
              opacity: 0.7,
            }}
          >
            {isRealtimeConnected ? (
              <>
                <Wifi size={12} color="#10b981" />{" "}
                <span style={{ color: "#10b981" }}>Live</span>
              </>
            ) : (
              <>
                <WifiOff size={12} color="#ef4444" />{" "}
                <span style={{ color: "#ef4444" }}>Offline</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* 🔥 MOBILE UI OVERLAY */}
      {isMobile && (
        <>
          {/* 1. Mobile Top Bar */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 50,
              background: "#1e1e24",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 16px",
              zIndex: 2000,
              borderBottom: "1px solid #333",
              boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
            }}
          >
            <button
              onClick={() => setShowMobileMenu(true)}
              style={{
                background: "none",
                border: "none",
                color: "white",
                padding: 4,
              }}
            >
              <Menu size={24} />
            </button>

            {showMobileSearch ? (
              <input
                autoFocus
                placeholder="Sök..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  flex: 1,
                  margin: "0 16px",
                  background: "#333",
                  border: "none",
                  color: "white",
                  padding: "6px 12px",
                  borderRadius: 6,
                  fontSize: 16,
                  outline: "none",
                }}
              />
            ) : (
              <span
                style={{
                  fontWeight: 600,
                  color: "white",
                  fontSize: 16,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: "60%",
                }}
              >
                {availableBoards.find((b) => b.id === boardId)?.title ||
                  "BrainBoard"}
              </span>
            )}

            <button
              onClick={() => setShowMobileSearch(!showMobileSearch)}
              style={{
                background: "none",
                border: "none",
                color: "white",
                padding: 4,
              }}
            >
              {showMobileSearch ? <XIcon size={24} /> : <Search size={24} />}
            </button>
          </div>

          {/* 2. Mobile Menu Drawer */}
          {showMobileMenu && (
            <>
              <div
                onClick={() => setShowMobileMenu(false)}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  background: "rgba(0,0,0,0.5)",
                  zIndex: 2999,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "85%",
                  maxWidth: "300px",
                  height: "100%",
                  background: "#1e1e24",
                  zIndex: 3000,
                  padding: 20,
                  boxShadow: "2px 0 20px rgba(0,0,0,0.5)",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 30,
                  }}
                >
                  <h2
                    style={{
                      margin: 0,
                      fontSize: 20,
                      color: "white",
                      fontWeight: 700,
                    }}
                  >
                    Meny
                  </h2>
                  <button
                    onClick={() => setShowMobileMenu(false)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#888",
                    }}
                  >
                    <XIcon size={24} />
                  </button>
                </div>

                {/* User Info */}
                <div
                  style={{
                    marginBottom: 24,
                    paddingBottom: 20,
                    borderBottom: "1px solid #333",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      background: "#333",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <User size={20} color="#ccc" />
                  </div>
                  <div style={{ overflow: "hidden" }}>
                    <div style={{ fontSize: 12, color: "#888" }}>
                      Inloggad som
                    </div>
                    <div
                      style={{
                        color: "white",
                        fontWeight: 500,
                        fontSize: 14,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {userEmail}
                    </div>
                  </div>
                </div>

                {/* Board Switcher */}
                <div style={{ marginBottom: 24 }}>
                  <label
                    style={{
                      fontSize: 12,
                      color: "#888",
                      display: "block",
                      marginBottom: 8,
                      fontWeight: 600,
                    }}
                  >
                    DINA BOARDS
                  </label>
                  <select
                    value={boardId || ""}
                    onChange={(e) => {
                      setBoardId(e.target.value);
                      localStorage.setItem(
                        "brainboard-active-board",
                        e.target.value,
                      );
                      setShowMobileMenu(false);
                    }}
                    style={{
                      width: "100%",
                      padding: 12,
                      background: "#2a2a30",
                      color: "white",
                      border: "1px solid #444",
                      borderRadius: 8,
                      fontSize: 16,
                      outline: "none",
                    }}
                  >
                    {availableBoards.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.title} {b.isOwner ? "" : "(Delad)"}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Actions */}
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 12 }}
                >
                  <button
                    onClick={() => {
                      setShowShareModal(true);
                      setShowMobileMenu(false);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: 12,
                      background: "#333",
                      border: "none",
                      borderRadius: 8,
                      color: "white",
                      fontSize: 16,
                    }}
                  >
                    <Share2 size={18} /> Dela Board
                  </button>
                  <button
                    onClick={handleLogout}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: 12,
                      background: "rgba(239, 68, 68, 0.1)",
                      border: "1px solid rgba(239, 68, 68, 0.2)",
                      borderRadius: 8,
                      color: "#ef4444",
                      fontSize: 16,
                      marginTop: "auto",
                    }}
                  >
                    <LogOut size={18} /> Logga ut
                  </button>
                </div>
              </div>
            </>
          )}

          {/* 3. Mobile FABs (Undo/Redo) */}
          <div
            style={{
              position: "absolute",
              bottom: 110, // Flyttad upp för att inte krocka med MiniMap
              right: 20,
              display: "flex",
              flexDirection: "column",
              gap: 12,
              zIndex: 2000,
            }}
          >
            <button
              onClick={undo}
              disabled={historyIndex === 0}
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: "#222",
                color: historyIndex > 0 ? "white" : "#555",
                border: "1px solid #444",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow:
                  historyIndex > 0 ? "0 4px 12px rgba(0,0,0,0.4)" : "none",
                opacity: historyIndex > 0 ? 1 : 0.5,
              }}
            >
              <RotateCcw size={20} />
            </button>
            <button
              onClick={redo}
              disabled={historyIndex >= history.length - 1}
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: "#222",
                color: historyIndex < history.length - 1 ? "white" : "#555",
                border: "1px solid #444",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow:
                  historyIndex < history.length - 1
                    ? "0 4px 12px rgba(0,0,0,0.4)"
                    : "none",
                opacity: historyIndex < history.length - 1 ? 1 : 0.5,
              }}
            >
              <RotateCw size={20} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
