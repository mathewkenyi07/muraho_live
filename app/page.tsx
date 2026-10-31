'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  VoiceState,
  CulturalAlert,
  MoMoPaymentData,
  TranscriptMessage,
  FailSafeScenario,
} from '@/lib/types';
import { VisualizerOrb } from '@/components/VisualizerOrb';
import { CulturalHUD } from '@/components/CulturalHUD';
import { MoMoModal } from '@/components/MoMoModal';
import { FailSafeDrawer, DEMO_SCENARIOS } from '@/components/FailSafeDrawer';
import { AudioController } from '@/components/AudioController';
import {
  Sparkles,
  Wifi,
  Smartphone,
  Info,
  RotateCcw,
  Volume2,
  Globe,
  Radio,
} from 'lucide-react';

export default function MurahoVoiceApp() {
  // Voice engine states
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [audioLevel, setAudioLevel] = useState<number>(0.04);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);

  // Modals & Drawers
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [momoModalData, setMomoModalData] = useState<MoMoPaymentData | null>(null);
  const [isMoMoOpen, setIsMoMoOpen] = useState<boolean>(false);

  // Cultural alerts HUD
  const [alerts, setAlerts] = useState<CulturalAlert[]>([
    {
      id: 'welcome-tip',
      type: 'tip',
      title: 'Muraho Voice Active',
      description: 'Listening for English & Kinyarwanda queries. Try asking about moto taxi fares or market prices!',
      badge: 'Rwanda AI',
      kinyarwandaPhrase: 'Muraho, nshobora kugufasha iki?',
      translation: 'Hello, how can I help you?',
    },
  ]);

  // Transcripts list
  const [transcripts, setTranscripts] = useState<TranscriptMessage[]>([
    {
      id: 'init-1',
      sender: 'assistant',
      text: 'Muraho neza! I am your real-time Kigali bilingual voice assistant. How can I help you today?',
      kinyarwandaSnippet: 'Muraho neza! Niteguye kugufasha mu ruzinduko rwawe.',
      timestamp: '14:30',
    },
  ]);

  // Active subtitle text (streaming preview)
  const [liveSubtitle, setLiveSubtitle] = useState<string>(
    'Muraho neza! Speak naturally or tap a scenario below.'
  );

  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts]);

  // Audio speech synthesis helper
  const speakText = (text: string) => {
    if (isMuted || typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      setVoiceState('speaking');
    };
    utterance.onend = () => {
      setVoiceState('idle');
    };
    utterance.onerror = () => {
      setVoiceState('idle');
    };

    window.speechSynthesis.speak(utterance);
  };

  // Trigger scenario (from Fail-Safe Drawer)
  const handleSelectScenario = (scenario: FailSafeScenario) => {
    setActiveScenarioId(scenario.id);
    setIsDrawerOpen(false);

    // 1. User query transcript
    const userMsg: TranscriptMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: scenario.userPrompt,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setTranscripts((prev) => [...prev, userMsg]);
    setLiveSubtitle(scenario.userPrompt);
    setVoiceState('thinking');

    // 2. Simulated response after thinking pause
    setTimeout(() => {
      const resp = scenario.simulatedResponse;
      const assistantMsg: TranscriptMessage = {
        id: `ast-${Date.now()}`,
        sender: 'assistant',
        text: resp.text,
        kinyarwandaSnippet: resp.kinyarwanda,
        translationSnippet: resp.translation,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setTranscripts((prev) => [...prev, assistantMsg]);
      setLiveSubtitle(resp.kinyarwanda || resp.text);

      // Add cultural HUD alert if present
      if (resp.culturalAlert) {
        setAlerts((prev) => [
          resp.culturalAlert!,
          ...prev.filter((a) => a.id !== resp.culturalAlert!.id),
        ]);
      }

      // If MoMo payment data exists, show MoMo Pay button/modal
      if (resp.momoData) {
        setMomoModalData(resp.momoData);
        // Optionally auto-open modal after speech
        setTimeout(() => {
          setIsMoMoOpen(true);
        }, 1800);
      }

      // Voice output
      speakText(resp.audioText);
    }, 1200);
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
    setActiveScenarioId(null);
    setAlerts([
      {
        id: 'reset-tip',
        type: 'tip',
        title: 'New Session Started',
        description: 'Session cleared. Ready for your live voice queries.',
      },
    ]);
    setTranscripts([
      {
        id: `init-${Date.now()}`,
        sender: 'assistant',
        text: 'Muraho neza! Ask me about moto fares, Nyabugogo routes, or Kimironko market prices.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setLiveSubtitle('Session reset. Ready to listen.');
  };

  return (
    <main className="relative flex flex-col h-screen w-screen overflow-hidden bg-zinc-950 text-zinc-100 select-none">
      {/* Dynamic Ambient Background Lights */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-purple-700/10 rounded-full blur-[140px] pointer-events-none animate-pulse-subtle" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Top Navigation Bar */}
      <header className="relative z-20 flex items-center justify-between px-5 py-4 border-b border-white/5 backdrop-blur-xl bg-zinc-950/60">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-amber-500 flex items-center justify-center font-black text-white text-base shadow-lg shadow-purple-600/20">
            M
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold tracking-tight text-white">
                Muraho Voice
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live STT/TTS
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">
              Kinyarwanda &bull; English Bilingual AI
            </p>
          </div>
        </div>

        {/* Right header actions */}
        <div className="flex items-center gap-2">
          {momoModalData && (
            <button
              onClick={() => setIsMoMoOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-lg shadow-amber-500/10"
              title="Open MTN MoMo Pay"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>MoMo Pay</span>
            </button>
          )}

          <button
            onClick={handleResetSession}
            className="p-2 rounded-xl text-zinc-400 hover:text-white bg-zinc-900/80 hover:bg-zinc-800 border border-white/5 transition-colors"
            title="Reset conversation"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-between px-4 pb-24 pt-2 overflow-y-auto max-w-2xl mx-auto w-full">
        {/* Cultural HUD Alerts (Top floating) */}
        <div className="w-full mb-2">
          <CulturalHUD
            alerts={alerts}
            onDismiss={handleDismissAlert}
            onSpeakPhrase={(phrase) => speakText(phrase)}
          />
        </div>

        {/* Center Visualizer Orb */}
        <div className="my-auto flex flex-col items-center justify-center py-4">
          <VisualizerOrb
            state={voiceState}
            audioLevel={audioLevel}
            size={270}
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

          {/* Subtitle / Live Transcript Banner */}
          <div className="mt-4 max-w-md w-full px-4 text-center">
            <p className="text-sm font-medium text-zinc-300 leading-snug tracking-tight drop-shadow-md">
              &ldquo;{liveSubtitle}&rdquo;
            </p>
          </div>
        </div>

        {/* Real-time Subtitles / Chat Transcript Accordion Drawer */}
        <div className="w-full bg-zinc-900/60 backdrop-blur-md rounded-2xl border border-white/5 p-3.5 max-h-40 overflow-y-auto mb-3 shadow-inner">
          <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
            <span>Live Transcript Stream</span>
            <span className="text-[10px] text-zinc-500 font-mono">Bilingual Feed</span>
          </div>

          <div className="space-y-2">
            {transcripts.map((msg) => (
              <div
                key={msg.id}
                className={`text-xs p-2 rounded-xl leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-purple-950/40 border border-purple-800/30 text-purple-200 ml-6 text-right'
                    : 'bg-zinc-800/70 border border-white/5 text-zinc-200 mr-6 text-left'
                }`}
              >
                <div className="font-semibold text-[10px] text-zinc-400 uppercase tracking-wide mb-0.5">
                  {msg.sender === 'user' ? 'You' : 'Muraho Assistant'} &bull; {msg.timestamp}
                </div>
                <div>{msg.text}</div>
                {msg.kinyarwandaSnippet && (
                  <div className="mt-1 text-emerald-400 text-[11px] italic font-medium">
                    {msg.kinyarwandaSnippet}
                  </div>
                )}
              </div>
            ))}
            <div ref={transcriptEndRef} />
          </div>
        </div>

        {/* Audio Controller (PTT and hands-free toggle) */}
        <div className="w-full mb-1">
          <AudioController
            voiceState={voiceState}
            onVoiceStateChange={setVoiceState}
            onAudioLevelChange={setAudioLevel}
            isMuted={isMuted}
            onToggleMute={() => setIsMuted(!isMuted)}
            onUserSpeechDetected={async (speechText) => {
              if (!speechText) return;

              const userMsg: TranscriptMessage = {
                id: `usr-${Date.now()}`,
                sender: 'user',
                text: speechText,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              };

              setTranscripts((prev) => [...prev, userMsg]);
              setLiveSubtitle(speechText);
              setVoiceState('thinking');

              try {
                const res = await fetch('/api/translate', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    text: speechText,
                    sourceLang: 'en',
                    targetLang: 'rw',
                  }),
                });

                if (res.ok) {
                  const data = await res.json();
                  const translationText = data.data?.translation || data.translation || 'Sawa sawa, niteguye kugufasha.';
                  const culturalTip = data.data?.cultural_tip || data.culturalTip;

                  const assistantMsg: TranscriptMessage = {
                    id: `ast-${Date.now()}`,
                    sender: 'assistant',
                    text: data.data?.english_meaning || speechText,
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
                        title: 'Kigali Etiquette & Fare Context',
                        description: culturalTip,
                        badge: 'Tinker LoRA + Paper Instruments',
                      },
                      ...prev,
                    ]);
                  }

                  speakText(translationText);
                  return;
                }
              } catch (e) {
                console.warn('API error, falling back to scenario', e);
              }

              // Fallback
              handleSelectScenario(DEMO_SCENARIOS[0]);
            }}
          />
        </div>
      </div>

      {/* MTN MoMo Pay USSD Modal */}
      <MoMoModal
        paymentData={momoModalData}
        isOpen={isMoMoOpen}
        onClose={() => setIsMoMoOpen(false)}
      />

      {/* Accessible FailSafe Scenarios Drawer */}
      <FailSafeDrawer
        isOpen={isDrawerOpen}
        onToggle={() => setIsDrawerOpen(!isDrawerOpen)}
        onSelectScenario={handleSelectScenario}
        activeScenarioId={activeScenarioId}
      />
    </main>
  );
}
