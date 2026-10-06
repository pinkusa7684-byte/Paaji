import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Modality, Type, FunctionDeclaration, LiveServerMessage } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '10mb' }));

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: '/live' });

// Shared Gemini client with telemetry header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Function Declarations for Gemini Live and Chat
const liveTools: FunctionDeclaration[] = [
  {
    name: 'openApp',
    description: 'Open an installed or allowed application on the user device like WhatsApp, YouTube, Instagram, Google Maps, Chrome, Gmail, Spotify, Calculator.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        appName: {
          type: Type.STRING,
          description: 'Name of the app to open (e.g., WhatsApp, YouTube, Google Maps, Instagram, Spotify, Chrome)',
        },
      },
      required: ['appName'],
    },
  },
  {
    name: 'openWhatsApp',
    description: 'Directly open WhatsApp messenger to send a message or start a chat.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        message: { type: Type.STRING, description: 'Optional prefilled message text' },
        phone: { type: Type.STRING, description: 'Optional recipient phone number' },
      },
    },
  },
  {
    name: 'openUrl',
    description: 'Open a safe web URL starting with https:// in the browser.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        url: { type: Type.STRING, description: 'Web URL starting with https://' },
      },
      required: ['url'],
    },
  },
  {
    name: 'makeCall',
    description: 'Initiate a phone call to a given phone number using the device dialer.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        phoneNumber: { type: Type.STRING, description: 'Phone number to dial' },
        contactName: { type: Type.STRING, description: 'Name of the contact if known' },
      },
      required: ['phoneNumber'],
    },
  },
  {
    name: 'callContact',
    description: 'Look up a contact by name (like Mom, Dad, Rahul, Priya) in address book and call them.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: 'Name of the contact to call (e.g. Mom, Rahul)' },
      },
      required: ['name'],
    },
  },
  {
    name: 'getWeather',
    description: 'Get real-time live current weather and temperature for any city or location.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        location: { type: Type.STRING, description: 'City or location name, e.g. Delhi, Mumbai, New York' },
      },
      required: ['location'],
    },
  },
  {
    name: 'getTime',
    description: 'Get current real local time, date, day of week, and timezone.',
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: 'setReminder',
    description: 'Set a real reminder with task description and time.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        task: { type: Type.STRING, description: 'Task or reminder text' },
        timeString: { type: Type.STRING, description: 'When to remind (e.g., in 10 minutes, 8 PM, tomorrow morning)' },
      },
      required: ['task'],
    },
  },
  {
    name: 'manageNote',
    description: 'Save or retrieve personal notes for the user.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        action: { type: Type.STRING, description: 'create, read, list, or delete' },
        title: { type: Type.STRING, description: 'Title of the note' },
        content: { type: Type.STRING, description: 'Note content' },
      },
      required: ['action'],
    },
  },
  {
    name: 'saveMemory',
    description: 'Store a personal fact or preference about the user into long-term memory.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        key: { type: Type.STRING, description: 'Fact topic or identifier' },
        value: { type: Type.STRING, description: 'Fact content to remember' },
      },
      required: ['key', 'value'],
    },
  },
  {
    name: 'getMemory',
    description: 'Retrieve remembered facts about the user.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: 'Memory query' },
      },
    },
  },
  {
    name: 'searchWeb',
    description: 'Search live information, current facts, or answers from the web.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: 'Search query' },
      },
      required: ['query'],
    },
  },
];

function getSystemInstruction(settings: { personality?: string }, memories: Array<{ key: string; value: string }> = []): string {
  const memoryText = memories.length > 0
    ? `\n\nREAL STORED USER MEMORIES:\n${memories.map(m => `- ${m.key}: ${m.value}`).join('\n')}`
    : '\n\nNo stored user memories currently.';

  return `You are PAAJI, a world-class personal voice AI companion.
- Your name is always PAAJI. Never call yourself Arushi or generic assistant.
- Personality: Warm, confident, witty, playful, helpful, emotionally intelligent, brotherly Indian vibe.
- FIRST REPLY & INSTANT SPEED: Respond immediately, enthusiastically, and naturally with zero latency. Keep normal spoken replies snappy (1-2 short sentences maximum), crisp, conversational, and energetic.
- Talk like a real conversational friend. Spoken responses must be concise, natural, and never robotic.
- Avoid starting every response with "Sure!", "Of course!", or "Certainly!".
- MULTILINGUAL INTELLIGENCE: Naturally detect and speak whatever language the user uses! Fluently speak English, Hindi, Hinglish ("Yo! Bolo paaji kya scene hai"), Punjabi ("Satsriakal ji, ki haal chal!"), Marathi, Gujarati, etc.
- If user says "Paaji, Hindi mein baat karo", speak Hindi.
- If user says "Paaji Punjabi ch gal kar", speak Punjabi.
- REAL TOOLS: You have real tools for openApp, openWhatsApp, openUrl, makeCall, callContact, getWeather, getTime, setReminder, manageNote, saveMemory, getMemory, searchWeb.
- Call the tool first. NEVER claim you did an action (like calling Mom or opening WhatsApp) unless the tool was executed!
- Once tool executes, confirm concisely: "Done, opening WhatsApp!", "Got it, calling Mom."
${memoryText}`;
}

// WebSocket Live Handler
wss.on('connection', (clientWs: WebSocket) => {
  console.log('[WSS] Client connected to /live');

  let liveSession: any = null;
  let isSessionReady = false;
  const pendingToolCalls = new Map<string, string>();

  const initLiveSession = async (initPayload: any) => {
    try {
      const voiceName = initPayload?.settings?.voiceName || 'Zephyr';
      const systemInstruction = getSystemInstruction(
        initPayload?.settings || {},
        initPayload?.memories || []
      );

      console.log(`[WSS] Initializing Gemini Live with voice: ${voiceName}`);

      liveSession = await ai.live.connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
          systemInstruction,
          tools: [{ functionDeclarations: liveTools }],
        },
        callbacks: {
          onmessage: (msg: LiveServerMessage) => {
            if (clientWs.readyState !== WebSocket.OPEN) return;

            // Audio chunks from model (24kHz PCM L16)
            const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData) {
              clientWs.send(JSON.stringify({ type: 'audio', data: audioData }));
            }

            // Transcript text
            const textPart = msg.serverContent?.modelTurn?.parts?.[0]?.text;
            if (textPart) {
              clientWs.send(JSON.stringify({ type: 'transcript', role: 'model', text: textPart }));
            }

            // Tool call request from model
            const toolCalls = msg.toolCall?.functionCalls;
            if (toolCalls && toolCalls.length > 0) {
              for (const call of toolCalls) {
                if (call.id) {
                  pendingToolCalls.set(call.id, call.name || 'tool');
                }
                clientWs.send(JSON.stringify({
                  type: 'tool_call',
                  id: call.id || `call-${Date.now()}`,
                  name: call.name || 'tool',
                  args: call.args || {},
                }));
              }
            }

            // Interruption signal (user barged in)
            if (msg.serverContent?.interrupted) {
              clientWs.send(JSON.stringify({ type: 'interrupted' }));
            }

            // Turn complete
            if (msg.serverContent?.turnComplete) {
              clientWs.send(JSON.stringify({ type: 'turn_complete' }));
            }
          },
          onclose: () => {
            console.log('[LiveSession] Gemini Live session closed');
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: 'status', status: 'closed' }));
            }
          },
          onerror: (err: any) => {
            console.error('[LiveSession] Gemini Live error:', err);
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({
                type: 'status',
                status: 'error',
                message: err?.message || 'Gemini Live encountered an error',
              }));
            }
          },
        },
      });

      isSessionReady = true;
      clientWs.send(JSON.stringify({ type: 'status', status: 'ready' }));
    } catch (err: any) {
      console.error('[WSS] Failed to connect to Gemini Live:', err);
      clientWs.send(JSON.stringify({
        type: 'status',
        status: 'error',
        message: err?.message || 'Unable to connect to Gemini Live session.',
      }));
    }
  };

  clientWs.on('message', async (data: Buffer | string) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.type === 'init') {
        await initLiveSession(msg);
        return;
      }

      if (msg.type === 'ping') {
        clientWs.send(JSON.stringify({ type: 'pong' }));
        return;
      }

      if (!liveSession || !isSessionReady) {
        return;
      }

      if (msg.type === 'audio' && msg.data) {
        liveSession.sendRealtimeInput({
          audio: {
            data: msg.data,
            mimeType: 'audio/pcm;rate=16000',
          },
        });
      } else if (msg.type === 'text' && msg.text) {
        liveSession.sendRealtimeInput({
          text: msg.text,
        });
      } else if (msg.type === 'wake') {
        console.log('[WSS] Client wake greeting requested');
        liveSession.sendRealtimeInput({
          text: "Say a short natural friendly opening greeting as Paaji (e.g. 'Yo! Paaji here. Batao, kya scene hai? 😄' or 'Hey! Paaji here, what's up?'). 1 short sentence only.",
        });
      } else if (msg.type === 'interrupt') {
        // Interruption requested by client
        console.log('[WSS] Client interrupt signal received');
      } else if (msg.type === 'tool_response') {
        const toolName = msg.name || pendingToolCalls.get(msg.id) || 'tool';
        const rawOutput = msg.response?.output ?? msg.response ?? 'Action executed successfully';
        const outputObject = typeof rawOutput === 'object' && rawOutput !== null
          ? rawOutput
          : { output: String(rawOutput) };

        console.log(`[WSS] Sending tool response for tool '${toolName}', id: '${msg.id}'`);
        liveSession.sendToolResponse({
          functionResponses: [
            {
              id: msg.id,
              name: toolName,
              response: outputObject,
            },
          ],
        });
      }
    } catch (err) {
      console.error('[WSS] Message handling error:', err);
    }
  });

  clientWs.on('close', () => {
    console.log('[WSS] Client disconnected');
    if (liveSession) {
      try {
        liveSession.close();
      } catch {}
      liveSession = null;
    }
  });
});

// Health check API
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: !!process.env.GEMINI_API_KEY,
    time: new Date().toISOString(),
  });
});

// Fallback Voice & Chat API:
// When WebSocket is not optimal or for instant prompt tests,
// returns real Gemini voice speech using `gemini-3.8-flash-lite-tts`
app.post('/api/chat', async (req, res) => {
  try {
    const { prompt, voiceName = 'Zephyr', history = [] } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const systemInstruction = getSystemInstruction({});

    // Generate intelligent response with Gemini Flash
    const textRes = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction,
        tools: [{ functionDeclarations: liveTools }],
      },
    });

    const replyText = textRes.text || 'Bas badhiya!';

    // Generate real speech audio with fallback between tts models
    let wavBase64: string | null = null;
    try {
      const ttsRes = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [{ text: replyText }],
          },
        ],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      });
      wavBase64 = ttsRes.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
    } catch (ttsErr: any) {
      console.warn('[TTS] gemini-3.8-flash-lite-tts unavailable, attempting gemini-3.8-flash-tts:', ttsErr?.message);
      try {
        const ttsRes = await ai.models.generateContent({
          model: 'gemini-3.8-flash-tts',
          contents: [
            {
              role: 'user',
              parts: [{ text: replyText }],
            },
          ],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName },
              },
            },
          },
        });
        wavBase64 = ttsRes.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
      } catch (backupErr: any) {
        console.warn('[TTS] Backup TTS model also unavailable:', backupErr?.message);
      }
    }

    res.json({
      text: replyText,
      audioBase64: wavBase64 || null,
      mimeType: 'audio/wav',
      functionCalls: textRes.functionCalls || [],
    });
  } catch (err: any) {
    console.error('Chat error:', err);
    res.status(500).json({ error: err?.message || 'Chat generation failed' });
  }
});

// Mount Vite in development or serve static in production
const isProduction = process.env.NODE_ENV === 'production';
if (!isProduction) {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.resolve(__dirname, 'dist')));
  app.get('*', (_req, res) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
}

const PORT = Number(process.env.PORT) || 3000;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`[PAAJI] Server running on http://0.0.0.0:${PORT}`);
});
