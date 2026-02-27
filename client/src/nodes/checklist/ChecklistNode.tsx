import { useState, useRef, useLayoutEffect } from "react";
import { NodeResizer, type NodeProps } from "@xyflow/react";
import { Plus, CheckSquare, Loader2, X } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { BaseNode } from "../../components/BaseNode";
import { useChecklistNode } from "./useChecklistNode";
import ChecklistItem from "./ChecklistItem";
import type { ChecklistNodeType } from "./types";

export default function ChecklistNode({
  id,
  data,
  selected,
}: NodeProps<ChecklistNodeType>) {
  // Använd vår custom hook för all logik
  const { items, isLoading, addItem, updateItem, deleteItem, reorderItems } =
    useChecklistNode(id, data.boardId);

  const [newItemText, setNewItemText] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [title, setTitle] = useState(data.title || "Checklista");
  const containerRef = useRef<HTMLDivElement>(null);

  // 🔥 Dynamisk Font-Scaling Logic
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let lastWidth = 0;

    const updateFontSize = () => {
      const width = container.offsetWidth;

      // Optimering: Avbryt om bredden inte ändrats signifikant
      if (Math.abs(width - lastWidth) < 2) return;
      lastWidth = width;

      // --- KONFIGURATION ---
      const baseWidth = 300;
      const baseFontSize = 16;
      const minFontSize = 12;
      const maxFontSize = 48; // Maxstorlek för listor

      // Beräkna skalning
      const scale = width / baseWidth;
      let newSize = baseFontSize * scale;

      // Begränsa värdet
      newSize = Math.max(minFontSize, Math.min(newSize, maxFontSize));

      container.style.setProperty("--dynamic-font-size", `${newSize}px`);
    };

    const observer = new ResizeObserver(() => updateFontSize());
    observer.observe(container);
    updateFontSize();

    return () => observer.disconnect();
  }, []);

  // 🔥 Konfigurera sensorer för DnD
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Beräkna progress
  const totalItems = items.length;
  const completedItems = items.filter((i) => i.isCompleted).length;
  const progress = totalItems === 0 ? 0 : (completedItems / totalItems) * 100;

  const handleAddItem = async () => {
    if (!newItemText.trim()) return;
    await addItem(newItemText);
    setNewItemText("");
  };

  // 🔥 Hantera drag-slut
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);

      const newItems = arrayMove(items, oldIndex, newIndex);

      const updatedItems = newItems.map((item, index) => ({
        ...item,
        sortOrder: index,
      }));

      reorderItems(updatedItems);
    }
  };

  // Title Component
  const titleComponent = isEditingTitle ? (
    <input
      className="nodrag"
      autoFocus
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      onBlur={() => {
        data.onTitleChange?.(id, title);
        setIsEditingTitle(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          data.onTitleChange?.(id, title);
          setIsEditingTitle(false);
        }
      }}
      style={{
        background: "transparent",
        border: "none",
        outline: "none",
        fontSize: "inherit",
        fontWeight: "inherit",
        color: "inherit",
        width: "100%",
      }}
    />
  ) : (
    <span onClick={() => setIsEditingTitle(true)}>{title}</span>
  );

  return (
    <BaseNode
      id={id}
      ref={containerRef}
      selected={selected}
      title={titleComponent}
      icon={<CheckSquare size={20} color="#84cc16" />}
      accentColor="#84cc16"
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={280}
        minHeight={200}
        onResizeStart={() => data.onResizeStart?.(id)}
        onResize={(_e, params) =>
          data.onResize?.(id, params.width, params.height, params.x, params.y)
        }
        onResizeEnd={(_e, params) =>
          data.onResizeEnd?.(
            id,
            params.width,
            params.height,
            params.x,
            params.y,
          )
        }
      />

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
            width: 24,
            height: 24,
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
          <X size={14} strokeWidth={2.5} />
        </button>
      )}

      <div
        style={{
          height: 4,
          background: "rgba(255,255,255,0.1)",
          width: "100%",
          marginTop: -1,
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${progress}%`,
            background: "#84cc16",
            transition: "width 0.3s ease",
            boxShadow: "0 0 10px rgba(132, 204, 22, 0.5)",
          }}
        />
      </div>

      <div
        className="nodrag"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          padding: 16,
          overflowY: "auto",
          overflowX: "hidden", // 🔥 FIX: Dölj horisontell scrollbar
          gap: 4,
          cursor: "default",
          fontSize: "var(--dynamic-font-size, 16px)",
        }}
      >
        {isLoading ? (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              padding: 20,
              color: "#666",
            }}
          >
            <Loader2 className="animate-spin" size={20} />
          </div>
        ) : items.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              color: "#666",
              fontSize: 13,
              marginTop: 20,
              fontStyle: "italic",
            }}
          >
            Inga punkter än. Lägg till en nedan!
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={items.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              {items.map((item) => (
                <ChecklistItem
                  key={item.id}
                  item={item}
                  onUpdate={updateItem}
                  onDelete={deleteItem}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>

      <div
        className="nodrag"
        style={{
          padding: "12px 16px",
          borderTop: "1px solid rgba(255,255,255,0.1)",
          display: "flex",
          gap: 8,
          fontSize: "var(--dynamic-font-size, 16px)",
        }}
      >
        <input
          value={newItemText}
          onChange={(e) => setNewItemText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
          placeholder="Ny punkt..."
          style={{
            flex: 1,
            background: "rgba(0,0,0,0.2)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 6,
            padding: "6px 10px",
            color: "white",
            fontSize: "inherit",
            outline: "none",
          }}
        />
        <button
          onClick={handleAddItem}
          style={{
            background: "#84cc16",
            border: "none",
            borderRadius: 6,
            width: 32,
            height: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "black",
            flexShrink: 0, // 🔥 FIX: Förhindra att knappen trycks ihop
            padding: 0,
          }}
          title="Lägg till punkt"
        >
          <Plus size={18} strokeWidth={2} />
        </button>
      </div>
    </BaseNode>
  );
}
