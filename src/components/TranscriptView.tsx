import React, { useRef, useEffect } from 'react';
import { MessageItem } from '../types/assistant';
import { Bot, User, Wrench, Trash2 } from 'lucide-react';

interface TranscriptViewProps {
  messages: MessageItem[];
  onClear: () => void;
  isOpen: boolean;
  onToggle: () => void;
}

export const TranscriptView: React.FC<TranscriptViewProps> = ({
  messages,
  onClear,
  isOpen,
  onToggle,
}) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current && isOpen) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="flex items-center justify-between px-2 py-1 text-xs text-white/60">
        <button
          onClick={onToggle}
          className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer py-1 font-medium"
        >
          <span>{isOpen ? 'Hide Transcript' : 'Show Transcript'}</span>
          <span className="text-[10px] px-1.5 py-0.2 bg-white/10 rounded-full text-white/80">
            {messages.length}
          </span>
        </button>
        {messages.length > 0 && isOpen && (
          <button
            onClick={onClear}
            className="flex items-center gap-1 text-white/40 hover:text-rose-400 transition-colors cursor-pointer"
            title="Clear conversation"
          >
            <Trash2 className="w-3 h-3" />
            <span>Clear</span>
          </button>
        )}
      </div>

      {isOpen && (
        <div
          ref={scrollRef}
          className="mt-2 max-h-56 sm:max-h-72 overflow-y-auto space-y-3 p-3.5 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-xl shadow-inner scrollbar-thin scrollbar-thumb-white/20"
        >
          {messages.length === 0 ? (
            <div className="text-center py-8 text-xs text-white/40">
              No conversation yet. Tap the microphone or say something to Paaji!
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender !== 'user' && (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center shrink-0 shadow-md">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                )}

                <div
                  className={`max-w-[82%] rounded-2xl px-3.5 py-2 text-xs sm:text-sm leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-blue-600 text-white rounded-tr-sm shadow-md'
                      : 'bg-white/10 text-white/95 rounded-tl-sm border border-white/10'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>

                  {msg.toolCall && (
                    <div className="mt-2 pt-2 border-t border-white/10 text-[11px] text-amber-300/90 flex items-center gap-1.5">
                      <Wrench className="w-3 h-3 text-amber-400 shrink-0" />
                      <span className="font-mono">Tool: {msg.toolCall.name}</span>
                      {msg.toolCall.resultSummary && (
                        <span className="text-white/60 truncate">— {msg.toolCall.resultSummary}</span>
                      )}
                    </div>
                  )}

                  <span className="block text-[9px] text-white/40 mt-1 text-right">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {msg.sender === 'user' && (
                  <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-white/80" />
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
