import React from 'react';

interface AudioVisualizerProps {
  micLevel: number;
  speakerLevel: number;
  isListening: boolean;
  isSpeaking: boolean;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  micLevel,
  speakerLevel,
  isListening,
  isSpeaking,
}) => {
  const activeLevel = isSpeaking ? speakerLevel : (isListening ? micLevel : 0);
  const barCount = 18;

  return (
    <div className="flex items-center justify-center gap-1.5 h-10 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
      {Array.from({ length: barCount }).map((_, idx) => {
        // Create organic wave shape with sine variation
        const distanceToCenter = Math.abs(idx - barCount / 2) / (barCount / 2);
        const factor = Math.max(0.15, 1 - distanceToCenter);
        const dynamicHeight = Math.max(4, Math.min(32, (activeLevel * 30 * factor) + (Math.sin(idx + Date.now() / 200) * 3)));

        const isUser = isListening;
        const colorClass = isSpeaking
          ? 'bg-amber-400'
          : isUser
          ? 'bg-emerald-400'
          : 'bg-white/20';

        return (
          <div
            key={idx}
            style={{ height: `${dynamicHeight}px` }}
            className={`w-1 rounded-full transition-all duration-75 ${colorClass}`}
          />
        );
      })}
    </div>
  );
};
