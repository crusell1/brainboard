import { useEffect, useState, useRef } from "react";
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
  Flower,
} from "lucide-react";
import {
  type PomodoroData,
  type PomodoroStatus,
  type PomodoroNodeType,
} from "./types";
import PlantRenderer from "./plantSystem/PlantRenderer";
import { pomodoroManager } from "./PomodoroManager";
import { supabase } from "../lib/supabase";
import FlowerRewardModal, {
  type FlowerDrop,
} from "../components/FlowerRewardModal";
import FlowerCollectionModal from "../components/FlowerCollectionModal";
import LevelDisplay from "../components/LevelDisplay";
import { getLevelFromXp } from "../lib/progression";
import { getBackgroundForLevel } from "../config/backgrounds";

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
const playSound = (type: "start" | "pause" | "complete" | "levelup") => {
  const sounds = {
    start: "/sounds/start.mp3",
    pause: "/sounds/pause.mp3",
    complete: "/sounds/complete.mp3",
    levelup: "/sounds/levelup.mp3", // 🔥 NY
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
  // Lokalt state för UI-uppdatering (tick)
  const [timeLeft, setTimeLeft] = useState(WORK_TIME);
  const [progress, setProgress] = useState(1); // 1.0 = full tid kvar

  // Refs för att hålla koll på intervall utan re-renders
  const intervalRef = useRef<number | null>(null);

  const isResizingRef = useRef(false);
  // 🔥 NY: Ref för att förhindra att handleTimerComplete körs flera gånger (re-entry protection)
  const isCompletingRef = useRef(false);

  // 🔥 FIX: Ref för att alltid komma åt senaste data inuti setInterval (löser Stale Closure)
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // Initiera default-värden om de saknas i DB
  const status: PomodoroStatus = data.status || "idle";
  const plantId = data.plantId || "stitchFlower";
  const stats = data.stats || { completed: 0, streak: 0, totalMinutes: 0 };
  const duration = data.duration || WORK_TIME;

  // 🔥 DEBUG: Kolla om användaren är du
  const isDev = data.currentUserEmail?.includes("nilscrusell");
  const [showDebug, setShowDebug] = useState(false);

  // 🔥 State för belöning
  const [flowerReward, setFlowerReward] = useState<FlowerDrop | null>(null);
  const [showCollection, setShowCollection] = useState(false);

  // 🔥 State för XP
  const [totalXp, setTotalXp] = useState(0);
  const [selectedBackground, setSelectedBackground] = useState<string | null>(
    null,
  );

  // 🔥 Hämta XP vid mount
  useEffect(() => {
    const fetchXp = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("total_xp, selected_background")
          .eq("id", user.id)
          .single();
        if (data) {
          setTotalXp(data.total_xp || 0);
          setSelectedBackground(data.selected_background);
        }
      }
    };
    fetchXp();
  }, []);

  // 🔥 Reset completion lock när status ändras (ny session startar)
  useEffect(() => {
    isCompletingRef.current = false;
  }, [status]);

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
      const startTime = data.startTime || now;
      const elapsed = now - startTime;
      const remaining = duration - elapsed;

      if (remaining <= 0) {
        // 🔥 FIX: Anropa bara om vi inte redan håller på att avsluta
        if (!isCompletingRef.current) {
          handleTimerComplete();
        }
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
      if (status === "paused" && data.startTime) {
        const elapsed = (data.pausedTime || Date.now()) - data.startTime;
        const remaining = duration - elapsed;
        setTimeLeft(remaining);
        setProgress(remaining / duration);
      }
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [status, data.startTime, duration, data.pausedTime]);

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
    if (status === "paused" && data.pausedTime && data.startTime) {
      const timeSpentBeforePause = data.pausedTime - data.startTime;
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

    const currentStart = data.startTime || Date.now();
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
      plantId: plantId, // 🔥 FIX: Behåll nuvarande växt vid stopp
    });
    pomodoroManager.setActive(null);
  };

  const handleTimerComplete = async () => {
    // 🔥 SÄKERHET: Dubbelkoll för att garantera att vi bara kör en gång
    if (isCompletingRef.current) return;
    isCompletingRef.current = true;

    const isWork = status === "work";
    const newStats = { ...stats };

    if (isWork) {
      newStats.completed += 1;
      newStats.streak += 1;
      newStats.totalMinutes += 25;
    }

    const nextStatus = isWork ? "break" : "work";
    const nextDuration = isWork ? BREAK_TIME : WORK_TIME;
    const nextPlant = plantId; // 🔥 FIX: Byt inte växt automatiskt
    playSound("complete");

    // Hämta nuvarande DNA
    // 🔥 FIX: Läs från ref för att garantera att vi inte använder gammalt state från när timern startade
    let currentDna = dataRef.current.plantDna;
    let nextPendingDna = dataRef.current.stats?.pendingDna;
    const currentFlowerInfo = dataRef.current.currentFlower; // 🔥 Hämta info om nuvarande blomma

    // 🔥 NY: Variabel för att hålla info om nästa blomma (initiera med nuvarande)
    let nextFlowerInfo = currentFlowerInfo;

    // 🔥 FIX: Fallback - Om pendingDna saknas i props (DB-lagg), använd lokalt state
    if (!nextPendingDna && flowerReward && !isWork) {
      console.log(
        "⚠️ pendingDna saknas i props, använder lokalt state (flowerReward)",
      );
      nextPendingDna = flowerReward.dna;
    }

    // 🔥 Flower Drop Logic (Endast efter work-session)
    if (isWork) {
      try {
        console.log("🎲 Timer klar! Försöker hämta blomma...");

        // 🔥 ANVÄND NY RPC: Skicka med ID på blomman vi just odlat
        const { data: nextFlower, error } = await supabase.rpc(
          "harvest_and_roll_next",
          {
            harvested_flower_id: currentFlowerInfo?.id || null,
          },
        );

        if (error) {
          console.error("❌ RPC Error (harvest_and_roll_next):", error);
        } else if (nextFlower) {
          console.log("🌸 Next Flower Rolled:", nextFlower);

          // 🔥 Uppdatera XP lokalt
          if (nextFlower.total_xp) setTotalXp(nextFlower.total_xp);

          // 🔥 Spela Level Up ljud
          if (nextFlower.level_up) {
            playSound("levelup");
          }

          // 🔥 VISA BELÖNING: Visa den blomma vi faktiskt odlade (currentFlowerInfo)
          // Om info saknas (gammal nod), visa den nya som fallback.
          const rewardToShow = currentFlowerInfo
            ? {
                ...currentFlowerInfo,
                dna: currentDna!, // Använd nuvarande DNA
                count: 0,
                xpGained: nextFlower.xp_gained, // 🔥 XP från skörden
                levelUp: nextFlower.level_up, // 🔥 Level up flagga
                newLevel: nextFlower.new_level, // 🔥 Ny level
              }
            : nextFlower;

          setFlowerReward(rewardToShow as FlowerDrop);

          // 🔥 FÖRBERED NÄSTA: Spara den NYA blomman i pendingDna
          nextPendingDna = nextFlower.dna;

          // 🔥 SPARA NY BLOMINFO: Så vi vet vad som växer nästa gång
          nextFlowerInfo = {
            id: nextFlower.id,
            name: nextFlower.name,
            rarity: nextFlower.rarity,
            description: nextFlower.description,
          };

          // 🔥 VIKTIGT: Uppdatera currentFlower inför nästa session också!
          // Vi gör det i updateData nedan via 'currentFlower: nextFlower'
        } else {
          console.warn("⚠️ RPC lyckades men returnerade ingen blomma (null).");
        }
      } catch (err) {
        console.error("❌ Unexpected error during flower drop:", err);
      }
    } else {
      // 🔥 BREAK COMPLETE -> WORK START
      // Nu planterar vi den nya blomman!
      if (nextPendingDna) {
        console.log("🌱 Planterar ny blomma från pending:", nextPendingDna);
        currentDna = nextPendingDna; // Byt ut blomman som ska växa
        nextPendingDna = undefined; // Rensa pending
      }
    }

    // Uppdatera stats med eventuell pendingDna
    const updatedStats = { ...newStats, pendingDna: nextPendingDna };

    // 🔥 Om vi fick en ny blomma (nextFlower från RPC), spara den som currentFlower inför nästa runda
    // Vi har inte tillgång till 'nextFlower' variabeln här ute pga scope, men vi kan
    // lösa det genom att spara den i en temp-variabel eller state, men enklast är att
    // lita på att nästa session använder 'plantDna' för rendering.
    // För att 'currentFlower' ska vara rätt NÄSTA gång vi vinner, måste vi uppdatera den nu.
    // Det kräver att vi flyttar ut RPC-logiken eller uppdaterar state smartare.

    // FÖRENKLING: Vi uppdaterar bara plantDna nu. 'currentFlower' uppdateras bäst via
    // att vi sparar ner resultatet från RPC i updateData.
    // Men vänta, updateData körs sist.

    // Låt oss göra så här: Vi behöver spara 'nextFlower' i databasen så den finns där.
    // Vi lägger till 'nextFlower' i updateData-anropet.

    // (OBS: Jag måste justera koden ovan för att få ut 'nextFlower' till updateData scope)
    // Se korrigerad kod nedan.

    // 🔥 FIX: Gör EN enda uppdatering med både status och DNA för att undvika race conditions
    updateData({
      status: nextStatus,
      startTime: Date.now(),
      duration: nextDuration,
      stats: updatedStats,
      plantId: nextPlant,
      plantDna: currentDna, // Uppdatera DNA (antingen samma eller den nya från pending)
      currentFlower: nextFlowerInfo, // 🔥 FIX: Uppdatera currentFlower i DB
    });
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

  // 🔥 Beräkna level och bakgrund
  const currentLevel = getLevelFromXp(totalXp);
  const backgroundStyle =
    selectedBackground || getBackgroundForLevel(currentLevel);

  return (
    <div
      className="pomodoro-node"
      style={{
        width: "100%",
        height: "100%",
        minWidth: 340, // 🔥 Ökad bredd för bättre layout
        minHeight: 460, // 🔥 Ökad höjd för mer luft
        position: "relative",
      }}
    >
      {/* 🔥 Visa Reward Modal om vi har en vinst */}
      {flowerReward && (
        <FlowerRewardModal
          flower={flowerReward}
          onClose={() => setFlowerReward(null)}
        />
      )}

      {/* 🔥 Visa Collection Modal */}
      {showCollection && (
        <FlowerCollectionModal
          onClose={() => setShowCollection(false)}
          totalXp={totalXp}
          selectedBackground={selectedBackground}
          onSelectBackground={async (bg) => {
            setSelectedBackground(bg);
            // Spara till DB
            const {
              data: { user },
            } = await supabase.auth.getUser();
            if (user) {
              await supabase
                .from("profiles")
                .update({ selected_background: bg })
                .eq("id", user.id);
            }
          }}
          stats={stats}
        />
      )}

      <NodeResizer
        isVisible={selected}
        minWidth={340} // 🔥 Matchar ny min-bredd
        minHeight={460} // 🔥 Matchar ny min-höjd
        onResizeStart={() => {
          isResizingRef.current = true;
          data.onResizeStart?.(id);
        }}
        onResize={(_e, params) => {
          data.onResize?.(id, params.width, params.height, params.x, params.y);
        }}
        onResizeEnd={(_e, params) => {
          isResizingRef.current = false;
          data.onResizeEnd?.(
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
          background: backgroundStyle, // 🔥 Dynamisk bakgrund
          borderRadius: 24,
          border: `1px solid ${status === "idle" ? "#333" : accentColor}`,
          boxShadow: selected
            ? `0 0 0 2px ${accentColor}, 0 10px 40px -10px ${glowColor}`
            : `0 10px 30px -10px ${status === "idle" ? "rgba(0,0,0,0.5)" : glowColor}`,
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
              top: 16, // 🔥 Lite avstånd från kanten
              left: 20, // 🔥 Marginal på sidorna
              right: 20,
              height: 8, // 🔥 Tjockare bar
              background: "rgba(255,255,255,0.1)", // 🔥 Track-färg (mörkare bakgrund)
              borderRadius: 4, // 🔥 Rundade hörn
              zIndex: 10,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                background: accentColor,
                width: `${(1 - progress) * 100}%`, // 🔥 Visar elapsed (1 - remaining)
                transition: "width 1s linear",
                borderRadius: 4,
                boxShadow: `0 0 10px ${accentColor}`, // 🔥 Lätt glow
              }}
            />
          </div>
        )}

        {/* Header */}
        <div
          style={{
            padding: "16px 20px 0 20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            zIndex: 5,
            marginTop: status === "work" || status === "break" ? 12 : 0, // 🔥 Flytta ner header lite om baren visas
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
            gap: 20, // 🔥 Mer luft mellan blomma och timer
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
                background: `radial-gradient(circle,  0%, transparent 70%)`,
                opacity: 0.5,
                pointerEvents: "none",
              }}
            />
            <PlantRenderer
              plantId={plantId}
              progress={progress}
              status={status}
              dna={data.plantDna} // 🔥 Skicka med DNA till renderaren
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
            padding: "0 20px 24px 20px", // 🔥 Lite mer padding i botten
            display: "flex",
            justifyContent: "center",
            gap: 16, // 🔥 Mer mellanrum mellan knapparna
          }}
        >
          {status === "work" || status === "break" ? (
            <button
              onClick={handlePause}
              style={{
                background: "rgba(0, 0, 0, 0.6)",
                backdropFilter: "blur(8px)",
                color: "#facc15",
                border: "1px solid rgba(250, 204, 21, 0.4)",
                borderRadius: 16,
                width: 52,
                height: 52,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "transform 0.1s, background 0.2s",
                boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
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
                background: "rgba(0, 0, 0, 0.6)",
                backdropFilter: "blur(8px)",
                color: "#4ade80",
                border: "1px solid rgba(74, 222, 128, 0.4)",
                borderRadius: 16,
                width: 52,
                height: 52,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "transform 0.1s, background 0.2s",
                boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
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
              background: "rgba(0, 0, 0, 0.6)",
              backdropFilter: "blur(8px)",
              color: "#f87171",
              border: "1px solid rgba(248, 113, 113, 0.4)",
              borderRadius: 16,
              width: 52,
              height: 52,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "transform 0.1s, background 0.2s",
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
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
              background: "rgba(0, 0, 0, 0.6)",
              backdropFilter: "blur(8px)",
              color: "#60a5fa",
              border: "1px solid rgba(96, 165, 250, 0.4)",
              borderRadius: 16,
              width: 52,
              height: 52,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "transform 0.1s, background 0.2s",
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            }}
            onMouseDown={(e) =>
              (e.currentTarget.style.transform = "scale(0.95)")
            }
            onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            <RotateCcw size={20} />
          </button>

          {/* 🔥 GARDEN BUTTON */}
          <button
            onClick={() => setShowCollection(true)}
            style={{
              background: "rgba(0, 0, 0, 0.6)",
              backdropFilter: "blur(8px)",
              color: "#4ade80",
              border: "1px solid rgba(74, 222, 128, 0.4)",
              borderRadius: 16,
              width: 52,
              height: 52,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "transform 0.1s, background 0.2s",
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            }}
            title="Min Trädgård"
            onMouseDown={(e) =>
              (e.currentTarget.style.transform = "scale(0.95)")
            }
            onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            <Flower size={20} />
          </button>

          {/* 🔥 DEBUG BUTTON */}
          <button
            onClick={handleDebugSkip}
            disabled={status === "idle" || status === "paused"}
            style={{
              background: "rgba(0, 0, 0, 0.6)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              borderRadius: 16,
              width: 52,
              height: 52,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: "#e5e7eb",
              cursor:
                status === "idle" || status === "paused"
                  ? "not-allowed"
                  : "pointer",
              opacity: status === "idle" || status === "paused" ? 0.5 : 1,
              transition: "all 0.2s",
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            }}
            title="Debug: +1 min"
          >
            <FastForward size={16} />
          </button>
        </div>

        {/* 🔥 Level Display */}
        <div
          style={{
            width: "100%",
            padding: "0 20px 20px 20px",
            boxSizing: "border-box",
          }}
        >
          <LevelDisplay totalXp={totalXp} />
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
                <span style={{ color: "#888", fontSize: 11 }}>XP:</span>
                <input
                  type="number"
                  value={totalXp}
                  onChange={(e) => setTotalXp(parseInt(e.target.value) || 0)}
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
              <button
                onClick={async () => {
                  if (
                    confirm(
                      "Är du säker på att du vill nollställa allt (Blommor + XP)?",
                    )
                  ) {
                    const {
                      data: { user },
                    } = await supabase.auth.getUser();
                    if (user) {
                      // Reset flowers
                      const { error: fError } = await supabase
                        .from("user_flowers")
                        .delete()
                        .eq("user_id", user.id);

                      // Reset XP/Level
                      const { error: pError } = await supabase
                        .from("profiles")
                        .update({
                          total_xp: 0,
                          current_level: 1,
                          selected_background: null,
                        })
                        .eq("id", user.id);

                      if (fError || pError) {
                        console.error("Reset error:", fError, pError);
                        alert("Fel vid återställning.");
                      } else {
                        alert("Allt nollställt!");
                        setTotalXp(0);
                        setSelectedBackground(null);

                        // 🔥 Nollställ även nodens utseende och stats direkt
                        updateData({
                          stats: { completed: 0, streak: 0, totalMinutes: 0 },
                          plantDna: undefined,
                          currentFlower: undefined,
                        });
                      }
                    }
                  }
                }}
                style={{
                  marginTop: 4,
                  background: "#ef4444",
                  border: "none",
                  color: "white",
                  fontSize: 10,
                  padding: 4,
                  borderRadius: 4,
                  cursor: "pointer",
                }}
              >
                Reset Flowers
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
            data.onDelete?.(id);
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
