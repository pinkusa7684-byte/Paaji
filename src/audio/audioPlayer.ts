/**
 * Audio Player with gapless sequential scheduling and instant barge-in support.
 */
import {
  getOutputAudioContext,
  getMasterGainNode,
  ensureAudioContextRunning,
  pcm16Base64ToAudioBuffer,
} from './audioContext';

export class AudioPlaybackQueue {
  private nextStartTime = 0;
  private activeSources: AudioBufferSourceNode[] = [];
  private queuedCount = 0;
  private isPlaying = false;
  private onPlaybackStateChange?: (playing: boolean) => void;
  private onLevelMeter?: (level: number) => void;
  private levelCheckTimer?: number;
  private analyserNode: AnalyserNode | null = null;

  constructor(options?: {
    onPlaybackStateChange?: (playing: boolean) => void;
    onLevelMeter?: (level: number) => void;
  }) {
    this.onPlaybackStateChange = options?.onPlaybackStateChange;
    this.onLevelMeter = options?.onLevelMeter;
  }

  private initAnalyser() {
    if (!this.analyserNode) {
      const ctx = getOutputAudioContext();
      this.analyserNode = ctx.createAnalyser();
      this.analyserNode.fftSize = 256;
      const masterGain = getMasterGainNode();
      masterGain.connect(this.analyserNode);
    }
  }

  public getQueueLength(): number {
    return this.queuedCount;
  }

  public getActiveSourcesCount(): number {
    return this.activeSources.length;
  }

  public async enqueuePcmChunk(base64Chunk: string, sampleRate = 24000) {
    if (!base64Chunk) return;

    await ensureAudioContextRunning();
    const ctx = getOutputAudioContext();
    this.initAnalyser();

    try {
      const buffer = pcm16Base64ToAudioBuffer(ctx, base64Chunk, sampleRate);
      this.scheduleBuffer(buffer);
    } catch (err) {
      console.error('Failed to decode PCM chunk:', err);
    }
  }

  public async playWavBytes(arrayBuffer: ArrayBuffer) {
    await ensureAudioContextRunning();
    const ctx = getOutputAudioContext();
    this.initAnalyser();

    try {
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
      this.scheduleBuffer(audioBuffer);
    } catch (err) {
      console.error('Failed to decode WAV buffer:', err);
    }
  }

  private scheduleBuffer(buffer: AudioBuffer) {
    const ctx = getOutputAudioContext();
    const masterGain = getMasterGainNode();
    const now = ctx.currentTime;

    // If nextStartTime has fallen behind or queue was idle, snap to now + small lookahead buffer
    if (this.nextStartTime < now) {
      this.nextStartTime = now + 0.005; // 5ms ultra-low latency lookahead for instant playback
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(masterGain);

    source.start(this.nextStartTime);
    this.activeSources.push(source);
    this.queuedCount++;
    this.setPlayingState(true);

    const scheduledEnd = this.nextStartTime + buffer.duration;
    this.nextStartTime = scheduledEnd;

    source.onended = () => {
      const idx = this.activeSources.indexOf(source);
      if (idx !== -1) {
        this.activeSources.splice(idx, 1);
      }
      this.queuedCount = Math.max(0, this.queuedCount - 1);
      if (this.activeSources.length === 0 && ctx.currentTime >= this.nextStartTime - 0.05) {
        this.setPlayingState(false);
      }
    };
  }

  /**
   * Barge-in / Interruption:
   * Instantly stops all current playing buffers, purges scheduled chunks,
   * and resets timeline so user speech immediately takes priority.
   */
  public interrupt() {
    for (const source of this.activeSources) {
      try {
        source.onended = null;
        source.stop();
        source.disconnect();
      } catch {
        // Ignore already stopped nodes
      }
    }
    this.activeSources = [];
    this.queuedCount = 0;
    const ctx = getOutputAudioContext();
    this.nextStartTime = ctx.currentTime;
    this.setPlayingState(false);
  }

  private setPlayingState(playing: boolean) {
    if (this.isPlaying !== playing) {
      this.isPlaying = playing;
      this.onPlaybackStateChange?.(playing);

      if (playing) {
        this.startLevelMonitoring();
      } else {
        this.stopLevelMonitoring();
      }
    }
  }

  private startLevelMonitoring() {
    if (this.levelCheckTimer) return;
    const check = () => {
      if (!this.isPlaying || !this.analyserNode) {
        this.stopLevelMonitoring();
        return;
      }
      const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);
      this.analyserNode.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;
      const normalized = Math.min(1.0, average / 128);
      this.onLevelMeter?.(normalized);
      this.levelCheckTimer = window.requestAnimationFrame(check);
    };
    this.levelCheckTimer = window.requestAnimationFrame(check);
  }

  private stopLevelMonitoring() {
    if (this.levelCheckTimer) {
      window.cancelAnimationFrame(this.levelCheckTimer);
      this.levelCheckTimer = undefined;
    }
    this.onLevelMeter?.(0);
  }

  public destroy() {
    this.interrupt();
    this.stopLevelMonitoring();
  }
}
