import React, { useState } from 'react';
import { DebugMetrics } from '../types/assistant';
import { runSpeakerDiagnostic, getOutputAudioContext } from '../audio/audioContext';
import { Activity, Volume2, CheckCircle, AlertTriangle, X } from 'lucide-react';

interface DebugHudProps {
  metrics: DebugMetrics;
  isOpen: boolean;
  onClose: () => void;
}

export const DebugHud: React.FC<DebugHudProps> = ({ metrics, isOpen, onClose }) => {
  const [testResult, setTestResult] = useState<{ success: boolean; state: string; error?: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  if (!isOpen) return null;

  const handleSpeakerTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await runSpeakerDiagnostic();
      setTestResult(result);
    } catch (err: unknown) {
      setTestResult({
        success: false,
        state: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsTesting(false);
    }
  };

  const currentCtx = getOutputAudioContext();

  return (
    <div className="fixed inset-x-4 bottom-4 max-w-xl mx-auto z-50 bg-black/90 border border-emerald-500/30 rounded-2xl p-4 shadow-2xl backdrop-blur-2xl text-xs text-emerald-300 font-mono">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span className="font-bold uppercase tracking-wider text-white">Paaji Audio & Realtime Diagnostics</span>
        </div>
        <button
          onClick={onClose}
          className="text-white/60 hover:text-white p-1 rounded-md"
          aria-label="Close Debug HUD"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
        <div>
          <span className="text-white/50">Connection: </span>
          <span className={`font-bold ${metrics.connectionStatus === 'connected' ? 'text-emerald-400' : 'text-amber-400'}`}>
            {metrics.connectionStatus.toUpperCase()}
          </span>
        </div>

        <div>
          <span className="text-white/50">Output AudioContext: </span>
          <span className="text-white">{currentCtx.state} ({currentCtx.sampleRate} Hz)</span>
        </div>

        <div>
          <span className="text-white/50">Input Format: </span>
          <span className="text-white">PCM L16 (16,000 Hz)</span>
        </div>

        <div>
          <span className="text-white/50">Output Format: </span>
          <span className="text-white">PCM L16 (24,000 Hz)</span>
        </div>

        <div>
          <span className="text-white/50">Input Chunks Sent: </span>
          <span className="text-cyan-400">{metrics.inputChunksSent}</span>
        </div>

        <div>
          <span className="text-white/50">Output Chunks Recv: </span>
          <span className="text-purple-400">{metrics.outputChunksReceived}</span>
        </div>

        <div>
          <span className="text-white/50">Playback Queue: </span>
          <span className="text-white">{metrics.audioQueueLength} buffers</span>
        </div>

        <div>
          <span className="text-white/50">Active Audio Nodes: </span>
          <span className="text-white">{metrics.activeSourcesCount}</span>
        </div>

        {metrics.lastToolName && (
          <div className="col-span-2">
            <span className="text-white/50">Last Tool Executed: </span>
            <span className="text-amber-300 font-bold">{metrics.lastToolName}</span>
          </div>
        )}

        {metrics.lastError && (
          <div className="col-span-2 text-rose-400 break-words">
            <span className="text-white/50">Last Error: </span>
            {metrics.lastError}
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between gap-3">
        <button
          onClick={handleSpeakerTest}
          disabled={isTesting}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-semibold cursor-pointer transition-colors active:scale-95 disabled:opacity-50"
        >
          <Volume2 className="w-3.5 h-3.5" />
          <span>{isTesting ? 'Playing tone...' : 'Test Speaker Pipeline'}</span>
        </button>

        {testResult && (
          <div className="flex items-center gap-1.5 text-[11px]">
            {testResult.success ? (
              <>
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-300">Tone Played OK (State: {testResult.state})</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                <span className="text-rose-300">{testResult.error || 'Failed'}</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
