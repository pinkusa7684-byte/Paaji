import React from 'react';
import { ToolExecutionResult } from '../types/assistant';
import { Phone, ExternalLink, Bell, FileText, CloudSun, CheckCircle2, AlertCircle } from 'lucide-react';

interface ActionCardProps {
  action: ToolExecutionResult | null;
  onDismiss: () => void;
}

export const ActionCard: React.FC<ActionCardProps> = ({ action, onDismiss }) => {
  if (!action) return null;

  const getIcon = () => {
    const type = action.actionDetails?.type;
    switch (type) {
      case 'openApp':
        return <ExternalLink className="w-5 h-5 text-emerald-400" />;
      case 'call':
        return <Phone className="w-5 h-5 text-blue-400" />;
      case 'reminder':
        return <Bell className="w-5 h-5 text-amber-400" />;
      case 'note':
        return <FileText className="w-5 h-5 text-purple-400" />;
      case 'weather':
        return <CloudSun className="w-5 h-5 text-sky-400" />;
      default:
        return action.success
          ? <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          : <AlertCircle className="w-5 h-5 text-rose-400" />;
    }
  };

  return (
    <div className="w-full max-w-md mx-auto my-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className={`p-3.5 rounded-2xl border backdrop-blur-xl shadow-xl flex items-start gap-3.5 ${
        action.success
          ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-100'
          : 'bg-rose-950/40 border-rose-500/30 text-rose-100'
      }`}>
        <div className="p-2 rounded-xl bg-white/10 shrink-0">
          {getIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold tracking-wide text-white">
              {action.actionDetails?.label || action.toolName}
            </h4>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
              action.success ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
            }`}>
              {action.success ? 'Executed' : 'Notice'}
            </span>
          </div>
          <p className="text-xs text-white/80 mt-0.5 line-clamp-2">
            {action.message}
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="text-white/50 hover:text-white text-xs p-1 rounded-md transition-colors"
          aria-label="Dismiss action notification"
        >
          ✕
        </button>
      </div>
    </div>
  );
};
