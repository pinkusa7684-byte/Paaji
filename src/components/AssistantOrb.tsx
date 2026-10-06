import React, { useEffect, useRef } from 'react';
import { AssistantState } from '../types/assistant';

interface AssistantOrbProps {
  state: AssistantState;
  audioLevel: number; // 0 to 1
  onClick?: () => void;
}

export const AssistantOrb: React.FC<AssistantOrbProps> = ({ state, audioLevel, onClick }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | undefined>(undefined);
  const phaseRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isRunning = true;

    const render = () => {
      if (!isRunning) return;
      phaseRef.current += 0.04;
      const phase = phaseRef.current;
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      // Color pallete based on state
      let primaryColor = 'rgba(59, 130, 246, '; // Blue
      let secondaryColor = 'rgba(147, 51, 234, '; // Purple
      let glowColor = 'rgba(99, 102, 241, 0.4)';

      if (state === 'LISTENING') {
        primaryColor = 'rgba(16, 185, 129, '; // Emerald
        secondaryColor = 'rgba(6, 182, 212, '; // Cyan
        glowColor = 'rgba(16, 185, 129, 0.5)';
      } else if (state === 'SPEAKING') {
        primaryColor = 'rgba(249, 115, 22, '; // Warm Orange/Amber
        secondaryColor = 'rgba(236, 72, 153, '; // Pink
        glowColor = 'rgba(249, 115, 22, 0.6)';
      } else if (state === 'THINKING') {
        primaryColor = 'rgba(168, 85, 247, '; // Purple
        secondaryColor = 'rgba(59, 130, 246, '; // Blue
        glowColor = 'rgba(168, 85, 247, 0.5)';
      } else if (state === 'EXECUTING') {
        primaryColor = 'rgba(234, 179, 8, '; // Amber
        secondaryColor = 'rgba(16, 185, 129, '; // Emerald
        glowColor = 'rgba(234, 179, 8, 0.6)';
      } else if (state === 'ERROR') {
        primaryColor = 'rgba(239, 68, 68, '; // Red
        secondaryColor = 'rgba(244, 63, 94, '; // Rose
        glowColor = 'rgba(239, 68, 68, 0.5)';
      } else if (state === 'CONNECTING') {
        primaryColor = 'rgba(14, 165, 233, '; // Sky
        secondaryColor = 'rgba(99, 102, 241, '; // Indigo
        glowColor = 'rgba(14, 165, 233, 0.4)';
      }

      // Base radius with audio reactivity
      const baseRadius = 70 + (audioLevel * 30);
      const breathing = Math.sin(phase) * (state === 'IDLE' ? 6 : 2);
      const radius = baseRadius + breathing;

      // Outer ambient glow
      const outerGlow = ctx.createRadialGradient(centerX, centerY, radius * 0.4, centerX, centerY, radius * 2.0);
      outerGlow.addColorStop(0, glowColor);
      outerGlow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = outerGlow;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 2.0, 0, Math.PI * 2);
      ctx.fill();

      // Multi-layer resonant harmonic circles
      const ringCount = state === 'SPEAKING' || state === 'LISTENING' ? 4 : 3;
      for (let i = ringCount; i >= 1; i--) {
        const ringRadius = radius * (0.4 + i * 0.2);
        const ringAlpha = (0.3 / i) + (audioLevel * 0.4);

        ctx.beginPath();
        const points = 36;
        for (let p = 0; p <= points; p++) {
          const angle = (p / points) * Math.PI * 2;
          const wobble = (state === 'SPEAKING' || state === 'LISTENING')
            ? Math.sin(angle * 6 + phase * 2 + i) * (8 * (audioLevel + 0.2))
            : (state === 'THINKING' ? Math.cos(angle * 4 + phase * 3) * 5 : Math.sin(angle * 3 + phase) * 2);

          const r = ringRadius + wobble;
          const px = centerX + Math.cos(angle) * r;
          const py = centerY + Math.sin(angle) * r;

          if (p === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.strokeStyle = `${primaryColor}${ringAlpha})`;
        ctx.lineWidth = 1.5 + (i === 1 ? 2 : 0) + (audioLevel * 2);
        ctx.stroke();
      }

      // Inner Glowing Core Orb
      const coreGrad = ctx.createRadialGradient(
        centerX - radius * 0.2,
        centerY - radius * 0.2,
        4,
        centerX,
        centerY,
        radius * 0.75
      );
      coreGrad.addColorStop(0, '#ffffff');
      coreGrad.addColorStop(0.3, `${primaryColor}0.95)`);
      coreGrad.addColorStop(0.8, `${secondaryColor}0.85)`);
      coreGrad.addColorStop(1, `${secondaryColor}0.3)`);

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 0.7, 0, Math.PI * 2);
      ctx.fillStyle = coreGrad;
      ctx.fill();

      // Thinking rotation ring
      if (state === 'THINKING') {
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(phase * 2);
        ctx.beginPath();
        ctx.arc(0, 0, radius * 0.85, 0, Math.PI * 1.4);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.restore();
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      isRunning = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [state, audioLevel]);

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`Paaji assistant is ${state.toLowerCase()}. Tap to interact.`}
      className="relative flex items-center justify-center cursor-pointer select-none group transition-transform active:scale-95"
    >
      <canvas
        ref={canvasRef}
        width={340}
        height={340}
        className="w-[280px] h-[280px] sm:w-[320px] sm:h-[320px] max-w-full touch-none"
      />
      {/* Floating status label inside core */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
        <span className="text-xs uppercase tracking-widest font-semibold px-2.5 py-0.5 rounded-full backdrop-blur-md bg-black/40 text-white/90 border border-white/10 shadow-lg">
          {state === 'IDLE' && 'Tap to Speak'}
          {state === 'CONNECTING' && 'Connecting...'}
          {state === 'LISTENING' && 'Listening'}
          {state === 'THINKING' && 'Thinking...'}
          {state === 'SPEAKING' && 'Paaji Speaking'}
          {state === 'EXECUTING' && 'Doing Action'}
          {state === 'ERROR' && 'Needs Attention'}
        </span>
      </div>
    </div>
  );
};
