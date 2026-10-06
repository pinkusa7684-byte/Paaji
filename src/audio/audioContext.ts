/**
 * Persistent AudioContext and Web Audio pipeline utilities for PAAJI.
 * Adheres to:
 * - Single persistent AudioContext
 * - 24kHz model output handling
 * - Proper state check and resume on user gesture
 * - Clean Little Endian PCM 16-bit conversions
 */

let persistentOutputContext: AudioContext | null = null;
let masterGainNode: GainNode | null = null;

export function getOutputAudioContext(): AudioContext {
  if (!persistentOutputContext || persistentOutputContext.state === 'closed') {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    persistentOutputContext = new AudioCtx({
      sampleRate: 24000, // Gemini Live model output sample rate
      latencyHint: 'interactive',
    });
    masterGainNode = persistentOutputContext.createGain();
    masterGainNode.gain.value = 1.0;
    masterGainNode.connect(persistentOutputContext.destination);
  }
  return persistentOutputContext;
}

export function getMasterGainNode(): GainNode {
  getOutputAudioContext();
  return masterGainNode!;
}

export function setMasterVolume(volume: number) {
  if (masterGainNode) {
    masterGainNode.gain.value = Math.max(0, Math.min(1, volume));
  }
}

export async function ensureAudioContextRunning(): Promise<boolean> {
  const ctx = getOutputAudioContext();
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch (err) {
      console.warn('AudioContext resume failed:', err);
      return false;
    }
  }
  return ctx.state === 'running';
}

/**
 * Convert Float32Array (-1.0 to +1.0) from microphone to 16-bit PCM Little-Endian Uint8Array
 */
export function floatTo16BitPCM(float32Array: Float32Array): Uint8Array {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  let offset = 0;
  for (let i = 0; i < float32Array.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true); // true = Little Endian
  }
  return new Uint8Array(buffer);
}

/**
 * Convert Uint8Array bytes to base64 string
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  const chunkSize = 0x8000;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

/**
 * Convert Base64 PCM 16-bit little-endian string into AudioBuffer for 24kHz playback
 */
export function pcm16Base64ToAudioBuffer(
  audioCtx: AudioContext,
  base64: string,
  sampleRate = 24000
): AudioBuffer {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const numSamples = Math.floor(len / 2);
  const audioBuffer = audioCtx.createBuffer(1, numSamples, sampleRate);
  const channelData = audioBuffer.getChannelData(0);
  const dataView = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  for (let i = 0; i < numSamples; i++) {
    const int16 = dataView.getInt16(i * 2, true); // little-endian
    channelData[i] = int16 < 0 ? int16 / 0x8000 : int16 / 0x7fff;
  }

  return audioBuffer;
}

/**
 * Diagnostic Speaker Test:
 * Plays an organic harmonic chord (440Hz + 554Hz + 659Hz - A Major) through the exact
 * same output graph used by Paaji: AudioBufferSourceNode -> GainNode -> destination.
 * Returns true if played successfully.
 */
export async function runSpeakerDiagnostic(): Promise<{ success: boolean; state: string; error?: string }> {
  try {
    const ctx = getOutputAudioContext();
    await ensureAudioContextRunning();

    if (ctx.state !== 'running') {
      return { success: false, state: ctx.state, error: 'AudioContext is not running' };
    }

    const duration = 0.6;
    const sampleRate = ctx.sampleRate;
    const frameCount = sampleRate * duration;
    const buffer = ctx.createBuffer(1, frameCount, sampleRate);
    const data = buffer.getChannelData(0);

    const freq1 = 440.0; // A4
    const freq2 = 554.37; // C#5
    const freq3 = 659.25; // E5

    for (let i = 0; i < frameCount; i++) {
      const t = i / sampleRate;
      // Exponential fade out envelope
      const env = Math.exp(-3 * t);
      const wave = (
        0.5 * Math.sin(2 * Math.PI * freq1 * t) +
        0.3 * Math.sin(2 * Math.PI * freq2 * t) +
        0.2 * Math.sin(2 * Math.PI * freq3 * t)
      );
      data[i] = wave * env * 0.4;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(masterGainNode || ctx.destination);
    source.start(ctx.currentTime);

    return { success: true, state: ctx.state };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, state: 'error', error: message };
  }
}

/**
 * Instant subtle wake chime (<60ms) for immediate sensory feedback on mic tap
 */
export async function playWakeChime(): Promise<void> {
  try {
    const ctx = getOutputAudioContext();
    await ensureAudioContextRunning();
    if (ctx.state !== 'running') return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.08); // E5

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(masterGainNode || ctx.destination);

    osc.start(now);
    osc.stop(now + 0.13);
  } catch {
    // Graceful silent fallback
  }
}

