'use client';

import React, { useEffect, useRef } from 'react';
import { VoiceState } from '@/lib/types';

interface VisualizerOrbProps {
  state: VoiceState;
  audioLevel?: number; // 0.0 to 1.0 (reactive volume)
  onClick?: () => void;
  className?: string;
  size?: number; // diameter in pixels (e.g. 280)
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

      // Smooth audio level response
      smoothedLevelRef.current += (audioLevel - smoothedLevelRef.current) * 0.22;
      const smoothLevel = Math.max(0.02, Math.min(1.0, smoothedLevelRef.current));

      phaseRef.current += state === 'thinking' ? 0.045 : state === 'speaking' ? 0.038 : 0.022;

      ctx.clearRect(0, 0, size, size);

      const center = size / 2;
      const baseRadius = (size / 2) * 0.46;

      // Gemini signature color palette
      // Listening: Gemini Cyan & Electric Blue (48, 134, 254) -> Violet (168, 85, 247)
      // Thinking: Gemini Celestial Deep Indigo & Amber Shimmer
      // Speaking: Radiant Blue (59, 130, 246) -> Teal & Purple glow
      // Idle: Deep Aurora Navy / Slate Glow
      let primaryColor = '59, 130, 246'; // gemini-blue
      let secondaryColor = '168, 85, 247'; // gemini-purple
      let accentColor = '56, 189, 248'; // gemini-cyan
      let glowColor = 'rgba(56, 189, 248, 0.45)';

      if (state === 'listening') {
        primaryColor = '56, 189, 248'; // electric cyan
        secondaryColor = '129, 140, 248'; // indigo
        accentColor = '192, 132, 252'; // purple
        glowColor = 'rgba(56, 189, 248, 0.65)';
      } else if (state === 'thinking') {
        primaryColor = '168, 85, 247'; // deep purple
        secondaryColor = '245, 158, 11'; // warm amber gold
        accentColor = '99, 102, 241'; // indigo
        glowColor = 'rgba(168, 85, 247, 0.6)';
      } else if (state === 'speaking') {
        primaryColor = '59, 130, 246'; // vivid azure
        secondaryColor = '16, 185, 129'; // emerald cyan
        accentColor = '147, 51, 234'; // electric violet
        glowColor = 'rgba(59, 130, 246, 0.65)';
      } else {
        // Idle state: Clean, ethereal celestial glow
        primaryColor = '99, 102, 241';
        secondaryColor = '59, 130, 246';
        accentColor = '168, 85, 247';
        glowColor = 'rgba(99, 102, 241, 0.3)';
      }

      // Outer ethereal orbital aura rings (Gemini celestial style)
      const numOrbits = 3;
      for (let i = 0; i < numOrbits; i++) {
        const orbitPhase = (phaseRef.current * 0.8 + (i * Math.PI * 2) / numOrbits) % (Math.PI * 2);
        const pulse = Math.sin(orbitPhase) * 0.5 + 0.5;
        const radius = baseRadius + (18 + smoothLevel * 48) * pulse + i * 16;
        const alpha = Math.max(0, 0.25 - pulse * 0.2) * (state === 'idle' ? 0.4 : 0.9);

        ctx.save();
        ctx.beginPath();
        ctx.arc(center, center, radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${i === 0 ? accentColor : secondaryColor}, ${alpha})`;
        ctx.lineWidth = 1.6 + smoothLevel * 2.5;
        ctx.stroke();
        ctx.restore();
      }

      // Multi-frequency harmonic fluid deformation (Gemini Live organic morphing)
      const points = 72;
      ctx.save();
      ctx.beginPath();

      for (let i = 0; i <= points; i++) {
        const angle = (i / points) * Math.PI * 2;

        let displacement = 0;
        if (state === 'listening' || state === 'speaking') {
          const harmonic1 = Math.sin(angle * 4 + phaseRef.current * 3.2);
          const harmonic2 = Math.cos(angle * 3 - phaseRef.current * 2.1);
          const harmonic3 = Math.sin(angle * 6 + phaseRef.current * 1.5);
          displacement =
            (harmonic1 * 0.5 + harmonic2 * 0.35 + harmonic3 * 0.15) *
            (12 + smoothLevel * 36);
        } else if (state === 'thinking') {
          const harmonic = Math.sin(angle * 5 + phaseRef.current * 4.5);
          displacement = harmonic * 10;
        } else {
          displacement = Math.sin(angle * 3 + phaseRef.current * 1.2) * 4;
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

      // Gemini celestial gradient: dynamic angle shifting with phase
      const gradAngle = phaseRef.current * 0.8;
      const gx1 = center + Math.cos(gradAngle) * (baseRadius * 0.8);
      const gy1 = center + Math.sin(gradAngle) * (baseRadius * 0.8);
      const gx2 = center - Math.cos(gradAngle) * (baseRadius * 0.8);
      const gy2 = center - Math.sin(gradAngle) * (baseRadius * 0.8);

      const grad = ctx.createLinearGradient(gx1, gy1, gx2, gy2);
      grad.addColorStop(0, `rgba(${accentColor}, 0.95)`);
      grad.addColorStop(0.35, `rgba(${primaryColor}, 0.88)`);
      grad.addColorStop(0.75, `rgba(${secondaryColor}, 0.82)`);
      grad.addColorStop(1, `rgba(${accentColor}, 0.70)`);

      ctx.fillStyle = grad;
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 38 + smoothLevel * 35;
      ctx.fill();

      // Specular highlight for liquid glass finish
      ctx.beginPath();
      const specRadius = baseRadius * 0.52;
      const specX = center - baseRadius * 0.24;
      const specY = center - baseRadius * 0.24;
      const specGrad = ctx.createRadialGradient(specX, specY, 1, specX, specY, specRadius);
      specGrad.addColorStop(0, 'rgba(255, 255, 255, 0.75)');
      specGrad.addColorStop(0.45, 'rgba(255, 255, 255, 0.18)');
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

  return (
    <div className={`relative flex flex-col items-center justify-center select-none ${className}`}>
      {/* Background Gemini Ambient Blur Aura */}
      <div
        className={`absolute -inset-12 rounded-full blur-3xl opacity-50 transition-colors duration-700 pointer-events-none ${
          state === 'listening'
            ? 'bg-cyan-500/40'
            : state === 'thinking'
            ? 'bg-purple-600/40'
            : state === 'speaking'
            ? 'bg-blue-600/40'
            : 'bg-indigo-600/25'
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
          className="rounded-full drop-shadow-[0_0_45px_rgba(0,0,0,0.7)]"
        />

        {/* Minimal center indicator */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-11 h-11 rounded-full bg-black/25 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/90 group-hover:scale-110 transition-transform">
            {state === 'listening' && (
              <span className="relative flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-cyan-400"></span>
              </span>
            )}
            {state === 'thinking' && (
              <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
            )}
            {state === 'speaking' && (
              <div className="flex items-center space-x-1">
                <div className="w-1 h-3 bg-cyan-400 rounded-full animate-pulse" />
                <div className="w-1 h-5 bg-blue-400 rounded-full animate-pulse delay-75" />
                <div className="w-1 h-2 bg-purple-400 rounded-full animate-pulse delay-150" />
              </div>
            )}
            {state === 'idle' && (
              <div className="w-3 h-3 rounded-full bg-white/60 group-hover:bg-white transition-colors" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
