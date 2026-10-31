'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  VoiceState,
  CulturalAlert,
  MoMoPaymentData,
  TranscriptMessage,
} from '@/lib/types';
import { VisualizerOrb } from '@/components/VisualizerOrb';
import { CulturalHUD } from '@/components/CulturalHUD';
import { MoMoModal } from '@/components/MoMoModal';
import { AudioController } from '@/components/AudioController';
import {
  Smartphone,
  RotateCcw,
} from 'lucide-react';

export default function MurahoVoiceApp() {
  // Voice engine states
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [audioLevel, setAudioLevel] = useState<number>(0.04);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Modals & States
  const [momoModalData, setMomoModalData] = useState<MoMoPaymentData | null>(null);
  const [isMoMoOpen, setIsMoMoOpen] = useState<boolean>(false);

  // Cultural alerts HUD (starts empty, pops up dynamically when relevant)
  const [alerts, setAlerts] = useState<CulturalAlert[]>([]);

  // Transcripts list (starts clean)
  const [transcripts, setTranscripts] = useState<TranscriptMessage[]>([]);

  // Active subtitle text (streaming preview)
  const [liveSubtitle, setLiveSubtitle] = useState<string>('');
  const [inputText, setInputText] = useState<string>('');

  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts]);

  // Audio speech synthesis helper (ElevenLabs Flash v2.5 + Web Speech fallback)
  const speakText = async (text: string) => {
    if (isMuted || typeof window === 'undefined') return;

    // First attempt ElevenLabs Flash v2.5 or backend speech endpoint
    try {
      const ttsRes = await fetch('/api/tts-elevenlabs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, format: 'base64' }),
      });

      if (ttsRes.ok) {
        const data = await ttsRes.json();
        if (data.audioBase64 && !data.isMockFallback) {
          const audio = new Audio(`data:${data.contentType || 'audio/mpeg'};base64,${data.audioBase64}`);
          audio.onplay = () => setVoiceState('speaking');
          audio.onended = () => setVoiceState('idle');
          audio.onerror = () => {
            fallbackWebSpeech(text);
          };
          await audio.play();
          return;
        }
      }
    } catch {
      // fallback to browser speech synthesis
    }

    fallbackWebSpeech(text);
  };

  const fallbackWebSpeech = (text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.onstart = () => setVoiceState('speaking');
    utterance.onend = () => setVoiceState('idle');
    utterance.onerror = () => setVoiceState('idle');
    window.speechSynthesis.speak(utterance);
  };

  // Process live spoken or typed input
  const handleDirectInput = async (inputText: string) => {
    if (!inputText.trim()) return;

    const userMsg: TranscriptMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: inputText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setTranscripts((prev) => [...prev, userMsg]);
    setLiveSubtitle(inputText);
    setVoiceState('thinking');

    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: inputText,
          sourceLang: 'en',
          targetLang: 'rw',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const translationText =
          data.translatedText ||
          data.vernacularText ||
          data.data?.translation ||
          data.translation ||
          '';
        const culturalTip = data.culturalWarning || data.data?.cultural_tip;

        if (translationText) {
          const assistantMsg: TranscriptMessage = {
            id: `ast-${Date.now()}`,
            sender: 'assistant',
            text: inputText,
            kinyarwandaSnippet: translationText,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };

          setTranscripts((prev) => [...prev, assistantMsg]);
          setLiveSubtitle(translationText);

          if (culturalTip) {
            setAlerts((prev) => [
              {
                id: `tip-${Date.now()}`,
                type: 'tip',
                title: 'Etiquette Context',
                description: culturalTip,
              },
              ...prev,
            ]);
          }

          speakText(translationText);
          return;
        }
      }
    } catch (e) {
      console.warn('API error translating input:', e);
    }

    setLiveSubtitle('Translation network busy. Please try again.');
    setVoiceState('idle');
  };

  // Dismiss cultural alert
  const handleDismissAlert = (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  // Reset conversation
  const handleResetSession = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setVoiceState('idle');
    setAlerts([]);
    setTranscripts([]);
    setLiveSubtitle('');
  };

  return (
    <main className="relative flex flex-col h-[100dvh] w-screen overflow-hidden bg-zinc-950 text-zinc-100 select-none">
      {/* Dynamic Ambient Background Lights */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] sm:w-[550px] h-[350px] sm:h-[550px] bg-purple-700/10 rounded-full blur-[100px] sm:blur-[140px] pointer-events-none animate-pulse-subtle" />
      <div className="absolute bottom-1/4 right-1/4 w-[250px] sm:w-[400px] h-[250px] sm:h-[400px] bg-cyan-500/10 rounded-full blur-[90px] sm:blur-[120px] pointer-events-none" />

      {/* Top Navigation Bar: Minimalist Gemini Header */}
      <header className="relative z-20 flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-white/5 backdrop-blur-2xl bg-black/40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500 via-blue-600 to-purple-600 flex items-center justify-center font-bold text-white text-sm shadow-lg shadow-cyan-500/20">
            ✦
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold tracking-wide text-zinc-100">
                Muraho Live
              </h1>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" title="System Ready" />
            </div>
            <p className="text-[11px] text-zinc-400 font-mono tracking-tight">
              English &bull; Kinyarwanda
            </p>
          </div>
        </div>

        {/* Right header actions */}
        <div className="flex items-center gap-2">
          {momoModalData && (
            <button
              onClick={() => setIsMoMoOpen(true)}
              className="px-3 py-1.5 rounded-full bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-medium flex items-center gap-1.5 transition-all shadow-sm"
              title="Open MTN MoMo Pay"
              aria-label="Open MTN MoMo Pay"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>MoMo</span>
            </button>
          )}

          <button
            onClick={handleResetSession}
            className="p-2 rounded-full text-zinc-400 hover:text-white bg-zinc-900/60 hover:bg-zinc-800 border border-white/5 transition-colors"
            title="Reset conversation"
            aria-label="Reset conversation"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-between px-3 sm:px-6 py-2 overflow-y-auto max-w-xl mx-auto w-full">
        {/* Cultural HUD Alerts (Glides in only when relevant) */}
        <div className="w-full mb-1">
          <CulturalHUD
            alerts={alerts}
            onDismiss={handleDismissAlert}
            onSpeakPhrase={(phrase) => speakText(phrase)}
          />
        </div>

        {/* Center Visualizer Orb */}
        <div className="my-auto flex flex-col items-center justify-center py-2 sm:py-4 w-full">
          <VisualizerOrb
            state={voiceState}
            audioLevel={audioLevel}
            size={240}
            onClick={() => {
              if (voiceState === 'idle') {
                setVoiceState('listening');
              } else if (voiceState === 'speaking') {
                if (typeof window !== 'undefined' && window.speechSynthesis) {
                  window.speechSynthesis.cancel();
                }
                setVoiceState('idle');
              }
            }}
          />

          {/* Subtitle / Live Transcript Preview */}
          <div className="mt-4 sm:mt-6 max-w-md w-full px-4 text-center min-h-[36px] flex items-center justify-center" aria-live="polite">
            {liveSubtitle ? (
              <p className="text-sm font-light text-zinc-200 tracking-wide leading-relaxed animate-fade-in drop-shadow-sm">
                &ldquo;{liveSubtitle}&rdquo;
              </p>
            ) : (
              <p className="text-xs font-light text-zinc-500 tracking-wider font-mono">
                {voiceState === 'listening' ? 'Listening... Speak naturally' : 'Tap microphone or type below'}
              </p>
            )}
          </div>
        </div>

        {/* Real-time Subtitles / Chat Transcript */}
        {transcripts.length > 0 && (
          <div className="w-full bg-zinc-900/40 backdrop-blur-xl rounded-2xl border border-white/5 p-3.5 max-h-32 sm:max-h-40 overflow-y-auto mb-2.5 transition-all">
            <div className="space-y-2">
              {transcripts.map((msg) => (
                <div
                  key={msg.id}
                  className={`text-xs p-2.5 rounded-xl leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-blue-950/30 border border-blue-800/20 text-zinc-200 ml-6 text-right'
                      : 'bg-zinc-800/40 border border-white/5 text-zinc-200 mr-6 text-left'
                  }`}
                >
                  <div className="font-mono text-[9px] text-zinc-400 uppercase tracking-widest mb-0.5">
                    {msg.sender === 'user' ? 'You' : 'Muraho'} &bull; {msg.timestamp}
                  </div>
                  <div>{msg.text}</div>
                  {msg.kinyarwandaSnippet && (
                    <div className="mt-1 text-cyan-400 text-[11px] font-medium font-sans">
                      {msg.kinyarwandaSnippet}
                    </div>
                  )}
                </div>
              ))}
              <div ref={transcriptEndRef} />
            </div>
          </div>
        )}

        {/* Quick Text & Live Voice Input Bar */}
        <div className="w-full mb-2.5 flex items-center gap-2 bg-zinc-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-1.5 focus-within:border-cyan-500/50 transition-all shadow-lg">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type or speak anything in English..."
            className="flex-1 bg-transparent px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none"
            aria-label="Type message in English"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && inputText.trim()) {
                const val = inputText.trim();
                setInputText('');
                handleDirectInput(val);
              }
            }}
          />
          <button
            onClick={() => {
              if (inputText.trim()) {
                const val = inputText.trim();
                setInputText('');
                handleDirectInput(val);
              }
            }}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold text-xs hover:opacity-90 active:scale-95 transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-cyan-400"
            title="Translate text"
            aria-label="Translate text"
          >
            Send
          </button>
        </div>

        {/* Audio Controller */}
        <div className="w-full mb-2">
          <AudioController
            voiceState={voiceState}
            onVoiceStateChange={setVoiceState}
            onAudioLevelChange={setAudioLevel}
            isMuted={isMuted}
            onToggleMute={() => setIsMuted(!isMuted)}
            onUserSpeechDetected={(speechText) => {
              if (speechText) {
                handleDirectInput(speechText);
              }
            }}
          />
        </div>

        {/* UI Ethics & Transparency Note */}
        <footer className="w-full text-center pb-1">
          <p className="text-[10px] text-zinc-500 tracking-tight">
            Transcribing only when active &bull; No personal audio stored &bull; Emergency? Call 112
          </p>
        </footer>
      </div>

      {/* MTN MoMo Pay USSD Modal */}
      <MoMoModal
        paymentData={momoModalData}
        isOpen={isMoMoOpen}
        onClose={() => setIsMoMoOpen(false)}
      />
    </main>
  );
}
