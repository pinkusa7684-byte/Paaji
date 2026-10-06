import React from 'react';
import { Mic, Sparkles } from 'lucide-react';

interface FirstUseModalProps {
  isOpen: boolean;
  onStart: () => void;
}

export const FirstUseModal: React.FC<FirstUseModalProps> = ({ isOpen, onStart }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-neutral-900/90 border border-amber-500/30 rounded-3xl p-6 sm:p-8 text-center shadow-2xl relative overflow-hidden">
        {/* Ambient background glow */}
        <div className="absolute -top-20 -left-20 w-44 h-44 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-44 h-44 bg-orange-600/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center shadow-xl mb-4 animate-bounce">
            <Sparkles className="w-8 h-8 text-white" />
          </div>

          <h2 className="text-2xl font-extrabold text-white tracking-tight">
            Hey! I'm Paaji 👋
          </h2>

          <p className="text-sm text-white/70 mt-3 leading-relaxed max-w-xs">
            Talk to me naturally. Ask questions, open apps, make calls, or just chat in English, Hindi, Punjabi, or Hinglish.
          </p>

          <div className="mt-5 space-y-2 text-xs text-amber-200/80 bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3 w-full text-left">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span>"Paaji, kya haal hai?"</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span>"Paaji, WhatsApp kholo"</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span>"Paaji, Mom ko call karo"</span>
            </div>
          </div>

          <button
            onClick={onStart}
            className="mt-6 w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-black font-bold text-sm shadow-xl flex items-center justify-center gap-2.5 cursor-pointer transition-all active:scale-95"
          >
            <Mic className="w-4 h-4 text-black" />
            <span>Start talking</span>
          </button>
        </div>
      </div>
    </div>
  );
};
