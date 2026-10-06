import { ReminderItem } from '../types/assistant';

const STORAGE_KEY = 'paaji_reminders_v1';

export const remindersService = {
  getReminders(): ReminderItem[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return [];
      return JSON.parse(data) as ReminderItem[];
    } catch {
      return [];
    }
  },

  saveReminders(reminders: ReminderItem[]) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
    } catch (e) {
      console.warn('Failed to save reminders:', e);
    }
  },

  parseTimeString(timeStr?: string): { timestamp: number; display: string } {
    const now = Date.now();
    if (!timeStr) {
      // Default to 1 hour from now
      return {
        timestamp: now + 3600 * 1000,
        display: 'in 1 hour',
      };
    }

    const lower = timeStr.toLowerCase().trim();

    // "in X minutes" / "in X mins"
    const minMatch = lower.match(/in\s+(\d+)\s*(min|minute)/);
    if (minMatch) {
      const mins = parseInt(minMatch[1], 10);
      const target = now + mins * 60 * 1000;
      return { timestamp: target, display: `in ${mins} minute${mins > 1 ? 's' : ''}` };
    }

    // "in X hours" / "in X hr"
    const hrMatch = lower.match(/in\s+(\d+)\s*(hour|hr)/);
    if (hrMatch) {
      const hrs = parseInt(hrMatch[1], 10);
      const target = now + hrs * 3600 * 1000;
      return { timestamp: target, display: `in ${hrs} hour${hrs > 1 ? 's' : ''}` };
    }

    // Time like "8 pm", "8:30 am", "20:00"
    const timeMatch = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1], 10);
      const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      const meridiem = timeMatch[3];

      if (meridiem === 'pm' && hours < 12) hours += 12;
      if (meridiem === 'am' && hours === 12) hours = 0;

      const d = new Date();
      if (lower.includes('tomorrow') || lower.includes('kal')) {
        d.setDate(d.getDate() + 1);
      }
      d.setHours(hours, minutes, 0, 0);

      // If time has already passed today and no date specified, schedule for tomorrow
      if (d.getTime() <= now && !lower.includes('tomorrow') && !lower.includes('kal')) {
        d.setDate(d.getDate() + 1);
      }

      return {
        timestamp: d.getTime(),
        display: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + (d.getDate() !== new Date().getDate() ? ' tomorrow' : ' today'),
      };
    }

    return {
      timestamp: now + 3600 * 1000,
      display: timeStr,
    };
  },

  createReminder(task: string, timeString?: string): ReminderItem {
    const { timestamp, display } = this.parseTimeString(timeString);
    const reminders = this.getReminders();
    const newReminder: ReminderItem = {
      id: `rem-${Date.now()}`,
      task: task.trim(),
      targetTime: timestamp,
      targetTimeString: display,
      createdAt: Date.now(),
      completed: false,
    };

    reminders.unshift(newReminder);
    this.saveReminders(reminders);

    // Request Notification permission if possible
    if ('Notification' in window && Notification.permission === 'default') {
      try {
        Notification.requestPermission();
      } catch {}
    }

    return newReminder;
  },

  completeReminder(id: string) {
    const list = this.getReminders().map(r => r.id === id ? { ...r, completed: true } : r);
    this.saveReminders(list);
  },

  deleteReminder(id: string) {
    const list = this.getReminders().filter(r => r.id !== id);
    this.saveReminders(list);
  },
};
