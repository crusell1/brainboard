import React, { useEffect, useState, useRef } from "react";
import { Handle, Position, type NodeProps, NodeResizer } from "@xyflow/react";
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  Coffee,
  Brain,
  X,
  FastForward,
  Wrench,
} from "lucide-react";
import {
  type PomodoroData,
  type PomodoroStatus,
  type PomodoroNodeType,
} from "./types";
import PlantRenderer from "./plantSystem/PlantRenderer";
import { getRandomPlantId } from "./plantSystem/registry";
import { pomodoroManager } from "./PomodoroManager";

const WORK_TIME = 25 * 60 * 1000; // 25 min
const BREAK_TIME = 5 * 60 * 1000; // 5 min

// Helper för att formatera tid
const formatTime = (ms: number) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

// Helper för ljud
const playSound = (type: "start" | "pause" | "complete") => {
  const sounds = {
    start: "/sounds/start.mp3",
    pause: "/sounds/pause.mp3",
    complete: "/sounds/complete.mp3",
  };
  const audio = new Audio(sounds[type]);
  audio.volume = 0.5;
  audio.play().catch(() => console.log(`Ljudfil saknas: ${sounds[type]}`));
};

export default function PomodoroNode({
  id,
  data,
  selected,
}: NodeProps<PomodoroNodeType>) {
  // Vi castar data till vår typ, med fallbacks
  const pData = data as unknown as Partial<PomodoroData>;

  // Lokalt state för UI-uppdatering (tick)
  const [timeLeft, setTimeLeft] = useState(WORK_TIME);
  const [progress, setProgress] = useState(1); // 1.0 = full tid kvar

  // Refs för att hålla koll på intervall utan re-renders
  const intervalRef = useRef<number | null>(null);

  const isResizingRef = useRef(false);
  // Initiera default-värden om de saknas i DB
  const status: PomodoroStatus = pData.status || "idle";
  const plantId = pData.plantId || "sunflower";
  const stats = pData.stats || { completed: 0, streak: 0, totalMinutes: 0 };
  const duration = pData.duration || WORK_TIME;

  // 🔥 DEBUG: Kolla om användaren är du
  const isDev = pData.currentUserEmail?.includes("nilscrusell");
  const [showDebug, setShowDebug] = useState(false);

  // --- Global Rule: Lyssna på andra timers ---
  useEffect(() => {
    const unsubscribe = pomodoroManager.subscribe((activeId) => {
      // Om någon annan startade, och jag kör -> Pausa mig
      if (activeId && activeId !== id && status === "work") {
        handlePause();
      }
    });
    return unsubscribe;
  }, [id, status]);

  // --- Timer Logic (Timestamp based) ---
  useEffect(() => {
    const tick = () => {
      if (status !== "work" && status !== "break") return;

      const now = Date.now();
      const startTime = pData.startTime || now;
      const elapsed = now - startTime;
      const remaining = duration - elapsed;

      if (remaining <= 0) {
        handleTimerComplete();
      } else {
        setTimeLeft(remaining);
        setProgress(remaining / duration);
      }
    };

    if (status === "work" || status === "break") {
      // Starta intervall
      intervalRef.current = window.setInterval(tick, 1000);
      tick(); // Kör direkt
    } else {
      // Om vi är idle/paused, visa statisk tid
      if (status === "idle") {
        setTimeLeft(duration);
        setProgress(1);
      }
      if (status === "paused" && pData.startTime) {
        const elapsed = (pData.pausedTime || Date.now()) - pData.startTime;
        const remaining = duration - elapsed;
        setTimeLeft(remaining);
        setProgress(remaining / duration);
      }
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [status, pData.startTime, duration, pData.pausedTime]);

  // --- Actions ---

  const updateData = (newData: Partial<PomodoroData>) => {
    if (data.onDataChange) {
      (data.onDataChange as Function)(id, newData);
    }
  };

  const handleStart = () => {
    pomodoroManager.setActive(id); // Claim global lock

    const now = Date.now();
    let newStartTime = now;

    // Om vi återupptar från paus
    if (status === "paused" && pData.pausedTime && pData.startTime) {
      const timeSpentBeforePause = pData.pausedTime - pData.startTime;
      newStartTime = now - timeSpentBeforePause;
    }

    updateData({
      status: status === "break" ? "break" : "work",
      startTime: newStartTime,
      duration: status === "break" ? BREAK_TIME : WORK_TIME,
      pausedTime: undefined,
      plantId: plantId,
    });
    playSound("start");
  };

  // 🔥 DEBUG: Spola fram 1 minut
  const handleDebugSkip = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (status !== "work" && status !== "break") return;

    const currentStart = pData.startTime || Date.now();
    // Flytta starttiden bakåt 1 minut för att simulera att tid gått
    const newStartTime = currentStart - 60 * 1000;
    updateData({ startTime: newStartTime });
  };

  const handlePause = () => {
    if (status === "idle") return;
    updateData({
      status: "paused",
      pausedTime: Date.now(),
    });
    pomodoroManager.setActive(null);
    playSound("pause");
  };

  const handleStop = () => {
    updateData({
      status: "idle",
      startTime: undefined,
      pausedTime: undefined,
      duration: WORK_TIME,
      plantId: getRandomPlantId(), // Ny växt vid reset
    });
    pomodoroManager.setActive(null);
  };

  const handleTimerComplete = () => {
    const isWork = status === "work";
    const newStats = { ...stats };

    if (isWork) {
      newStats.completed += 1;
      newStats.streak += 1;
      newStats.totalMinutes += 25;
    }

    const nextStatus = isWork ? "break" : "work";
    const nextDuration = isWork ? BREAK_TIME : WORK_TIME;
    const nextPlant = isWork ? plantId : getRandomPlantId();

    updateData({
      status: nextStatus,
      startTime: Date.now(),
      duration: nextDuration,
      stats: newStats,
      plantId: nextPlant,
    });
    playSound("complete");
  };

  // 🔥 DEBUG: Uppdatera stats manuellt
  const updateStats = (key: keyof typeof stats, value: number) => {
    const newStats = { ...stats, [key]: value };
    updateData({ stats: newStats });
  };

  // Färgschema baserat på status
  const isBreak = status === "break";
  const accentColor = isBreak ? "#60a5fa" : "#f472b6"; // Blue vs Pink
  const glowColor = isBreak
    ? "rgba(96, 165, 250, 0.2)"
    : "rgba(244, 114, 182, 0.2)";

  return (
    <div
      className="pomodoro-node"
      style={{
        width: "100%",
        height: "100%",
        minWidth: 300,
        minHeight: 400,
        position: "relative",
      }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={300}
        minHeight={400}
        onResizeStart={() => {
          isResizingRef.current = true;
          pData.onResizeStart?.(id);
        }}
        onResize={(_e, params) => {
          pData.onResize?.(id, params.width, params.height, params.x, params.y);
        }}
        onResizeEnd={(_e, params) => {
          isResizingRef.current = false;
          pData.onResizeEnd?.(
            id,
            params.width,
            params.height,
            params.x,
            params.y,
          );
        }}
      />

      {/* Inner Container for styling and overflow hidden */}
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#1e1e24",
          borderRadius: 24,
          border: `1px solid ${status === "idle" ? "#333" : accentColor}`,
          boxShadow: selected
            ? `0 0 0 2px ${accentColor}, 0 10px 40px -10px rgba(0,0,0,0.5)`
            : "0 10px 30px -10px rgba(0,0,0,0.5)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          transition: "box-shadow 0.3s ease",
          position: "relative",
          boxSizing: "border-box",
        }}
      >
        {/* Progress Bar (Top) */}
        {(status === "work" || status === "break") && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              height: 3,
              background: accentColor,
              width: `${(1 - progress) * 100}%`,
              transition: "width 1s linear",
              zIndex: 10,
            }}
          />
        )}

        {/* Header */}
        <div
          style={{
            padding: "16px 20px 0 20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            zIndex: 5,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              fontWeight: 700,
              color: isBreak ? "#60a5fa" : "#f472b6",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            {isBreak ? <Coffee size={14} /> : <Brain size={14} />}
            {status === "idle"
              ? "Redo"
              : status === "paused"
                ? "Pausad"
                : isBreak
                  ? "Rast"
                  : "Fokus"}
          </div>
        </div>

        {/* Main Content */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            gap: 10,
          }}
        >
          {/* Plant */}
          <div
            style={{
              width: 140,
              height: 140,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                width: "100%",
                height: "100%",
                background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
                opacity: 0.5,
                pointerEvents: "none",
              }}
            />
            <PlantRenderer
              plantId={plantId}
              progress={progress}
              status={status}
            />
          </div>

          {/* Timer */}
          <div
            style={{
              fontSize: 42,
              fontWeight: 700,
              fontFamily: "monospace",
              color: "#fff",
              letterSpacing: "-0.03em",
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1,
              textShadow: "0 4px 12px rgba(0,0,0,0.5)",
            }}
          >
            {formatTime(timeLeft)}
          </div>
        </div>

        {/* Controls */}
        <div
          style={{
            padding: "0 20px 20px 20px",
            display: "flex",
            justifyContent: "center",
            gap: 12,
          }}
        >
          {status === "work" || status === "break" ? (
            <button
              onClick={handlePause}
              style={{
                background: "rgba(234, 179, 8, 0.15)",
                color: "#eab308",
                border: "1px solid rgba(234, 179, 8, 0.3)",
                borderRadius: 16,
                width: 52,
                height: 52,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "transform 0.1s",
              }}
              onMouseDown={(e) =>
                (e.currentTarget.style.transform = "scale(0.95)")
              }
              onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
              onMouseLeave={(e) =>
                (e.currentTarget.style.transform = "scale(1)")
              }
            >
              <Pause size={24} fill="currentColor" />
            </button>
          ) : (
            <button
              onClick={handleStart}
              style={{
                background: "rgba(16, 185, 129, 0.15)",
                color: "#10b981",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                borderRadius: 16,
                width: 52,
                height: 52,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "transform 0.1s",
              }}
              onMouseDown={(e) =>
                (e.currentTarget.style.transform = "scale(0.95)")
              }
              onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
              onMouseLeave={(e) =>
                (e.currentTarget.style.transform = "scale(1)")
              }
            >
              <Play size={24} fill="currentColor" />
            </button>
          )}
          <button
            onClick={handleStop}
            style={{
              background: "rgba(239, 68, 68, 0.1)",
              color: "#ef4444",
              border: "1px solid rgba(239, 68, 68, 0.2)",
              borderRadius: 16,
              width: 52,
              height: 52,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "transform 0.1s",
            }}
            onMouseDown={(e) =>
              (e.currentTarget.style.transform = "scale(0.95)")
            }
            onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            <Square size={20} fill="currentColor" />
          </button>
          <button
            onClick={() => {
              handleStop();
              handleStart();
            }}
            style={{
              background: "rgba(59, 130, 246, 0.1)",
              color: "#3b82f6",
              border: "1px solid rgba(59, 130, 246, 0.2)",
              borderRadius: 16,
              width: 52,
              height: 52,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "transform 0.1s",
            }}
            onMouseDown={(e) =>
              (e.currentTarget.style.transform = "scale(0.95)")
            }
            onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            <RotateCcw size={20} />
          </button>

          {/* 🔥 DEBUG BUTTON */}
          <button
            onClick={handleDebugSkip}
            disabled={status === "idle" || status === "paused"}
            style={{
              background: "transparent",
              border: "1px solid #333",
              borderRadius: 16,
              width: 52,
              height: 52,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: "#555",
              cursor:
                status === "idle" || status === "paused"
                  ? "not-allowed"
                  : "pointer",
              opacity: status === "idle" || status === "paused" ? 0.3 : 1,
              transition: "all 0.2s",
            }}
            title="Debug: +1 min"
          >
            <FastForward size={16} />
          </button>
        </div>

        {/* Footer Stats */}
        <div
          style={{
            background: "rgba(0,0,0,0.3)",
            padding: "10px 20px",
            display: "flex",
            justifyContent: "space-between",
            fontSize: 10,
            color: "#666",
            fontWeight: 700,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            borderTop: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <div style={{ display: "flex", gap: 6 }}>
            <span>Streak</span>
            <span style={{ color: "#fff" }}>{stats.streak} 🔥</span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <span>Totalt</span>
            <span style={{ color: "#fff" }}>{stats.completed}</span>
          </div>
        </div>
      </div>

      {/* 🔥 HEMLIG DEBUG MENY (Endast för nilscrusell) */}
      {isDev && (
        <div
          className="nodrag"
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            width: "100%",
            marginTop: 8,
            background: "#111",
            border: "1px dashed #444",
            borderRadius: 8,
            padding: 8,
            zIndex: 100,
          }}
        >
          <div
            onClick={() => setShowDebug(!showDebug)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 10,
              color: "#666",
              cursor: "pointer",
              fontWeight: "bold",
              textTransform: "uppercase",
            }}
          >
            <Wrench size={10} /> Dev Tools {showDebug ? "▼" : "▶"}
          </div>

          {showDebug && (
            <div
              style={{
                marginTop: 8,
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ color: "#888", fontSize: 11 }}>Streak:</span>
                <input
                  type="number"
                  value={stats.streak}
                  onChange={(e) =>
                    updateStats("streak", parseInt(e.target.value) || 0)
                  }
                  style={{
                    width: 50,
                    background: "#222",
                    border: "1px solid #333",
                    color: "white",
                    fontSize: 11,
                    padding: 2,
                    borderRadius: 4,
                  }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ color: "#888", fontSize: 11 }}>Completed:</span>
                <input
                  type="number"
                  value={stats.completed}
                  onChange={(e) =>
                    updateStats("completed", parseInt(e.target.value) || 0)
                  }
                  style={{
                    width: 50,
                    background: "#222",
                    border: "1px solid #333",
                    color: "white",
                    fontSize: 11,
                    padding: 2,
                    borderRadius: 4,
                  }}
                />
              </div>
              <button
                onClick={() =>
                  updateData({ duration: 5000, startTime: Date.now() })
                }
                style={{
                  marginTop: 4,
                  background: "#333",
                  border: "none",
                  color: "white",
                  fontSize: 10,
                  padding: 4,
                  borderRadius: 4,
                  cursor: "pointer",
                }}
              >
                Sätt timer till 5 sek
              </button>
            </div>
          )}
        </div>
      )}

      {/* Close Button - Placerad utanför inner-container för att synas tydligt */}
      {selected && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            pData.onDelete?.(id);
          }}
          style={{
            position: "absolute",
            top: -10,
            right: -10,
            background: "#2a2a30",
            border: "2px solid #1e1e24",
            borderRadius: "50%",
            width: 30,
            height: 30,
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
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.1)";
            e.currentTarget.style.background = "#3f3f46";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.background = "#2a2a30";
          }}
          title="Ta bort"
        >
          <X size={16} strokeWidth={2.5} />
        </button>
      )}

      <Handle type="target" position={Position.Top} className="!bg-[#555]" />
      <Handle type="source" position={Position.Bottom} className="!bg-[#555]" />
    </div>
  );
}
