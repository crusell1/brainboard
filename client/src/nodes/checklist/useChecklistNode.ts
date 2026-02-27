import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { habitService } from "../../services/habitService";
import type { HabitItem, HabitResetRule } from "./types";
import type { DbHabitItem } from "../../types/database"; // 🔥 FIX: Importera denna!
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

export function useChecklistNode(nodeId: string, boardId: string | null) {
  const [items, setItems] = useState<HabitItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const userIdRef = useRef<string | null>(null);

  // Hämta initial data
  useEffect(() => {
    if (!nodeId || !boardId) return;

    let isMounted = true;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("User not authenticated");
        userIdRef.current = user.id;

        const fetchedItems = await habitService.fetchItemsForNode(nodeId);
        if (isMounted) {
          setItems(fetchedItems);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message);
        }
        console.error(err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [nodeId, boardId]);

  // Sätt upp Realtime-prenumeration
  useEffect(() => {
    if (!nodeId || !boardId) return;

    const handlePostgresChanges = (
      payload: RealtimePostgresChangesPayload<{ [key: string]: any }>,
    ) => {
      console.log("Checklist Realtime event:", payload);

      const { eventType, new: newRecord, old: oldRecord } = payload;

      setItems((currentItems) => {
        if (eventType === "INSERT") {
          const newItem = fromDb(newRecord as DbHabitItem); // 🔥 Type cast
          if (currentItems.some((item) => item.id === newItem.id)) {
            return currentItems;
          }
          return [...currentItems, newItem].sort(
            (a, b) => a.sortOrder - b.sortOrder,
          );
        }

        if (eventType === "UPDATE") {
          const updatedItem = fromDb(newRecord as DbHabitItem); // 🔥 Type cast
          // Om sort_order ändrades, sortera om listan
          const newList = currentItems.map((item) =>
            item.id === updatedItem.id ? updatedItem : item,
          );
          return newList.sort((a, b) => a.sortOrder - b.sortOrder);
        }

        if (eventType === "DELETE") {
          return currentItems.filter((item) => item.id !== oldRecord.id);
        }

        return currentItems;
      });
    };

    const channel = supabase
      .channel(`checklist-node-${nodeId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "habit_items",
          filter: `node_id=eq.`, // 🔥 FIX: Lägg till nodeId i filtret
        },
        handlePostgresChanges,
      )
      .subscribe((status, err) => {
        if (status === "SUBSCRIBED") {
          console.log(`✅ Subscribed to checklist items for node `); // 🔥 FIX: Logga ID
        }
        if (status === "CHANNEL_ERROR") {
          console.error(`Error subscribing to checklist items:`, err);
          setError("Realtime connection failed.");
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [nodeId, boardId]);

  // Callbacks för att manipulera items
  const addItem = useCallback(
    async (content: string) => {
      // 🔥 DEBUG: Kolla vad som saknas om det inte funkar
      if (!nodeId || !boardId || !userIdRef.current) {
        console.error("❌ addItem failed: Missing data", {
          nodeId,
          boardId,
          userId: userIdRef.current,
        });
        return;
      }

      console.log("✅ addItem called:", content);

      const newSortOrder =
        items.length > 0 ? Math.max(...items.map((i) => i.sortOrder)) + 1 : 0;

      try {
        // Vi väntar på svaret för att se eventuella fel direkt
        const newItem = await habitService.createHabitItem(
          nodeId,
          boardId,
          userIdRef.current,
          content,
          newSortOrder,
        );

        if (newItem) {
          console.log("✅ Item created in DB:", newItem);
          // 🔥 Uppdatera state direkt för snabbare UX (Realtime hanterar dubbletter)
          setItems((prev) =>
            [...prev, newItem].sort((a, b) => a.sortOrder - b.sortOrder),
          );
        }
      } catch (err) {
        console.error("Failed to add item:", err);
        setError("Could not add item.");
      }
    },
    [nodeId, boardId, items],
  );

  const updateItem = useCallback(
    async (itemId: string, updates: Partial<HabitItem>) => {
      setItems((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, ...updates } : item,
        ),
      );

      try {
        await habitService.updateHabitItem(itemId, updates);
      } catch (err) {
        console.error("Failed to update item:", err);
        setError("Could not update item.");
      }
    },
    [],
  );

  // 🔥 NY: Funktion för att spara ny ordning
  const reorderItems = useCallback(async (newItems: HabitItem[]) => {
    // Optimistisk uppdatering
    setItems(newItems);

    // Förbered data för DB (bara ID och ny sortOrder)
    const updates = newItems.map((item, index) => ({
      id: item.id,
      sortOrder: index,
    }));

    try {
      await habitService.reorderHabitItems(updates);
    } catch (err) {
      console.error("Failed to reorder items:", err);
      setError("Could not reorder items.");
    }
  }, []);

  const deleteItem = useCallback(async (itemId: string) => {
    setItems((prev) => prev.filter((item) => item.id !== itemId));
    try {
      await habitService.deleteHabitItem(itemId);
    } catch (err) {
      console.error("Failed to delete item:", err);
      setError("Could not delete item.");
    }
  }, []);

  return {
    items,
    isLoading,
    error,
    addItem,
    updateItem,
    deleteItem,
    reorderItems,
  };
}

// Helper function
const fromDb = (dbItem: DbHabitItem): HabitItem => ({
  id: dbItem.id,
  nodeId: dbItem.node_id,
  content: dbItem.content,
  isCompleted: dbItem.is_completed,
  completedAt: dbItem.completed_at,
  sortOrder: dbItem.sort_order,
  resetRule: dbItem.reset_rule as HabitResetRule,
  resetDays: dbItem.reset_days,
  streakCurrent: dbItem.streak_current,
  streakLongest: dbItem.streak_longest,
  streakLastCompletedAt: dbItem.streak_last_completed_at,
  lastResetAt: dbItem.last_reset_at,
  createdAt: dbItem.created_at,
  updatedAt: dbItem.updated_at,
});
