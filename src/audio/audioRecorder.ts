/**
 * Real microphone capture pipeline for PAAJI.
 * Converts live mic stream into 16kHz Little-Endian PCM base64 chunks.
 */
import { floatTo16BitPCM, uint8ArrayToBase64 } from './audioContext';

export interface RecorderCallbacks {
  onAudioChunk: (base64Chunk: string) => void;
  onLevelMeter?: (level: number) => void;
  onError?: (error: string) => void;
}

export class AudioRecorder {
  private mediaStream: MediaStream | null = null;
  private inputAudioCtx: AudioContext | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private isRecording = false;
  private callbacks: RecorderCallbacks;

  constructor(callbacks: RecorderCallbacks) {
    this.callbacks = callbacks;
  }

  public getIsRecording(): boolean {
    return this.isRecording;
  }

  public getInputSampleRate(): number {
    return this.inputAudioCtx ? this.inputAudioCtx.sampleRate : 16000;
  }

  public async start(): Promise<boolean> {
    if (this.isRecording) return true;

    try {
      // Check mediaDevices support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone capture is not supported in this browser environment.');
      }

      // Request stream with high quality voice processing constraints
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: { ideal: 16000 },
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.mediaStream = stream;

      // Handle track endings (e.g. unplugged headset / mic revoked)
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length > 0) {
        audioTracks[0].onended = () => {
          this.stop();
          this.callbacks.onError?.('Microphone disconnected or revoked.');
        };
      }

      // Dedicated input AudioContext (at 16000 if supported or fallback to hardware rate with simple resampler)
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.inputAudioCtx = new AudioCtx({ sampleRate: 16000 });
      await this.inputAudioCtx.resume();

      this.sourceNode = this.inputAudioCtx.createMediaStreamSource(stream);

      // Buffer size 1024 gives ~64ms per chunk at 16kHz - snappy real-time responsiveness
      const bufferSize = 1024;
      this.scriptProcessor = this.inputAudioCtx.createScriptProcessor(bufferSize, 1, 1);

      this.scriptProcessor.onaudioprocess = (e: AudioProcessingEvent) => {
        if (!this.isRecording) return;
        const inputData = e.inputBuffer.getChannelData(0);

        // Calculate RMS for visualizer
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);
        // Boost visually for pleasant display
        const level = Math.min(1.0, rms * 5.0);
        this.callbacks.onLevelMeter?.(level);

        // Convert to 16-bit PCM little endian
        const pcmBytes = floatTo16BitPCM(inputData);
        const base64 = uint8ArrayToBase64(pcmBytes);

        this.callbacks.onAudioChunk(base64);
      };

      this.sourceNode.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.inputAudioCtx.destination);

      this.isRecording = true;
      return true;
    } catch (err: unknown) {
      this.stop();
      let errorMsg = 'Failed to access microphone.';
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          errorMsg = 'Microphone permission denied. Please allow microphone access in your browser.';
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          errorMsg = 'No microphone device found on this system.';
        } else {
          errorMsg = err.message;
        }
      }
      this.callbacks.onError?.(errorMsg);
      return false;
    }
  }

  public stop() {
    this.isRecording = false;

    if (this.scriptProcessor) {
      this.scriptProcessor.onaudioprocess = null;
      try {
        this.scriptProcessor.disconnect();
      } catch {}
      this.scriptProcessor = null;
    }

    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {}
      this.sourceNode = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.inputAudioCtx && this.inputAudioCtx.state !== 'closed') {
      try {
        this.inputAudioCtx.close();
      } catch {}
      this.inputAudioCtx = null;
    }

    this.callbacks.onLevelMeter?.(0);
  }
}
