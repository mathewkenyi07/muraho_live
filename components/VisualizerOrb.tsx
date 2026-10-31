'use client';

import React, { useEffect, useRef } from 'react';
import { VoiceState } from '@/lib/types';

interface VisualizerOrbProps {
  state: VoiceState;
  audioLevel?: number; // 0.0 to 1.0 (reactive volume)
  onClick?: () => void;
  className?: string;
  size?: number; // diameter in pixels (e.g. 260)
}

export const VisualizerOrb: React.FC<VisualizerOrbProps> = ({
  state,
  audioLevel = 0,
  onClick,
  className = '',
  size = 280,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const phaseRef = useRef<number>(0);
  const smoothedLevelRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isRunning = true;

    // Device Pixel Ratio scaling for ultra-crisp retina displays
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const render = () => {
      if (!isRunning) return;

      // Smooth audio level
      smoothedLevelRef.current += (audioLevel - smoothedLevelRef.current) * 0.18;
      const smoothLevel = Math.max(0.04, Math.min(1.0, smoothedLevelRef.current));

      phaseRef.current += state === 'thinking' ? 0.045 : state === 'speaking' ? 0.035 : 0.02;

      ctx.clearRect(0, 0, size, size);

      const center = size / 2;
      const baseRadius = (size / 2) * 0.44;

      // Color palettes based on conversational voice state
      // Listening: Indigo, Electric Purple, Violet
      // Thinking: Amber, Gold, Warm Tangerine
      // Speaking: Emerald, Aquamarine, Cyan
      // Idle: Slate Blue, Muted Indigo
      let primaryColor = '129, 140, 248'; // indigo-400
      let secondaryColor = '168, 85, 247'; // purple-500
      let accentColor = '59, 130, 246'; // blue-500
      let glowColor = 'rgba(147, 51, 234, 0.35)';

      if (state === 'listening') {
        primaryColor = '147, 51, 234'; // purple-600
        secondaryColor = '99, 102, 241'; // indigo-500
        accentColor = '192, 132, 252'; // purple-400
        glowColor = 'rgba(147, 51, 234, 0.45)';
      } else if (state === 'thinking') {
        primaryColor = '245, 158, 11'; // amber-500
        secondaryColor = '251, 191, 36'; // amber-400
        accentColor = '249, 115, 22'; // orange-500
        glowColor = 'rgba(245, 158, 11, 0.45)';
      } else if (state === 'speaking') {
        primaryColor = '16, 185, 129'; // emerald-500
        secondaryColor = '6, 182, 212'; // cyan-500
        accentColor = '52, 211, 153'; // emerald-400
        glowColor = 'rgba(16, 185, 129, 0.45)';
      } else {
        // idle
        primaryColor = '99, 102, 241';
        secondaryColor = '79, 70, 229';
        accentColor = '129, 140, 248';
        glowColor = 'rgba(99, 102, 241, 0.25)';
      }

      // Outer animated ripple rings
      const numRipples = 3;
      for (let i = 0; i < numRipples; i++) {
        const ripplePhase = (phaseRef.current * 0.7 + i * (Math.PI * 2 / numRipples)) % (Math.PI * 2);
        const expansion = Math.sin(ripplePhase) * 0.5 + 0.5;
        const rippleRadius = baseRadius + (24 + smoothLevel * 45) * expansion + i * 14;
        const rippleAlpha = Math.max(0, 0.22 - expansion * 0.18) * (state === 'idle' ? 0.5 : 1);

        ctx.save();
        ctx.beginPath();
        ctx.arc(center, center, rippleRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${secondaryColor}, ${rippleAlpha})`;
        ctx.lineWidth = 1.8 + smoothLevel * 2.2;
        ctx.stroke();
        ctx.restore();
      }

      // Dynamic reactive organic orb with sine wave displacement
      const points = 60;
      ctx.save();
      ctx.beginPath();

      for (let i = 0; i <= points; i++) {
        const angle = (i / points) * Math.PI * 2;
        
        // Multi-frequency wave oscillation
        let displacement = 0;
        if (state === 'listening' || state === 'speaking') {
          const freq1 = Math.sin(angle * 5 + phaseRef.current * 3);
          const freq2 = Math.cos(angle * 3 - phaseRef.current * 2);
          displacement = (freq1 * 0.6 + freq2 * 0.4) * (14 + smoothLevel * 32);
        } else if (state === 'thinking') {
          const freq = Math.sin(angle * 4 + phaseRef.current * 4);
          displacement = freq * 9;
        } else {
          displacement = Math.sin(angle * 2 + phaseRef.current) * 4;
        }

        const r = baseRadius + displacement;
        const x = center + Math.cos(angle) * r;
        const y = center + Math.sin(angle) * r;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();

      // Deep multi-stop radial gradient
      const grad = ctx.createRadialGradient(
        center - baseRadius * 0.28,
        center - baseRadius * 0.32,
        baseRadius * 0.1,
        center,
        center,
        baseRadius * 1.35
      );

      grad.addColorStop(0, `rgba(${accentColor}, 0.95)`);
      grad.addColorStop(0.45, `rgba(${primaryColor}, 0.85)`);
      grad.addColorStop(0.85, `rgba(${secondaryColor}, 0.70)`);
      grad.addColorStop(1, `rgba(${primaryColor}, 0.15)`);

      ctx.fillStyle = grad;
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 35 + smoothLevel * 30;
      ctx.fill();

      // Inner specular light highlight
      ctx.beginPath();
      const specRadius = baseRadius * 0.55;
      const specX = center - baseRadius * 0.22;
      const specY = center - baseRadius * 0.22;
      const specGrad = ctx.createRadialGradient(specX, specY, 2, specX, specY, specRadius);
      specGrad.addColorStop(0, 'rgba(255, 255, 255, 0.75)');
      specGrad.addColorStop(0.5, `rgba(255, 255, 255, 0.15)`);
      specGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = specGrad;
      ctx.arc(specX, specY, specRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      isRunning = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [state, audioLevel, size]);

  const getStateLabel = () => {
    switch (state) {
      case 'listening':
        return 'Listening...';
      case 'thinking':
        return 'Muraho is thinking...';
      case 'speaking':
        return 'Muraho is speaking';
      default:
        return 'Tap orb or hold mic';
    }
  };

  const getStateBadgeColor = () => {
    switch (state) {
      case 'listening':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'thinking':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'speaking':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      default:
        return 'bg-zinc-800/60 text-zinc-400 border-zinc-700/50';
    }
  };

  return (
    <div className={`relative flex flex-col items-center justify-center select-none ${className}`}>
      {/* Background radial glow */}
      <div
        className={`absolute -inset-10 rounded-full blur-3xl opacity-40 transition-colors duration-700 pointer-events-none ${
          state === 'listening'
            ? 'bg-purple-600/40'
            : state === 'thinking'
            ? 'bg-amber-500/40'
            : state === 'speaking'
            ? 'bg-emerald-500/40'
            : 'bg-indigo-600/20'
        }`}
      />

      {/* Interactive canvas orb */}
      <div
        onClick={onClick}
        role="button"
        tabIndex={0}
        aria-label={`Voice status: ${state}`}
        className="relative cursor-pointer transition-transform duration-200 active:scale-95 group focus:outline-none"
      >
        <canvas
          ref={canvasRef}
          style={{ width: size, height: size }}
          className="rounded-full drop-shadow-[0_0_35px_rgba(0,0,0,0.6)]"
        />

        {/* Center state icon badge on hover or idle */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-12 h-12 rounded-full bg-black/30 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/80 group-hover:scale-110 transition-transform">
            {state === 'listening' && (
              <span className="relative flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-purple-500"></span>
              </span>
            )}
            {state === 'thinking' && (
              <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            )}
            {state === 'speaking' && (
              <div className="flex items-center space-x-1">
                <div className="w-1 h-3 bg-emerald-400 rounded-full animate-pulse" />
                <div className="w-1 h-5 bg-emerald-300 rounded-full animate-pulse delay-75" />
                <div className="w-1 h-2 bg-emerald-400 rounded-full animate-pulse delay-150" />
              </div>
            )}
            {state === 'idle' && (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-5 h-5 text-zinc-300 group-hover:text-white transition-colors"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
            )}
          </div>
        </div>
      </div>

      {/* Floating Pill status */}
      <div className="mt-4 flex items-center gap-2">
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border backdrop-blur-md transition-all duration-300 ${getStateBadgeColor()}`}
        >
          <span
            className={`w-2 h-2 rounded-full mr-2 ${
              state === 'listening'
                ? 'bg-purple-400 animate-ping'
                : state === 'thinking'
                ? 'bg-amber-400 animate-pulse'
                : state === 'speaking'
                ? 'bg-emerald-400'
                : 'bg-zinc-500'
            }`}
          />
          {getStateLabel()}
        </span>
      </div>
    </div>
  );
};
