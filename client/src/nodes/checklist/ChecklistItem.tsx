import { useState, useRef, useEffect } from "react";
import {
  Check,
  Trash2,
  Flame,
  RotateCcw,
  Settings,
  GripVertical,
} from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { HabitItem } from "./types";
import ChecklistItemSettings from "./ChecklistItemSettings";

interface ChecklistItemProps {
  item: HabitItem;
  onUpdate: (id: string, data: Partial<HabitItem>) => void;
  onDelete: (id: string) => void;
}

export default function ChecklistItem({
  item,
  onUpdate,
  onDelete,
}: ChecklistItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [content, setContent] = useState(item.content);
  const inputRef = useRef<HTMLInputElement>(null);
  const settingsBtnRef = useRef<HTMLButtonElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : item.isCompleted ? 0.6 : 1,
    zIndex: isDragging ? 999 : "auto",
    position: "relative" as const,
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "4px 0",
  };

  useEffect(() => {
    if (!isEditing) {
      setContent(item.content);
    }
  }, [item.content, isEditing]);

  const handleBlur = () => {
    setIsEditing(false);
    if (content !== item.content) {
      onUpdate(item.id, { content });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      inputRef.current?.blur();
    }
  };

  const toggleComplete = () => {
    const isCompleted = !item.isCompleted;
    const now = new Date().toISOString();

    onUpdate(item.id, {
      isCompleted,
      completedAt: isCompleted ? now : null,
    });
  };

  return (
    <div ref={setNodeRef} style={style} className="nodrag group">
      <div
        {...attributes}
        {...listeners}
        style={{
          cursor: "grab",
          color: "#555",
          display: "flex",
          alignItems: "center",
          opacity: 0,
          transition: "opacity 0.2s",
        }}
        className="drag-handle"
      >
        <GripVertical size={14} />
      </div>

      <div
        onClick={toggleComplete}
        style={{
          width: 20,
          height: 20,
          borderRadius: 6,
          border: `2px solid ${item.isCompleted ? "#10b981" : "#555"}`,
          background: item.isCompleted
            ? "rgba(16, 185, 129, 0.2)"
            : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          flexShrink: 0,
          transition: "all 0.2s",
        }}
      >
        {item.isCompleted && (
          <Check size={14} color="#10b981" strokeWidth={3} />
        )}
      </div>

      <input
        ref={inputRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsEditing(true)}
        style={{
          flex: 1,
          minWidth: 0, // 🔥 FIX: Tillåt input att krympa
          background: "transparent",
          border: "none",
          fontSize: "inherit",
          outline: "none",
          textDecoration: item.isCompleted ? "line-through" : "none",
          color: item.isCompleted ? "#888" : "#eee",
        }}
      />

      {item.streakCurrent > 0 && (
        <div
          title={`Streak: ${item.streakCurrent} dagar`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            fontSize: "0.75em",
            color: "#f59e0b",
            background: "rgba(245, 158, 11, 0.1)",
            padding: "2px 6px",
            borderRadius: 10,
            flexShrink: 0,
          }}
        >
          <Flame size="1em" fill="currentColor" />
          {item.streakCurrent}
        </div>
      )}

      {item.resetRule !== "none" && (
        <div title={`Återställs: ${item.resetRule}`} style={{ opacity: 0.5 }}>
          <RotateCcw size={12} color="#888" />
        </div>
      )}

      <button
        ref={settingsBtnRef}
        onClick={(e) => {
          e.stopPropagation();
          setIsSettingsOpen(!isSettingsOpen);
        }}
        style={{
          background: "transparent",
          border: "none",
          color: isSettingsOpen ? "#fff" : "#888",
          cursor: "pointer",
          padding: 4,
          display: "flex",
          opacity: isSettingsOpen ? 1 : 0,
          transition: "opacity 0.2s",
        }}
        className="settings-btn"
        title="Inställningar"
      >
        <Settings size={14} />
      </button>

      <button
        onClick={() => onDelete(item.id)}
        style={{
          background: "transparent",
          border: "none",
          color: "#ef4444",
          cursor: "pointer",
          padding: 4,
          display: "flex",
          opacity: 0,
          transition: "opacity 0.2s",
        }}
        className="delete-btn"
      >
        <Trash2 size={14} />
      </button>

      <style>{`
        .group:hover .delete-btn, .group:hover .settings-btn, .group:hover .drag-handle { opacity: 0.7 !important; }
        .delete-btn:hover, .settings-btn:hover, .drag-handle:hover { opacity: 1 !important; }
      `}</style>

      {isSettingsOpen && (
        <ChecklistItemSettings
          item={item}
          onUpdate={onUpdate}
          onClose={() => setIsSettingsOpen(false)}
          triggerRect={settingsBtnRef.current?.getBoundingClientRect() || null}
        />
      )}
    </div>
  );
}
