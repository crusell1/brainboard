import { useState, useEffect, useRef } from "react";
import { NodeResizer, type NodeProps, type Node } from "@xyflow/react";
import { RotateCcw, Youtube, X, GripHorizontal } from "lucide-react";

// Typer för globala YouTube-objekt
declare global {
  interface Window {
    onYouTubeIframeAPIReady: () => void;
    YT: any;
  }
}

export type YouTubeNodeData = {
  url?: string;
  videoId?: string;
  volume?: number; // 0-100
  currentTime?: number;
  onUrlChange?: (id: string, url: string) => void;
  onDataChange?: (id: string, data: Partial<YouTubeNodeData>) => void;
  onDelete?: (id: string) => void;
  onResize?: (
    id: string,
    width: number,
    height: number,
    x?: number,
    y?: number,
  ) => void;
  onResizeStart?: (id: string) => void;
  onResizeEnd?: (
    id: string,
    width: number,
    height: number,
    x?: number,
    y?: number,
  ) => void;
};

// Define the Node type for better type safety with NodeProps
export type YouTubeNodeType = Node<YouTubeNodeData, "youtube">;

// Helper: Extrahera ID från olika länktyper
const getYouTubeId = (url: string): string | null => {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
};

export default function YouTubeNode({
  id,
  data,
  selected,
}: NodeProps<YouTubeNodeType>) {
  const [videoId, setVideoId] = useState<string | null>(
    data.videoId || getYouTubeId(data.url || ""),
  );
  const [inputValue, setInputValue] = useState(data.url || "");
  const [isEditing, setIsEditing] = useState(!videoId);
  const [isDragging, setIsDragging] = useState(false);
  const [isApiReady, setIsApiReady] = useState(false);

  // Player State
  const [player, setPlayer] = useState<any>(null);
  const [volume] = useState(data.volume ?? 50);
  const [isHovering, setIsHovering] = useState(false);

  const playerRef = useRef<HTMLDivElement>(null);
  // Använd ReturnType<typeof setInterval> för att undvika NodeJS.Timeout-konflikter
  const saveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dataRef = useRef(data);
  const playerInstanceRef = useRef<any>(null);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // Spara tiden och volym till DB
  const saveProgress = (p?: any) => {
    const instance = p || playerInstanceRef.current;
    if (instance) {
      const updates: Partial<YouTubeNodeData> = {};

      if (typeof instance.getCurrentTime === "function") {
        const time = instance.getCurrentTime();
        if (time > 0) updates.currentTime = time;
      }
      if (typeof instance.getVolume === "function") {
        updates.volume = instance.getVolume();
      }

      if (Object.keys(updates).length > 0) {
        dataRef.current.onDataChange?.(id, updates);
      }
    }
  };

  // Lyssna på global mouseup för att avsluta drag-läge
  useEffect(() => {
    const handleMouseUp = () => setIsDragging(false);
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, []);

  // Städa upp spara-intervall vid unmount
  useEffect(() => {
    return () => {
      if (saveIntervalRef.current) clearInterval(saveIntervalRef.current);
      // 🔥 Spara en sista gång vid unmount
      if (playerInstanceRef.current) saveProgress(playerInstanceRef.current);
    };
  }, []);

  // 1. Ladda YouTube API Script
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      setIsApiReady(true);
    } else {
      if (
        !document.querySelector(
          'script[src="https://www.youtube.com/iframe_api"]',
        )
      ) {
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName("script")[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      }

      const interval = setInterval(() => {
        if (window.YT && window.YT.Player) {
          setIsApiReady(true);
          clearInterval(interval);
        }
      }, 100);

      return () => clearInterval(interval);
    }
  }, []);

  // 🔥 NY: Synka state med data från parent (DB)
  useEffect(() => {
    const newId = getYouTubeId(data.url || "");
    if (newId !== videoId) {
      setVideoId(newId);
      if (newId) setIsEditing(false);
    }
    setInputValue(data.url || "");
  }, [data.url]);

  // 2. Initiera Spelare när videoId finns
  useEffect(() => {
    if (!videoId || !isApiReady || !playerRef.current) return;

    // Om spelare redan finns, ladda bara ny video
    if (player) {
      if (typeof player.loadVideoById === "function") {
        player.loadVideoById({
          videoId,
          startSeconds: 0, // Nollställ tid om vi byter video manuellt
        });
      }
      return;
    }

    // Skapa spelaren
    new window.YT.Player(playerRef.current, {
      height: "100%",
      width: "100%",
      videoId: videoId,
      playerVars: {
        autoplay: 0,
        controls: 1, // Visa standardkontroller
        start: Math.floor(data.currentTime || 0), // Starta där vi slutade
        disablekb: 1,
        enablejsapi: 1,
        modestbranding: 1,
        rel: 0,
        fs: 1, // Tillåt fullscreen
      },
      events: {
        onReady: (event: any) => {
          event.target.setVolume(volume);
          setPlayer(event.target);
          playerInstanceRef.current = event.target;
        },
        onStateChange: (event: any) => {
          const state = event.data;
          const p = event.target;
          // 1 = Playing
          if (state === 1) {
            // Starta intervall för att spara tid var 5:e sekund
            if (saveIntervalRef.current) clearInterval(saveIntervalRef.current);
            saveIntervalRef.current = setInterval(() => saveProgress(p), 5000);
          } else {
            if (saveIntervalRef.current) clearInterval(saveIntervalRef.current);
            if (state === 2 || state === 0) saveProgress(p); // Spara direkt vid Paus (2) eller Slut (0)
          }
        },
      },
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, isApiReady]); // Körs när ID ändras eller API blir redo

  // Handlers
  const handleUrlSubmit = () => {
    const extractedId = getYouTubeId(inputValue);
    if (extractedId) {
      setVideoId(extractedId);
      setIsEditing(false);

      // Spara till data via onDataChange (föredraget) eller onUrlChange
      if (data.onDataChange) {
        data.onDataChange(id, {
          url: inputValue,
          videoId: extractedId,
          currentTime: 0, // Nollställ sparad tid för ny video
        });
      } else if (data.onUrlChange) {
        data.onUrlChange(id, inputValue);
      }
    } else {
      alert("Kunde inte hitta ett giltigt YouTube-ID i länken.");
    }
  };

  const resetNode = () => {
    if (player && typeof player.stopVideo === "function") {
      player.stopVideo();
    }
    setVideoId(null);
    setInputValue("");
    setIsEditing(true);
  };

  return (
    <div
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minWidth: "320px",
        minHeight: "240px",
      }}
    >
      <NodeResizer
        minWidth={320}
        minHeight={240}
        isVisible={selected}
        lineStyle={{ border: "1px solid #ff0000" }}
        handleStyle={{
          width: 12,
          height: 12,
          borderRadius: "50%",
          background: "#ff0000",
        }}
        onResizeStart={() => {
          data.onResizeStart?.(id);
        }}
        onResize={(_e, params) => {
          data.onResize?.(id, params.width, params.height, params.x, params.y);
        }}
        onResizeEnd={(_e, params) => {
          data.onResizeEnd?.(
            id,
            params.width,
            params.height,
            params.x,
            params.y,
          );
        }}
      />

      {/* Inner Container (Visuals & Content) */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          borderRadius: 16,
          overflow: "hidden", // Klipp innehållet här inne istället
          background: "#1e1e24", // 🔥 Matchar BaseNode så den syns bättre om video saknas
          border: selected ? "4px solid #ff0000" : "4px solid transparent",
          boxShadow: selected
            ? "0 0 25px rgba(255, 0, 0, 0.3)"
            : "0 4px 6px -1px rgba(0, 0, 0, 0.2)",
          transition:
            "box-shadow 0.2s cubic-bezier(0.25, 0.8, 0.25, 1), border-color 0.2s cubic-bezier(0.25, 0.8, 0.25, 1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 0,
          boxSizing: "border-box",
        }}
      >
        {/* 1. Player Container */}
        <div
          style={{
            width: "100%",
            height: "100%",
            pointerEvents: isDragging ? "none" : "auto", // Stäng av interaktion vid drag
            opacity: videoId && !isEditing ? 1 : 0,
            position: "absolute",
            top: 0,
            left: 0,
            zIndex: 0,
          }}
        >
          <div ref={playerRef} style={{ width: "100%", height: "100%" }} />
        </div>

        {/* 2. Edit Mode Overlay */}
        {(!videoId || isEditing) && (
          <div
            className="nodrag"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "20px",
              gap: "12px",
              background: "#1e1e24",
              zIndex: 10,
              boxSizing: "border-box",
            }}
          >
            <Youtube size={48} color="#333" />
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Klistra in YouTube-länk..."
              onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "8px",
                background: "#111",
                border: "1px solid #333",
                color: "white",
                outline: "none",
                boxSizing: "border-box",
              }}
            />

            <button
              onClick={handleUrlSubmit}
              style={{
                padding: "8px 16px",
                background: "#ff0000",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: 600,
                width: "100%",
                marginTop: 4,
                boxSizing: "border-box",
              }}
            >
              Ladda Video
            </button>
          </div>
        )}
      </div>

      {/* Drag Handle (Flytta noden) */}
      <div
        onMouseDown={() => setIsDragging(true)}
        style={{
          position: "absolute",
          top: -14,
          left: "50%",
          transform: "translateX(-50%)",
          width: 48,
          height: 24,
          background: "rgba(30, 30, 35, 0.9)",
          borderRadius: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "grab",
          zIndex: 50,
          border: "1px solid rgba(255,255,255,0.2)",
          opacity: isHovering || selected ? 1 : 0,
          transition: "opacity 0.2s",
        }}
        title="Dra för att flytta"
      >
        <GripHorizontal size={16} color="white" />
      </div>

      {/* 3. View Mode Overlays */}
      {videoId && !isEditing && (
        <>
          {/* Byt video-knapp (liten, nere till vänster eller uppe till vänster vid hover) */}
          <div
            style={{
              position: "absolute",
              top: 10,
              left: 10,
              zIndex: 20,
              opacity: isHovering ? 1 : 0,
              transition: "opacity 0.2s",
            }}
          >
            <button
              onClick={resetNode}
              className="nodrag"
              title="Byt video"
              style={{
                background: "rgba(0,0,0,0.6)",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: "50%",
                padding: "6px",
                cursor: "pointer",
                color: "white",
                display: "flex",
              }}
            >
              <RotateCcw size={14} />
            </button>
          </div>
        </>
      )}

      {/* Ta bort-knapp (Alltid synlig när vald, oavsett om video är laddad eller ej) */}
      {selected && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            data.onDelete?.(id);
          }}
          className="nodrag"
          style={{
            position: "absolute",
            top: -12,
            right: -12,
            background: "#ef4444",
            border: "2px solid #1e1e24",
            borderRadius: "50%",
            width: 28,
            height: 28,
            padding: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            cursor: "pointer",
            zIndex: 100,
            boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
            transition: "all 0.2s",
          }}
          title="Ta bort"
        >
          <X size={16} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}
