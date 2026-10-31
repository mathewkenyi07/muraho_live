'use client';

import React from 'react';
import { CulturalAlert } from '@/lib/types';
import { ShieldAlert, DollarSign, HeartHandshake, Lightbulb, X, Volume2 } from 'lucide-react';

interface CulturalHUDProps {
  alerts: CulturalAlert[];
  onDismiss: (id: string) => void;
  onSpeakPhrase?: (phrase: string) => void;
  className?: string;
}

export const CulturalHUD: React.FC<CulturalHUDProps> = ({
  alerts,
  onDismiss,
  onSpeakPhrase,
  className = '',
}) => {
  if (!alerts || alerts.length === 0) return null;

  const getAlertIcon = (type: CulturalAlert['type']) => {
    switch (type) {
      case 'safety':
        return <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />;
      case 'fare':
        return <DollarSign className="w-5 h-5 text-emerald-400 shrink-0" />;
      case 'etiquette':
        return <HeartHandshake className="w-5 h-5 text-cyan-400 shrink-0" />;
      case 'tip':
      default:
        return <Lightbulb className="w-5 h-5 text-amber-400 shrink-0" />;
    }
  };

  const getAlertBorder = (type: CulturalAlert['type'], urgency?: string) => {
    if (urgency === 'high' || type === 'safety') {
      return 'border-rose-500/40 bg-rose-950/30 text-rose-100 shadow-[0_0_20px_rgba(244,63,94,0.15)]';
    }
    if (type === 'fare') {
      return 'border-emerald-500/40 bg-emerald-950/30 text-emerald-100 shadow-[0_0_20px_rgba(16,185,129,0.15)]';
    }
    if (type === 'etiquette') {
      return 'border-cyan-500/40 bg-cyan-950/30 text-cyan-100 shadow-[0_0_20px_rgba(6,182,212,0.15)]';
    }
    return 'border-amber-500/40 bg-amber-950/30 text-amber-100 shadow-[0_0_20px_rgba(245,158,11,0.15)]';
  };

  const getBadgeStyle = (type: CulturalAlert['type']) => {
    switch (type) {
      case 'safety':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      case 'fare':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'etiquette':
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
      default:
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    }
  };

  return (
    <div className={`flex flex-col gap-2.5 max-w-md w-full pointer-events-auto ${className}`}>
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`relative overflow-hidden rounded-2xl border backdrop-blur-xl p-3.5 transition-all duration-300 animate-in fade-in slide-in-from-top-4 ${getAlertBorder(
            alert.type,
            alert.urgency
          )}`}
        >
          {/* Header row */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-black/40 border border-white/5">
                {getAlertIcon(alert.type)}
              </div>
              <span className="font-semibold text-sm tracking-wide text-white">
                {alert.title}
              </span>
              {alert.badge && (
                <span
                  className={`text-[10px] font-medium uppercase px-2 py-0.5 rounded-full border ${getBadgeStyle(
                    alert.type
                  )}`}
                >
                  {alert.badge}
                </span>
              )}
            </div>

            <button
              onClick={() => onDismiss(alert.id)}
              className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Dismiss alert"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Description */}
          <p className="mt-2 text-xs leading-relaxed text-zinc-300 pl-8">
            {alert.description}
          </p>

          {/* Optional Kinyarwanda Phrase helper */}
          {alert.kinyarwandaPhrase && (
            <div className="mt-2.5 ml-8 p-2 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between gap-2">
              <div className="text-left">
                <p className="text-xs font-medium text-emerald-300 italic">
                  &ldquo;{alert.kinyarwandaPhrase}&rdquo;
                </p>
                {alert.translation && (
                  <p className="text-[11px] text-zinc-400">
                    ({alert.translation})
                  </p>
                )}
              </div>
              {onSpeakPhrase && (
                <button
                  onClick={() => onSpeakPhrase(alert.kinyarwandaPhrase!)}
                  className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 transition-colors shrink-0"
                  title="Pronounce phrase"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
