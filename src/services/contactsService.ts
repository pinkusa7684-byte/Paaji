import { ContactItem } from '../types/assistant';
import { DEFAULT_CONTACTS } from '../config/constants';

const STORAGE_KEY = 'paaji_contacts_v1';

export const contactsService = {
  getContacts(): ContactItem[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_CONTACTS));
        return DEFAULT_CONTACTS;
      }
      return JSON.parse(data) as ContactItem[];
    } catch {
      return DEFAULT_CONTACTS;
    }
  },

  saveContacts(contacts: ContactItem[]) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(contacts));
    } catch (e) {
      console.warn('Failed to save contacts:', e);
    }
  },

  addContact(contact: Omit<ContactItem, 'id'>): ContactItem {
    const list = this.getContacts();
    const newContact: ContactItem = {
      ...contact,
      id: `c-${Date.now()}`,
      avatarColor: contact.avatarColor || '#' + Math.floor(Math.random() * 16777215).toString(16),
    };
    list.push(newContact);
    this.saveContacts(list);
    return newContact;
  },

  deleteContact(id: string) {
    const list = this.getContacts().filter(c => c.id !== id);
    this.saveContacts(list);
  },

  findContact(query: string): { matches: ContactItem[]; exactMatch?: ContactItem } {
    const list = this.getContacts();
    const clean = query.trim().toLowerCase();

    // Look for exact matches first
    const exact = list.find(c => c.name.toLowerCase() === clean || c.relationship?.toLowerCase() === clean);
    if (exact) {
      return { matches: [exact], exactMatch: exact };
    }

    // Look for partial matches
    const matches = list.filter(c =>
      c.name.toLowerCase().includes(clean) ||
      (c.relationship && c.relationship.toLowerCase().includes(clean))
    );

    if (matches.length === 1) {
      return { matches, exactMatch: matches[0] };
    }

    return { matches };
  },

  initiateCall(phoneNumber: string): { success: boolean; url: string } {
    const cleaned = phoneNumber.replace(/[^\d+]/g, '');
    const telUrl = `tel:${cleaned}`;

    // Safely trigger phone dialer
    try {
      const a = document.createElement('a');
      a.href = telUrl;
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return { success: true, url: telUrl };
    } catch {
      window.location.href = telUrl;
      return { success: true, url: telUrl };
    }
  },
};
