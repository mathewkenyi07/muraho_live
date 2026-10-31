'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { VoiceState } from '@/lib/types';
import { Mic, MicOff, Volume2, VolumeX, Radio, Sparkles } from 'lucide-react';

interface AudioControllerProps {
  voiceState: VoiceState;
  onVoiceStateChange: (state: VoiceState) => void;
  onAudioLevelChange: (level: number) => void;
  onUserSpeechDetected?: (transcriptSnippet?: string) => void;
  onAudioStreamData?: (audioChunk: Blob) => void;
  isMuted?: boolean;
  onToggleMute?: () => void;
  className?: string;
}

export const AudioController: React.FC<AudioControllerProps> = ({
  voiceState,
  onVoiceStateChange,
  onAudioLevelChange,
  onUserSpeechDetected,
  onAudioStreamData,
  isMuted = false,
  onToggleMute,
  className = '',
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [streamActive, setStreamActive] = useState(false);
  const [isHandsFree, setIsHandsFree] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  // Audio refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Speech synthesis barge-in ref
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Cleanup audio tracks on unmount
  useEffect(() => {
    return () => {
      stopAudioCapture();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Monitor audio volume meter
  const startVolumeMeter = () => {
    if (!analyserRef.current) return;
    const analyser = analyserRef.current;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const updateMeter = () => {
      analyser.getByteFrequencyData(dataArray);

      // Compute RMS volume
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sum / dataArray.length);
      const normalized = Math.min(1.0, rms / 128);

      onAudioLevelChange(normalized);

      // Barge-in detection: If Muraho is speaking and user starts talking loudly
      if (voiceState === 'speaking' && normalized > 0.4) {
        // Interrupt / barge-in!
        interruptSpeaking();
        onVoiceStateChange('listening');
      }

      animFrameRef.current = requestAnimationFrame(updateMeter);
    };

    updateMeter();
  };

  const interruptSpeaking = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  };

  const startAudioCapture = async () => {
    setAudioError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone audio API not supported on this browser');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      mediaStreamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;
      source.connect(analyser);
      analyserRef.current = analyser;

      // MediaRecorder for chunk streaming
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      } catch {
        recorder = new MediaRecorder(stream);
      }

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0 && onAudioStreamData) {
          onAudioStreamData(event.data);
        }
      };

      recorder.start(500); // 500ms audio slices
      mediaRecorderRef.current = recorder;

      setIsRecording(true);
      setStreamActive(true);
      onVoiceStateChange('listening');
      startVolumeMeter();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Microphone access denied';
      console.warn('Microphone permission or hardware error:', errorMsg);
      setAudioError(errorMsg);
      // Fallback: simulate audio level pulse for UI preview
      simulateAudioPulse();
    }
  };

  const stopAudioCapture = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    setIsRecording(false);
    setStreamActive(false);
    onAudioLevelChange(0.04);
  };

  // Speech Recognition & Silence Detection (VAD) for automatic reply
  const recognitionRef = useRef<any>(null);
  const speechBufferRef = useRef<string>('');
  const speechSilenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Trigger dispatch when user stops speaking
  const dispatchCapturedSpeech = () => {
    const text = speechBufferRef.current.trim();
    if (text && onUserSpeechDetected) {
      speechBufferRef.current = '';
      onVoiceStateChange('thinking');
      onUserSpeechDetected(text);
    }
  };

  // Initialize Speech Recognition
  const initSpeechRecognition = () => {
    if (typeof window === 'undefined') return;
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      console.warn('SpeechRecognition API not available in this browser');
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            speechBufferRef.current += ' ' + transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        // Active speech detected
        onVoiceStateChange('listening');

        // Reset silence timer on every new speech chunk
        if (speechSilenceTimeoutRef.current) {
          clearTimeout(speechSilenceTimeoutRef.current);
        }

        // When user pauses for 1.2s, automatically trigger reply!
        speechSilenceTimeoutRef.current = setTimeout(() => {
          if (interimTranscript && !speechBufferRef.current.includes(interimTranscript)) {
            speechBufferRef.current += ' ' + interimTranscript;
          }
          dispatchCapturedSpeech();
        }, 1200);
      };

      recognition.onerror = (e: any) => {
        console.warn('Speech recognition event:', e.error);
        if (e.error === 'no-speech') {
          // keep listening if hands-free
        }
      };

      recognition.onend = () => {
        // In continuous hands-free mode, automatically restart listening
        if (isHandsFree && recognitionRef.current) {
          try {
            recognitionRef.current.start();
          } catch {
            // ignore
          }
        }
      };

      recognitionRef.current = recognition;
    } catch (err) {
      console.warn('Could not initialize SpeechRecognition:', err);
    }
  };

  const startSpeechRecognition = () => {
    speechBufferRef.current = '';
    if (!recognitionRef.current) {
      initSpeechRecognition();
    }
    try {
      recognitionRef.current?.start();
    } catch {
      // already started or not ready
    }
  };

  const stopSpeechRecognition = () => {
    if (speechSilenceTimeoutRef.current) {
      clearTimeout(speechSilenceTimeoutRef.current);
    }
    // Flush any pending words when stopped
    dispatchCapturedSpeech();
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore
    }
  };

  // Safe fallback synthesizer when no mic is detected
  const simulateAudioPulse = () => {
    setIsRecording(true);
    onVoiceStateChange('listening');
    let step = 0;
    const interval = setInterval(() => {
      step++;
      const simulatedLvl = 0.2 + Math.abs(Math.sin(step * 0.3)) * 0.5;
      onAudioLevelChange(simulatedLvl);
      if (step > 25) {
        clearInterval(interval);
        setIsRecording(false);
        onAudioLevelChange(0.04);
        onVoiceStateChange('idle');
      }
    }, 100);
  };

  // Push to Talk handler (MouseDown / TouchStart)
  const handlePushToTalkStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (voiceState === 'speaking') {
      interruptSpeaking();
    }
    startAudioCapture();
    startSpeechRecognition();
  };

  const handlePushToTalkEnd = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isHandsFree && isRecording) {
      stopAudioCapture();
      stopSpeechRecognition();
    }
  };

  const toggleHandsFree = () => {
    if (isHandsFree) {
      setIsHandsFree(false);
      stopAudioCapture();
      stopSpeechRecognition();
      onVoiceStateChange('idle');
    } else {
      setIsHandsFree(true);
      startAudioCapture();
      startSpeechRecognition();
    }
  };

  return (
    <div className={`flex flex-col items-center gap-3 w-full max-w-sm mx-auto ${className}`}>
      {/* Control buttons dock */}
      <div className="flex items-center justify-center gap-3 w-full">
        {/* Mute output toggle */}
        <button
          onClick={onToggleMute}
          className={`p-3 rounded-2xl border backdrop-blur-xl transition-all ${
            isMuted
              ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
              : 'bg-zinc-800/60 border-zinc-700/50 text-zinc-400 hover:text-white hover:bg-zinc-800'
          }`}
          title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          aria-label={isMuted ? 'Unmute Audio' : 'Mute Audio'}
        >
          {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>

        {/* Big Push-To-Talk / Hold-to-Talk Button */}
        <button
          onMouseDown={handlePushToTalkStart}
          onMouseUp={handlePushToTalkEnd}
          onTouchStart={handlePushToTalkStart}
          onTouchEnd={handlePushToTalkEnd}
          className={`flex-1 py-4 px-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-2.5 shadow-xl transition-all select-none touch-none active:scale-[0.96] ${
            isRecording
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-purple-600/30 ring-2 ring-purple-400 ring-offset-2 ring-offset-zinc-950 animate-pulse'
              : 'bg-zinc-800 hover:bg-zinc-750 text-zinc-100 border border-zinc-700 hover:border-zinc-500'
          }`}
          aria-label="Hold to talk"
        >
          <Mic className={`w-5 h-5 ${isRecording ? 'text-white' : 'text-purple-400'}`} />
          <span>{isRecording ? 'Listening...' : 'Tap to Speak'}</span>
        </button>

        {/* Continuous Hands-Free Streaming Switch */}
        <button
          onClick={toggleHandsFree}
          className={`p-3 rounded-2xl border backdrop-blur-xl transition-all ${
            isHandsFree
              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
              : 'bg-zinc-800/60 border-zinc-700/50 text-zinc-400 hover:text-white hover:bg-zinc-800'
          }`}
          title={isHandsFree ? 'Continuous Live Stream Active' : 'Enable Hands-Free Continuous Mode'}
          aria-label="Toggle continuous mode"
        >
          <Radio className={`w-5 h-5 ${isHandsFree ? 'animate-pulse text-emerald-400' : ''}`} />
        </button>
      </div>

      {/* Audio permission / notice message */}
      {audioError && (
        <div className="text-[11px] text-amber-400 bg-amber-950/30 border border-amber-800/50 px-3 py-1.5 rounded-xl text-center">
          Note: Microphone simulated ({audioError}). You can still use 1-tap fail-safe scenarios!
        </div>
      )}
    </div>
  );
};
