import { NoteItem } from '../types/assistant';

const STORAGE_KEY = 'paaji_notes_v1';

export const notesService = {
  getNotes(): NoteItem[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return [];
      return JSON.parse(data) as NoteItem[];
    } catch {
      return [];
    }
  },

  saveNotes(notes: NoteItem[]) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    } catch (e) {
      console.warn('Failed to save notes:', e);
    }
  },

  createNote(title: string, content: string): NoteItem {
    const notes = this.getNotes();
    const newNote: NoteItem = {
      id: `note-${Date.now()}`,
      title: title.trim() || 'Untitled Note',
      content: content.trim(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    notes.unshift(newNote);
    this.saveNotes(notes);
    return newNote;
  },

  searchNotes(query?: string): NoteItem[] {
    const notes = this.getNotes();
    if (!query || !query.trim()) return notes;
    const q = query.toLowerCase();
    return notes.filter(n => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q));
  },

  deleteNote(id: string) {
    const list = this.getNotes().filter(n => n.id !== id);
    this.saveNotes(list);
  },
};
