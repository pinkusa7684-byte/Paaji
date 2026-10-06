export type AssistantState =
  | 'IDLE'
  | 'CONNECTING'
  | 'LISTENING'
  | 'THINKING'
  | 'SPEAKING'
  | 'EXECUTING'
  | 'ERROR';

export type VoiceName = 'Zephyr' | 'Puck' | 'Charon' | 'Kore' | 'Fenrir';

export type PersonalityMode = 'friendly' | 'playful' | 'professional' | 'casual';

export type LanguagePreference = 'auto' | 'en' | 'hi' | 'pa' | 'hinglish';

export interface MessageItem {
  id: string;
  sender: 'user' | 'paaji' | 'system';
  text: string;
  timestamp: number;
  toolCall?: {
    name: string;
    args: Record<string, unknown>;
    status?: 'executing' | 'completed' | 'failed';
    resultSummary?: string;
  };
}

export interface StoredMemory {
  id: string;
  key: string;
  value: string;
  createdAt: number;
}

export interface ContactItem {
  id: string;
  name: string;
  relationship?: string;
  phone: string;
  avatarColor?: string;
}

export interface ReminderItem {
  id: string;
  task: string;
  targetTime: number; // Unix timestamp
  targetTimeString: string;
  createdAt: number;
  completed: boolean;
}

export interface NoteItem {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface AssistantSettings {
  voiceName: VoiceName;
  voiceVolume: number; // 0 to 1
  speechSpeed: number; // 0.75 to 1.5
  personality: PersonalityMode;
  language: LanguagePreference;
  enableMemory: boolean;
  handsFreeMode: boolean; // Continuous listening
  theme: 'dark' | 'light' | 'system';
}

export interface DebugMetrics {
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  audioContextState: string;
  sampleRateInput: number;
  sampleRateOutput: number;
  micActive: boolean;
  inputChunksSent: number;
  outputChunksReceived: number;
  audioQueueLength: number;
  activeSourcesCount: number;
  lastLatencyMs?: number;
  lastToolName?: string;
  lastError?: string;
}

export interface ToolExecutionResult {
  success: boolean;
  toolName: string;
  message: string;
  data?: unknown;
  actionDetails?: {
    type: 'openApp' | 'call' | 'url' | 'reminder' | 'note' | 'weather' | 'search' | 'memory' | 'time';
    label: string;
    target?: string;
  };
}
