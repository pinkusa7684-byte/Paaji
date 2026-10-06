import { StoredMemory } from '../types/assistant';

const STORAGE_KEY = 'paaji_memories_v1';

export const memoryService = {
  getMemories(): StoredMemory[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return [];
      return JSON.parse(data) as StoredMemory[];
    } catch {
      return [];
    }
  },

  saveMemory(key: string, value: string): StoredMemory {
    const list = this.getMemories();
    const existingIndex = list.findIndex(m => m.key.toLowerCase() === key.toLowerCase());

    const newMemory: StoredMemory = {
      id: `mem-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      key: key.trim(),
      value: value.trim(),
      createdAt: Date.now(),
    };

    if (existingIndex >= 0) {
      list[existingIndex] = newMemory;
    } else {
      list.unshift(newMemory);
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('Failed to save memory to localStorage:', e);
    }

    return newMemory;
  },

  searchMemories(query?: string): StoredMemory[] {
    const list = this.getMemories();
    if (!query || !query.trim()) return list;
    const q = query.toLowerCase();
    return list.filter(m => m.key.toLowerCase().includes(q) || m.value.toLowerCase().includes(q));
  },

  deleteMemory(id: string): boolean {
    const list = this.getMemories().filter(m => m.id !== id);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      return true;
    } catch {
      return false;
    }
  },

  clearAll(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  },
};
