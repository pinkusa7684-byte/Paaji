/**
 * Live Assistant Client:
 * Manages WebSocket connection to Gemini Live via server.ts and handles audio streaming,
 * interruption, transcription, and tool execution.
 */
import { AssistantState, AssistantSettings, ToolExecutionResult } from '../types/assistant';
import { AudioPlaybackQueue } from '../audio/audioPlayer';
import { AudioRecorder } from '../audio/audioRecorder';
import { playWakeChime } from '../audio/audioContext';
import { executeTool } from './toolHandler';
import { memoryService } from './memoryService';

export interface LiveClientCallbacks {
  onStateChange: (state: AssistantState) => void;
  onTranscript: (sender: 'user' | 'paaji', text: string, isFinal?: boolean) => void;
  onToolAction: (result: ToolExecutionResult) => void;
  onError: (error: string) => void;
  onDebugUpdate: (stats: {
    inputChunksSent: number;
    outputChunksReceived: number;
    queueLength: number;
    activeSources: number;
    lastLatencyMs?: number;
    lastTool?: string;
  }) => void;
  onMicLevel: (level: number) => void;
  onSpeakerLevel: (level: number) => void;
}

export class LiveAssistantClient {
  private ws: WebSocket | null = null;
  private playbackQueue: AudioPlaybackQueue;
  private recorder: AudioRecorder;
  private callbacks: LiveClientCallbacks;
  private state: AssistantState = 'IDLE';
  private settings: AssistantSettings;

  private inputChunksSent = 0;
  private outputChunksReceived = 0;
  private lastPingTime = 0;
  private lastLatencyMs = 0;
  private isConnecting = false;
  private manualStop = false;

  constructor(settings: AssistantSettings, callbacks: LiveClientCallbacks) {
    this.settings = settings;
    this.callbacks = callbacks;

    this.playbackQueue = new AudioPlaybackQueue({
      onPlaybackStateChange: (playing) => {
        if (playing) {
          this.setState('SPEAKING');
        } else if (this.state === 'SPEAKING') {
          // Finished speaking
          if (this.recorder.getIsRecording()) {
            this.setState('LISTENING');
          } else {
            this.setState('IDLE');
          }
        }
      },
      onLevelMeter: (level) => {
        this.callbacks.onSpeakerLevel(level);
      },
    });

    this.recorder = new AudioRecorder({
      onAudioChunk: (base64) => {
        this.sendAudioChunk(base64);
      },
      onLevelMeter: (level) => {
        this.callbacks.onMicLevel(level);
        // User is speaking while Paaji is speaking -> Client-side barge-in detection
        if (level > 0.3 && this.playbackQueue.getActiveSourcesCount() > 0) {
          this.playbackQueue.interrupt();
          this.sendInterruptSignal();
        }
      },
      onError: (err) => {
        this.callbacks.onError(err);
        this.setState('ERROR');
      },
    });
  }

  public updateSettings(newSettings: AssistantSettings) {
    this.settings = newSettings;
  }

  public getState(): AssistantState {
    return this.state;
  }

  private setState(newState: AssistantState) {
    if (this.state !== newState) {
      this.state = newState;
      this.callbacks.onStateChange(newState);
    }
  }

  public async connect(): Promise<boolean> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return true;
    }

    this.manualStop = false;
    this.isConnecting = true;
    this.setState('CONNECTING');

    return new Promise((resolve) => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/live`;

        console.log('[LiveClient] Connecting to:', wsUrl);
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('[LiveClient] WebSocket opened');
          this.isConnecting = false;

          // Send initialization config
          const storedMems = this.settings.enableMemory ? memoryService.getMemories() : [];
          this.ws?.send(JSON.stringify({
            type: 'init',
            settings: this.settings,
            memories: storedMems.map(m => ({ key: m.key, value: m.value })),
          }));

          this.setState('IDLE');
          resolve(true);
        };

        this.ws.onmessage = async (event) => {
          this.handleServerMessage(event.data);
        };

        this.ws.onerror = (err) => {
          console.warn('[LiveClient] WebSocket error:', err);
          if (this.isConnecting) {
            this.isConnecting = false;
            this.setState('ERROR');
            this.callbacks.onError('Could not establish real-time connection. Please check your network and Gemini API key.');
            resolve(false);
          }
        };

        this.ws.onclose = () => {
          console.log('[LiveClient] WebSocket closed');
          this.isConnecting = false;
          if (!this.manualStop && this.state !== 'ERROR') {
            this.setState('IDLE');
          }
        };
      } catch (err) {
        console.error('[LiveClient] Connection failed:', err);
        this.isConnecting = false;
        this.setState('ERROR');
        resolve(false);
      }
    });
  }

  private async handleServerMessage(data: string | Blob) {
    try {
      const msg = typeof data === 'string' ? JSON.parse(data) : JSON.parse(await (data as Blob).text());

      if (msg.type === 'pong') {
        if (this.lastPingTime > 0) {
          this.lastLatencyMs = Date.now() - this.lastPingTime;
        }
        return;
      }

      if (msg.type === 'status') {
        if (msg.status === 'ready') {
          console.log('[LiveClient] Gemini Live session is ready');
        } else if (msg.status === 'error') {
          this.setState('ERROR');
          this.callbacks.onError(msg.message || 'Live session error');
        }
        return;
      }

      // Real-time Audio chunk from Gemini Live
      if (msg.type === 'audio' && msg.data) {
        this.outputChunksReceived++;
        // If we were THINKING or LISTENING, we are now getting voice response
        this.playbackQueue.enqueuePcmChunk(msg.data, 24000);
        this.updateDebugStats();
        return;
      }

      // Interruption / Barge-in signal from model or server
      if (msg.type === 'interrupted') {
        console.log('[LiveClient] Model interrupted');
        this.playbackQueue.interrupt();
        if (this.recorder.getIsRecording()) {
          this.setState('LISTENING');
        }
        return;
      }

      // Model or User transcription
      if (msg.type === 'transcript') {
        const role = msg.role === 'model' ? 'paaji' : 'user';
        this.callbacks.onTranscript(role, msg.text, msg.isFinal);
        if (role === 'paaji' && this.state === 'THINKING') {
          // Model started formulating response
        }
        return;
      }

      // Tool call from Gemini
      if (msg.type === 'tool_call') {
        console.log('[LiveClient] Received tool_call:', msg.name, msg.args);
        this.setState('EXECUTING');
        this.updateDebugStats(msg.name);

        const result = await executeTool(msg.name, msg.args || {});
        this.callbacks.onToolAction(result);

        // Send tool response back to Gemini Live
        this.ws?.send(JSON.stringify({
          type: 'tool_response',
          id: msg.id,
          name: msg.name,
          response: {
            output: result.message,
            success: result.success,
            data: result.data,
          },
        }));

        this.setState('THINKING');
        return;
      }

      if (msg.type === 'turn_complete') {
        // Model finished turn
        if (!this.playbackQueue.getActiveSourcesCount()) {
          if (this.recorder.getIsRecording()) {
            this.setState('LISTENING');
          } else {
            this.setState('IDLE');
          }
        }
      }
    } catch (err) {
      console.error('[LiveClient] Error parsing server message:', err);
    }
  }

  private hasGreeted = false;

  public async startVoiceSession(triggerGreeting = false): Promise<boolean> {
    // Play instant wake chime (<50ms) for tactile audio feedback
    playWakeChime();

    const connected = await this.connect();
    if (!connected) return false;

    const micReady = await this.recorder.start();
    if (!micReady) return false;

    this.setState('LISTENING');

    if (triggerGreeting || !this.hasGreeted) {
      this.hasGreeted = true;
      this.sendWakeGreeting();
    }

    return true;
  }

  public sendWakeGreeting() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.setState('THINKING');
      this.ws.send(JSON.stringify({ type: 'wake' }));
    }
  }

  public stopVoiceSession() {
    this.manualStop = true;
    this.recorder.stop();
    this.playbackQueue.interrupt();
    this.setState('IDLE');
  }

  public toggleVoiceSession(triggerGreeting = false): Promise<boolean> | void {
    if (this.recorder.getIsRecording()) {
      this.stopVoiceSession();
      return;
    } else {
      return this.startVoiceSession(triggerGreeting);
    }
  }

  public interrupt() {
    this.playbackQueue.interrupt();
    this.sendInterruptSignal();
    if (this.recorder.getIsRecording()) {
      this.setState('LISTENING');
    } else {
      this.setState('IDLE');
    }
  }

  private sendAudioChunk(base64: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.inputChunksSent++;
    this.ws.send(JSON.stringify({
      type: 'audio',
      data: base64,
    }));
    this.updateDebugStats();
  }

  private sendInterruptSignal() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'interrupt' }));
    }
  }

  /**
   * Send text prompt (e.g. from quick prompts or write-in),
   * which triggers Gemini Live model to respond with voice!
   */
  public async sendTextMessage(text: string): Promise<void> {
    if (!text.trim()) return;

    this.callbacks.onTranscript('user', text, true);
    this.setState('THINKING');

    // If WebSocket is open, send via Gemini Live
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'text',
        text: text.trim(),
      }));
      return;
    }

    // Fallback via /api/chat with real Gemini AI speech audio
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: text.trim(),
          voiceName: this.settings.voiceName || 'Zephyr',
        }),
      });

      if (!response.ok) {
        throw new Error(`Chat request failed with status: ${response.status}`);
      }

      const data = await response.json();
      this.callbacks.onTranscript('paaji', data.text, true);

      // Handle function calls if any
      if (data.functionCalls && data.functionCalls.length > 0) {
        for (const call of data.functionCalls) {
          const res = await executeTool(call.name, call.args || {});
          this.callbacks.onToolAction(res);
        }
      }

      // Play real AI speech audio
      if (data.audioBase64) {
        const binary = atob(data.audioBase64);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        await this.playbackQueue.playWavBytes(bytes.buffer);
      } else {
        this.setState('IDLE');
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('[LiveClient] Chat fallback error:', err);
      this.callbacks.onError(errMsg);
      this.setState('ERROR');
    }
  }

  private updateDebugStats(lastTool?: string) {
    this.callbacks.onDebugUpdate({
      inputChunksSent: this.inputChunksSent,
      outputChunksReceived: this.outputChunksReceived,
      queueLength: this.playbackQueue.getQueueLength(),
      activeSources: this.playbackQueue.getActiveSourcesCount(),
      lastLatencyMs: this.lastLatencyMs,
      lastTool,
    });
  }

  public getRecorderSampleRate(): number {
    return this.recorder.getInputSampleRate();
  }

  public isRecording(): boolean {
    return this.recorder.getIsRecording();
  }

  public disconnect() {
    this.manualStop = true;
    this.stopVoiceSession();
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    this.playbackQueue.destroy();
  }
}
