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
  Volume2,
  MessageSquare,
  Radio,
  Sparkles,
} from 'lucide-react';

export default function MurahoLiveApp() {
  // Mode toggle: 'text' (clean chat with no bubbling orb) vs 'live' (visualizer orb active)
  const [viewMode, setViewMode] = useState<'text' | 'live'>('text');

  // Voice engine states
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [audioLevel, setAudioLevel] = useState<number>(0.04);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Modals & States
  const [momoModalData, setMomoModalData] = useState<MoMoPaymentData | null>(null);
  const [isMoMoOpen, setIsMoMoOpen] = useState<boolean>(false);

  // Cultural alerts HUD
  const [alerts, setAlerts] = useState<CulturalAlert[]>([]);

  // Transcripts list
  const [transcripts, setTranscripts] = useState<TranscriptMessage[]>([]);

  // Active subtitle text (streaming preview)
  const [liveSubtitle, setLiveSubtitle] = useState<string>('');
  const [inputText, setInputText] = useState<string>('');

  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts]);

  // Unlock browser audio context / speech on user gesture
  const unlockAudio = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.resume();
      } catch {
        // ignore
      }
    }
  };

  // Robust client speech synthesis
  const speakBrowserSpeech = (text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.92;
      utterance.pitch = 1.0;

      // Select matching voice if available
      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        const matchingVoice =
          voices.find(
            (v) =>
              v.lang.startsWith('rw') ||
              v.lang.startsWith('sw') ||
              v.lang.startsWith('fr') ||
              v.name.toLowerCase().includes('african')
          ) ||
          voices.find((v) => v.lang.startsWith('en')) ||
          voices[0];
        if (matchingVoice) {
          utterance.voice = matchingVoice;
        }
      }

      utterance.onstart = () => setVoiceState('speaking');
      utterance.onend = () => setVoiceState('idle');
      utterance.onerror = (e) => {
        console.warn('Browser speech synthesis error:', e);
        setVoiceState('idle');
      };

      // Retain reference on ref and window so Chrome's garbage collector doesn't cancel it mid-speech
      currentUtteranceRef.current = utterance;
      (window as unknown as { __murahoUtterance?: SpeechSynthesisUtterance }).__murahoUtterance = utterance;

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('speakBrowserSpeech exception:', err);
      setVoiceState('idle');
    }
  };

  // Audio speech synthesis helper (ElevenLabs / Backend + Web Speech fallback)
  const speakText = async (text: string) => {
    if (isMuted || typeof window === 'undefined') return;

    unlockAudio();

    // 1. Attempt backend TTS endpoint
    try {
      const ttsRes = await fetch('/api/tts-elevenlabs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, format: 'base64' }),
      });

      if (ttsRes.ok) {
        const data = await ttsRes.json();
        // If valid synthesized audio was returned
        if (data.audioBase64 && !data.isMockFallback && data.audioBase64.length > 2000) {
          const audio = new Audio(`data:${data.contentType || 'audio/wav'};base64,${data.audioBase64}`);
          audio.onplay = () => setVoiceState('speaking');
          audio.onended = () => setVoiceState('idle');
          audio.onerror = () => {
            speakBrowserSpeech(text);
          };
          await audio.play();
          return;
        }
      }
    } catch {
      // Fall through to client speech synthesis
    }

    // 2. High-reliability Browser Web Speech Synthesis
    speakBrowserSpeech(text);
  };

  // Process live spoken or typed input
  const handleDirectInput = async (inputStr: string) => {
    if (!inputStr.trim()) return;

    unlockAudio();

    const userMsg: TranscriptMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: inputStr,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setTranscripts((prev) => [...prev, userMsg]);
    setLiveSubtitle(inputStr);
    setVoiceState('thinking');

    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: inputStr,
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
            text: inputStr,
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
      <header className="relative z-20 flex items-center justify-between px-4 sm:px-6 py-2.5 sm:py-3.5 border-b border-white/5 backdrop-blur-2xl bg-black/40">
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

        {/* Mode Switcher: Text Mode vs Live Voice */}
        <div className="flex items-center p-0.5 rounded-xl bg-zinc-900/80 border border-white/10 shadow-inner">
          <button
            onClick={() => {
              unlockAudio();
              setViewMode('text');
            }}
            className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
              viewMode === 'text'
                ? 'bg-zinc-800 text-white shadow-sm border border-white/10 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Switch to Text Mode"
            aria-label="Switch to Text Mode"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Text</span>
          </button>
          <button
            onClick={() => {
              unlockAudio();
              setViewMode('live');
            }}
            className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
              viewMode === 'live'
                ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md shadow-cyan-500/20 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Switch to Live Voice Mode"
            aria-label="Switch to Live Voice Mode"
          >
            <Radio className={`w-3.5 h-3.5 ${viewMode === 'live' ? 'animate-pulse text-cyan-200' : ''}`} />
            <span>Live</span>
          </button>
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

        {/* LIVE MODE: Bubbling Visualizer Orb appears only when Live is active */}
        {viewMode === 'live' ? (
          <div className="my-auto flex flex-col items-center justify-center py-2 sm:py-4 w-full animate-fade-in">
            <VisualizerOrb
              state={voiceState}
              audioLevel={audioLevel}
              size={240}
              onClick={() => {
                unlockAudio();
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
                <p className="text-xs font-light text-zinc-400 tracking-wider font-mono">
                  {voiceState === 'listening' ? 'Listening... Speak naturally' : 'Tap microphone below to speak'}
                </p>
              )}
            </div>

            {/* Audio Controller Dock */}
            <div className="w-full mt-4 max-w-sm">
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
          </div>
        ) : (
          /* TEXT MODE: Bubbling icon is completely hidden, clean chat view */
          <div className="flex-1 w-full flex flex-col justify-between py-2 overflow-hidden">
            {transcripts.length === 0 ? (
              <div className="my-auto flex flex-col items-center justify-center text-center px-4 py-8 max-w-sm mx-auto">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center mb-4 text-cyan-400">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-semibold text-zinc-200 mb-1">
                  Kigali Street Translator
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed mb-4">
                  Type any English phrase below to get street-smart Kinyarwanda translation with live pronunciation.
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {[
                    'Bite se motari! How much to KCC?',
                    'Marakuja zingahe? Passion fruit price',
                    'Ufite MoMo? Can I pay with code',
                  ].map((phrase, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleDirectInput(phrase)}
                      className="text-[11px] px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/5 text-zinc-300 hover:text-white transition-all text-left"
                    >
                      {phrase}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="w-full flex-1 overflow-y-auto space-y-3 pr-1 mb-2">
                {transcripts.map((msg) => (
                  <div
                    key={msg.id}
                    className={`text-xs p-3 rounded-2xl leading-relaxed shadow-sm transition-all ${
                      msg.sender === 'user'
                        ? 'bg-blue-950/40 border border-blue-800/30 text-zinc-200 ml-8 text-right'
                        : 'bg-zinc-900/80 border border-white/10 text-zinc-100 mr-8 text-left'
                    }`}
                  >
                    <div className="font-mono text-[9px] text-zinc-400 uppercase tracking-widest mb-1 flex items-center justify-between">
                      <span>{msg.sender === 'user' ? 'You' : 'Muraho Live'}</span>
                      <span>{msg.timestamp}</span>
                    </div>
                    <div className="text-zinc-200">{msg.text}</div>
                    {msg.kinyarwandaSnippet && (
                      <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between gap-2">
                        <div className="text-cyan-400 text-xs font-medium font-sans">
                          {msg.kinyarwandaSnippet}
                        </div>
                        <button
                          onClick={() => {
                            unlockAudio();
                            speakText(msg.kinyarwandaSnippet || msg.text);
                          }}
                          className="p-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/25 text-cyan-300 transition-colors"
                          title="Listen to pronunciation"
                          aria-label="Listen to pronunciation"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={transcriptEndRef} />
              </div>
            )}
          </div>
        )}

        {/* Quick Text & Live Voice Input Bar */}
        <div className="w-full mb-2 flex items-center gap-2 bg-zinc-900/70 backdrop-blur-xl border border-white/10 rounded-2xl p-1.5 focus-within:border-cyan-500/50 transition-all shadow-lg">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onFocus={() => {
              // Ensure we stay in Text Mode when user is typing
              if (viewMode === 'live') {
                setViewMode('text');
              }
            }}
            placeholder="Type anything in English..."
            className="flex-1 bg-transparent px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none"
            aria-label="Type message in English"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && inputText.trim()) {
                const val = inputText.trim();
                setInputText('');
                unlockAudio();
                handleDirectInput(val);
              }
            }}
          />

          {/* Quick Voice / Live Toggle in input bar */}
          <button
            onClick={() => {
              unlockAudio();
              setViewMode(viewMode === 'live' ? 'text' : 'live');
            }}
            className={`p-2 rounded-xl transition-all ${
              viewMode === 'live'
                ? 'bg-cyan-500 text-zinc-950 shadow-md'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
            title={viewMode === 'live' ? 'Switch to text view' : 'Open live voice visualizer'}
            aria-label="Toggle voice visualizer"
          >
            <Radio className={`w-4 h-4 ${viewMode === 'live' ? 'animate-pulse' : ''}`} />
          </button>

          <button
            onClick={() => {
              if (inputText.trim()) {
                const val = inputText.trim();
                setInputText('');
                unlockAudio();
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
