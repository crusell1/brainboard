import { supabase } from "../lib/supabase";
import type { DbHabitItem } from "../types/database";
import type { HabitItem } from "../nodes/checklist/types";

// Helper för att mappa från DB (snake_case) till Frontend (camelCase)
const fromDb = (dbItem: DbHabitItem): HabitItem => ({
  id: dbItem.id,
  nodeId: dbItem.node_id,
  content: dbItem.content,
  isCompleted: dbItem.is_completed,
  completedAt: dbItem.completed_at,
  sortOrder: dbItem.sort_order,
  resetRule: dbItem.reset_rule,
  resetDays: dbItem.reset_days,
  streakCurrent: dbItem.streak_current,
  streakLongest: dbItem.streak_longest,
  streakLastCompletedAt: dbItem.streak_last_completed_at,
  lastResetAt: dbItem.last_reset_at,
  createdAt: dbItem.created_at,
  updatedAt: dbItem.updated_at,
});

// Helper för att mappa från Frontend (camelCase) till DB (snake_case)
const toDb = (
  item: Partial<HabitItem>,
): Partial<
  Omit<DbHabitItem, "id" | "user_id" | "board_id" | "created_at">
> => ({
  node_id: item.nodeId,
  content: item.content,
  is_completed: item.isCompleted,
  completed_at: item.completedAt,
  sort_order: item.sortOrder,
  reset_rule: item.resetRule,
  reset_days: item.resetDays,
  streak_current: item.streakCurrent,
  streak_longest: item.streakLongest,
  streak_last_completed_at: item.streakLastCompletedAt,
  last_reset_at: item.lastResetAt,
});

export const habitService = {
  async fetchItemsForNode(nodeId: string): Promise<HabitItem[]> {
    const { data, error } = await supabase
      .from("habit_items")
      .select("*")
      .eq("node_id", nodeId)
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("Error fetching habit items:", error);
      throw error;
    }

    return data.map(fromDb);
  },

  async createHabitItem(
    nodeId: string,
    boardId: string,
    userId: string,
    content: string,
    sortOrder: number,
  ): Promise<HabitItem | null> {
    const { data, error } = await supabase
      .from("habit_items")
      .insert({
        node_id: nodeId,
        board_id: boardId,
        user_id: userId,
        content,
        sort_order: sortOrder,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating habit item:", error);
      throw error;
    }

    return data ? fromDb(data) : null;
  },

  async updateHabitItem(
    itemId: string,
    updates: Partial<HabitItem>,
  ): Promise<HabitItem | null> {
    const dbUpdates = toDb(updates);
    dbUpdates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("habit_items")
      .update(dbUpdates)
      .eq("id", itemId)
      .select()
      .single();

    if (error) {
      console.error("Error updating habit item:", error);
      throw error;
    }

    return data ? fromDb(data) : null;
  },

  // 🔥 NY: Batch-uppdatera ordning
  async reorderHabitItems(
    items: { id: string; sortOrder: number }[],
  ): Promise<void> {
    const updates = items.map((item) => ({
      id: item.id,
      sort_order: item.sortOrder,
      updated_at: new Date().toISOString(),
    }));

    // Upsert uppdaterar befintliga rader baserat på ID
    const { error } = await supabase.from("habit_items").upsert(updates as any);

    if (error) {
      console.error("Error reordering habit items:", error);
      throw error;
    }
  },

  async deleteHabitItem(itemId: string): Promise<void> {
    const { error } = await supabase
      .from("habit_items")
      .delete()
      .eq("id", itemId);

    if (error) {
      console.error("Error deleting habit item:", error);
      throw error;
    }
  },
};
