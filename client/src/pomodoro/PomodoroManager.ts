type Listener = (activeId: string | null) => void;

class PomodoroManager {
  private activeId: string | null = null;
  private listeners: Set<Listener> = new Set();

  // Sätt vilken nod som är aktiv
  setActive(id: string | null) {
    if (this.activeId !== id) {
      this.activeId = id;
      this.notify();
    }
  }

  getActive() {
    return this.activeId;
  }

  // Prenumerera på ändringar
  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => listener(this.activeId));
  }
}

export const pomodoroManager = new PomodoroManager();
