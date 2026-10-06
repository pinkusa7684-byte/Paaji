/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  AssistantState,
  MessageItem,
  AssistantSettings,
  ToolExecutionResult,
  DebugMetrics,
} from './types/assistant';
import { DEFAULT_SETTINGS, QUICK_PROMPTS } from './config/constants';
import { LiveAssistantClient } from './services/liveClient';
import { AssistantOrb } from './components/AssistantOrb';
import { AudioVisualizer } from './components/AudioVisualizer';
import { TranscriptView } from './components/TranscriptView';
import { ActionCard } from './components/ActionCard';
import { SettingsModal } from './components/SettingsModal';
import { DebugHud } from './components/DebugHud';
import { FirstUseModal } from './components/FirstUseModal';
import {
  Mic,
  MicOff,
  Square,
  Settings,
  Activity,
  Send,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';

export default function App() {
  const [state, setState] = useState<AssistantState>('IDLE');
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [settings, setSettings] = useState<AssistantSettings>(() => {
    try {
      const saved = localStorage.getItem('paaji_settings_v1');
      return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const [micLevel, setMicLevel] = useState<number>(0);
  const [speakerLevel, setSpeakerLevel] = useState<number>(0);
  const [latestAction, setLatestAction] = useState<ToolExecutionResult | null>(null);
  const [isTranscriptOpen, setIsTranscriptOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isDebugOpen, setIsDebugOpen] = useState<boolean>(false);
  const [isFirstUseOpen, setIsFirstUseOpen] = useState<boolean>(() => {
    return !localStorage.getItem('paaji_onboarded_v1');
  });

  const [textInput, setTextInput] = useState('');
  const [debugMetrics, setDebugMetrics] = useState<DebugMetrics>({
    connectionStatus: 'disconnected',
    audioContextState: 'suspended',
    sampleRateInput: 16000,
    sampleRateOutput: 24000,
    micActive: false,
    inputChunksSent: 0,
    outputChunksReceived: 0,
    audioQueueLength: 0,
    activeSourcesCount: 0,
  });

  const clientRef = useRef<LiveAssistantClient | null>(null);

  // Initialize client
  useEffect(() => {
    const client = new LiveAssistantClient(settings, {
      onStateChange: (newState) => {
        setState(newState);
        setDebugMetrics((prev) => ({
          ...prev,
          micActive: client.isRecording(),
          connectionStatus: newState === 'ERROR' ? 'error' : (newState === 'CONNECTING' ? 'connecting' : 'connected'),
        }));
      },
      onTranscript: (sender, text, isFinal) => {
        setMessages((prev) => {
          // If the last message is from the same sender and was partial, update it
          if (prev.length > 0 && prev[prev.length - 1].sender === sender && !isFinal) {
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              text: updated[updated.length - 1].text + ' ' + text,
            };
            return updated;
          }

          return [
            ...prev,
            {
              id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              sender,
              text,
              timestamp: Date.now(),
            },
          ];
        });
      },
      onToolAction: (result) => {
        setLatestAction(result);
        // Add tool log to messages
        setMessages((prev) => [
          ...prev,
          {
            id: `tool-${Date.now()}`,
            sender: 'system',
            text: `[${result.toolName}] ${result.message}`,
            timestamp: Date.now(),
            toolCall: {
              name: result.toolName,
              args: {},
              status: result.success ? 'completed' : 'failed',
              resultSummary: result.message,
            },
          },
        ]);
      },
      onError: (err) => {
        setDebugMetrics((prev) => ({ ...prev, lastError: err }));
      },
      onDebugUpdate: (stats) => {
        setDebugMetrics((prev) => ({
          ...prev,
          inputChunksSent: stats.inputChunksSent,
          outputChunksReceived: stats.outputChunksReceived,
          audioQueueLength: stats.queueLength,
          activeSourcesCount: stats.activeSources,
          lastLatencyMs: stats.lastLatencyMs,
          lastToolName: stats.lastTool,
        }));
      },
      onMicLevel: (lvl) => setMicLevel(lvl),
      onSpeakerLevel: (lvl) => setSpeakerLevel(lvl),
    });

    clientRef.current = client;

    // Pre-warm real-time Live connection so first user interaction has zero connection delay
    client.connect();

    return () => {
      client.disconnect();
    };
  }, []);

  // Sync settings updates
  const handleUpdateSettings = useCallback((newSettings: AssistantSettings) => {
    setSettings(newSettings);
    localStorage.setItem('paaji_settings_v1', JSON.stringify(newSettings));
    clientRef.current?.updateSettings(newSettings);
  }, []);

  // Toggle voice session with instant first greeting
  const handleToggleVoice = async () => {
    if (!clientRef.current) return;

    if (state === 'LISTENING') {
      clientRef.current.stopVoiceSession();
    } else {
      await clientRef.current.startVoiceSession(true);
    }
  };

  // Barge-in / Stop button
  const handleInterrupt = () => {
    clientRef.current?.interrupt();
  };

  // Text message submission
  const handleSendText = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!textInput.trim() || !clientRef.current) return;

    const query = textInput.trim();
    setTextInput('');
    await clientRef.current.sendTextMessage(query);
  };

  const handleQuickPrompt = async (prompt: string) => {
    if (!clientRef.current) return;
    await clientRef.current.sendTextMessage(prompt);
  };

  const handleFirstUseStart = async () => {
    localStorage.setItem('paaji_onboarded_v1', 'true');
    setIsFirstUseOpen(false);
    // Instant greeting & voice with zero delay
    await clientRef.current?.startVoiceSession(true);
  };

  const getStatusText = () => {
    switch (state) {
      case 'CONNECTING':
        return 'Connecting to Gemini Live...';
      case 'LISTENING':
        return 'Listening to you...';
      case 'THINKING':
        return 'Paaji is thinking...';
      case 'SPEAKING':
        return 'Paaji speaking (Tap Stop to interrupt)';
      case 'EXECUTING':
        return 'Executing device action...';
      case 'ERROR':
        return 'Connection issue. Tap to reconnect.';
      default:
        return 'Tap microphone or orb to talk';
    }
  };

  return (
    <div className="relative min-h-screen bg-neutral-950 text-white flex flex-col justify-between selection:bg-amber-500 selection:text-black overflow-x-hidden">
      {/* Background ambient lighting */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-tr from-amber-600/15 via-orange-600/10 to-indigo-600/15 rounded-full blur-3xl opacity-70" />
        <div className="absolute bottom-10 left-1/3 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl" />
      </div>

      {/* Top Header Bar */}
      <header className="relative z-20 flex items-center justify-between px-4 sm:px-8 py-4 border-b border-white/5 backdrop-blur-md bg-neutral-950/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Sparkles className="w-5 h-5 text-black" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black tracking-wider text-white">PAAJI</h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-widest">
                AI Companion
              </span>
            </div>
            <p className="text-xs text-white/50">Gemini Live Real-Time Voice</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Debug / Diagnostic Button */}
          <button
            onClick={() => setIsDebugOpen((prev) => !prev)}
            className={`p-2.5 rounded-2xl border transition-colors cursor-pointer ${
              isDebugOpen
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'
            }`}
            title="Audio & Real-time Diagnostics"
            aria-label="Toggle diagnostics"
          >
            <Activity className="w-4 h-4" />
          </button>

          {/* Settings Button */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
            title="Assistant Settings"
            aria-label="Open settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Voice Assistant Area */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-6 max-w-2xl mx-auto w-full">
        {/* State Banner */}
        <div className="mb-4 text-center">
          <p className="text-xs sm:text-sm font-medium tracking-wide text-white/70 transition-all duration-200">
            {getStatusText()}
          </p>
        </div>

        {/* Central Assistant Orb */}
        <div className="my-2 relative flex flex-col items-center justify-center">
          <AssistantOrb
            state={state}
            audioLevel={state === 'SPEAKING' ? speakerLevel : micLevel}
            onClick={handleToggleVoice}
          />
        </div>

        {/* Audio Visualizer Wave */}
        <div className="my-3">
          <AudioVisualizer
            micLevel={micLevel}
            speakerLevel={speakerLevel}
            isListening={state === 'LISTENING'}
            isSpeaking={state === 'SPEAKING'}
          />
        </div>

        {/* Action feedback card if any device action triggered */}
        <ActionCard
          action={latestAction}
          onDismiss={() => setLatestAction(null)}
        />

        {/* Quick prompt suggestions */}
        <div className="w-full mt-4 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none justify-start sm:justify-center">
          {QUICK_PROMPTS.slice(0, 4).map((qp, i) => (
            <button
              key={i}
              onClick={() => handleQuickPrompt(qp)}
              className="text-xs px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-white/80 hover:text-white whitespace-nowrap transition-colors cursor-pointer"
            >
              {qp}
            </button>
          ))}
        </div>

        {/* Transcript Area */}
        <div className="w-full mt-4">
          <TranscriptView
            messages={messages}
            onClear={() => setMessages([])}
            isOpen={isTranscriptOpen}
            onToggle={() => setIsTranscriptOpen((prev) => !prev)}
          />
        </div>
      </main>

      {/* Bottom Voice & Text Control Bar */}
      <footer className="relative z-20 px-4 sm:px-8 py-5 border-t border-white/10 backdrop-blur-xl bg-neutral-950/80">
        <div className="max-w-xl mx-auto flex flex-col items-center gap-4">
          {/* Main Primary Control Buttons */}
          <div className="flex items-center gap-4">
            {/* If Paaji is speaking -> Show Interruption / Barge-in Stop Button */}
            {state === 'SPEAKING' && (
              <button
                onClick={handleInterrupt}
                className="flex items-center gap-2 px-5 py-3 rounded-full bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 font-semibold text-xs transition-all active:scale-95 cursor-pointer shadow-lg animate-pulse"
                title="Stop speaking"
              >
                <Square className="w-4 h-4 fill-current" />
                <span>Stop Paaji</span>
              </button>
            )}

            {/* Primary Big Tactile Microphone Button */}
            <button
              onClick={handleToggleVoice}
              className={`relative flex items-center justify-center w-16 h-16 rounded-full transition-all duration-300 active:scale-90 cursor-pointer shadow-2xl ${
                state === 'LISTENING'
                  ? 'bg-emerald-500 text-black shadow-emerald-500/50 scale-105'
                  : state === 'CONNECTING' || state === 'THINKING'
                  ? 'bg-amber-500 text-black shadow-amber-500/40 animate-pulse'
                  : 'bg-gradient-to-tr from-amber-500 via-orange-500 to-amber-600 text-black shadow-amber-500/30 hover:scale-105'
              }`}
              aria-label={state === 'LISTENING' ? 'Mute microphone' : 'Start speaking with Paaji'}
            >
              {/* Outer pulsing ring while listening */}
              {state === 'LISTENING' && (
                <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-30 pointer-events-none" />
              )}
              {state === 'LISTENING' ? (
                <MicOff className="w-7 h-7" />
              ) : (
                <Mic className="w-7 h-7" />
              )}
            </button>
          </div>

          {/* Quick Fallback Text Input Field */}
          <form
            onSubmit={handleSendText}
            className="w-full flex items-center gap-2 bg-neutral-900 border border-white/10 rounded-2xl px-3 py-2 shadow-inner focus-within:border-amber-400/50 transition-colors"
          >
            <input
              type="text"
              placeholder="Or type a message to Paaji (he responds in voice)..."
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              className="flex-1 bg-transparent text-xs sm:text-sm text-white placeholder-white/40 focus:outline-none px-2"
            />
            <button
              type="submit"
              disabled={!textInput.trim()}
              className="p-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black disabled:opacity-30 disabled:hover:bg-amber-500 transition-colors cursor-pointer"
              aria-label="Send message"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </footer>

      {/* Modals & Diagnostic Drawers */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onClearConversation={() => setMessages([])}
      />

      <DebugHud
        metrics={debugMetrics}
        isOpen={isDebugOpen}
        onClose={() => setIsDebugOpen(false)}
      />

      <FirstUseModal
        isOpen={isFirstUseOpen}
        onStart={handleFirstUseStart}
      />
    </div>
  );
}
