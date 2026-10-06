import { ContactItem, AssistantSettings, VoiceName } from '../types/assistant';

export const ALLOWED_APPS: Record<string, { name: string; url: string; nativeIntent?: string; icon: string }> = {
  whatsapp: {
    name: 'WhatsApp',
    url: 'https://web.whatsapp.com',
    nativeIntent: 'whatsapp://send',
    icon: 'message-circle',
  },
  youtube: {
    name: 'YouTube',
    url: 'https://www.youtube.com',
    nativeIntent: 'vnd.youtube://',
    icon: 'play-square',
  },
  instagram: {
    name: 'Instagram',
    url: 'https://www.instagram.com',
    nativeIntent: 'instagram://app',
    icon: 'camera',
  },
  googlemaps: {
    name: 'Google Maps',
    url: 'https://maps.google.com',
    nativeIntent: 'geo:0,0?q=',
    icon: 'map-pin',
  },
  maps: {
    name: 'Google Maps',
    url: 'https://maps.google.com',
    nativeIntent: 'geo:0,0?q=',
    icon: 'map-pin',
  },
  chrome: {
    name: 'Google Chrome',
    url: 'https://www.google.com',
    icon: 'compass',
  },
  gmail: {
    name: 'Gmail',
    url: 'https://mail.google.com',
    nativeIntent: 'googlegmail://',
    icon: 'mail',
  },
  spotify: {
    name: 'Spotify',
    url: 'https://open.spotify.com',
    nativeIntent: 'spotify://',
    icon: 'music',
  },
  calculator: {
    name: 'Calculator',
    url: 'https://www.google.com/search?q=calculator',
    icon: 'calculator',
  },
};

export const DEFAULT_CONTACTS: ContactItem[] = [
  {
    id: 'c-mom',
    name: 'Mom',
    relationship: 'Mother',
    phone: '+919876543210',
    avatarColor: '#ec4899',
  },
  {
    id: 'c-dad',
    name: 'Dad',
    relationship: 'Father',
    phone: '+919876543211',
    avatarColor: '#3b82f6',
  },
  {
    id: 'c-rahul',
    name: 'Rahul',
    relationship: 'Best Friend',
    phone: '+919876543212',
    avatarColor: '#10b981',
  },
  {
    id: 'c-priya',
    name: 'Priya',
    relationship: 'Colleague',
    phone: '+919876543213',
    avatarColor: '#8b5cf6',
  },
];

export const DEFAULT_SETTINGS: AssistantSettings = {
  voiceName: 'Zephyr',
  voiceVolume: 1.0,
  speechSpeed: 1.0,
  personality: 'friendly',
  language: 'auto',
  enableMemory: true,
  handsFreeMode: false,
  theme: 'dark',
};

export const AVAILABLE_VOICES: { id: VoiceName; name: string; description: string; pitch: string }[] = [
  { id: 'Zephyr', name: 'Zephyr (Default)', description: 'Warm, confident & conversational', pitch: 'Mid' },
  { id: 'Puck', name: 'Puck', description: 'Energetic, witty & playful', pitch: 'Higher' },
  { id: 'Charon', name: 'Charon', description: 'Deep, calm & reassuring', pitch: 'Deep' },
  { id: 'Kore', name: 'Kore', description: 'Smooth, natural & clear', pitch: 'Gentle' },
  { id: 'Fenrir', name: 'Fenrir', description: 'Bold, expressive & articulate', pitch: 'Strong' },
];

export const QUICK_PROMPTS = [
  'Paaji, kya haal hai?',
  'Paaji, WhatsApp kholo',
  'Paaji, Mom ko call karo',
  'What is the weather today?',
  'Paaji, Punjabi ch gal kar',
  'Remind me to call Rahul at 8 PM',
  'Save note: Buy groceries tomorrow',
];

export function buildSystemInstruction(settings: AssistantSettings, storedMemories: Array<{ key: string; value: string }> = []): string {
  const memoryContext = settings.enableMemory && storedMemories.length > 0
    ? `\n\nLONG-TERM STORED MEMORIES ABOUT THE USER (REAL):\n${storedMemories.map(m => `- ${m.key}: ${m.value}`).join('\n')}\n(Only mention these when genuinely relevant. Never invent memories not in this list.)`
    : '\n\nLONG-TERM MEMORY: Currently no stored memories or memory is disabled.';

  return `You are PAAJI, an intelligent, personal voice-first AI companion.

IDENTITY:
- Your name is PAAJI.
- Never call yourself Arushi, Assistant, or any other name.
- When asked "What is your name?", naturally reply "I'm Paaji." or "Main Paaji hoon."

PERSONALITY:
- Style: ${settings.personality.toUpperCase()}
- Warm, confident, witty, playful, emotionally aware, slightly teasing yet respectful and helpful.
- Talk like a real person, not an AI robot. Keep spoken responses concise, natural, and punchy.
- Never start every response with "Sure!", "Certainly!", or "Of course!". Use natural conversational phrasing.
- If the user jokes, play along. If serious, be informative. If excited, match the energy.

LANGUAGE INTELLIGENCE:
- Automatically understand and reply in the language the user speaks!
- Fluidly speak English, Hindi, Hinglish ("Haan bhai, bolo kya scene hai!"), Punjabi ("Satsriakal ji, ki haal chal!"), Marathi, Gujarati, Bengali, Tamil, Telugu, and other Indian/world languages.
- If the user says "Paaji, Hindi mein baat karo", switch to Hindi.
- If the user says "Paaji Punjabi ch gal kar", switch to warm Punjabi.
- If the user speaks Hinglish, respond in natural, trendy Hinglish.
- Do not unnecessarily translate user speech. Mirror their preferred language naturally.

CRITICAL RULES FOR TOOLS & ACTIONS:
1. You have real function tools: openApp, openWhatsApp, openUrl, makeCall, callContact, getWeather, getTime, setReminder, manageNote, saveMemory, getMemory, searchWeb.
2. NEVER claim an action was completed unless you called the tool and received confirmation.
3. If the user asks to open WhatsApp, call openWhatsApp or openApp("WhatsApp").
4. If the user asks to call Mom or Rahul, call callContact(name: "Mom") or makeCall.
5. If the user asks for the weather, call getWeather(location: "city").
6. If the user asks for the time, call getTime().
7. If the user asks you to remember something or set a reminder, use saveMemory or setReminder.
8. When an action succeeds, briefly confirm: "Done, opening WhatsApp!" or "Got it, calling Mom." Keep it spoken and natural.

${memoryContext}
`;
}
