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

  // Audio chunks collector for backend transcription
  const recordedChunksRef = useRef<Blob[]>([]);
  const lastSpokenTimestampRef = useRef<number>(0);
  const speechDetectedDuringRecordingRef = useRef<boolean>(false);
  const isSendingAudioRef = useRef<boolean>(false);

  // Monitor audio volume meter and detect speech + silence
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

      const now = Date.now();

      // If user is actively speaking (RMS volume threshold > 0.08)
      if (normalized > 0.08) {
        lastSpokenTimestampRef.current = now;
        speechDetectedDuringRecordingRef.current = true;

        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }

        // Barge-in detection: If Muraho is speaking, cancel it immediately
        if (voiceState === 'speaking') {
          interruptSpeaking();
          onVoiceStateChange('listening');
        }
      } else if (
        speechDetectedDuringRecordingRef.current &&
        lastSpokenTimestampRef.current > 0 &&
        now - lastSpokenTimestampRef.current > 1100 &&
        !isSendingAudioRef.current
      ) {
        // User spoke and then paused for > 1.1s: auto-send audio!
        speechDetectedDuringRecordingRef.current = false;
        finishAndTranscribeAudio();
      }

      animFrameRef.current = requestAnimationFrame(updateMeter);
    };

    updateMeter();
  };

  const finishAndTranscribeAudio = async () => {
    if (isSendingAudioRef.current) return;
    isSendingAudioRef.current = true;
    onVoiceStateChange('thinking');

    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }

      // Small delay to ensure last dataavailable event fires
      await new Promise((r) => setTimeout(r, 120));

      const chunks = [...recordedChunksRef.current];
      recordedChunksRef.current = [];

      if (chunks.length > 0) {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');

        const res = await fetch('/api/transcribe', {
          method: 'POST',
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          const transcription = (data.text || '').trim();
          if (transcription && onUserSpeechDetected) {
            onUserSpeechDetected(transcription);
          } else {
            onVoiceStateChange('idle');
          }
        } else {
          onVoiceStateChange('idle');
        }
      } else {
        onVoiceStateChange('idle');
      }
    } catch (err) {
      console.warn('Transcription error:', err);
      onVoiceStateChange('idle');
    } finally {
      isSendingAudioRef.current = false;
      stopAudioCapture();
    }
  };

  const interruptSpeaking = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  };

  const startAudioCapture = async () => {
    setAudioError(null);
    recordedChunksRef.current = [];
    speechDetectedDuringRecordingRef.current = false;
    lastSpokenTimestampRef.current = 0;
    isSendingAudioRef.current = false;

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

      // MediaRecorder for chunk capture
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      } catch {
        recorder = new MediaRecorder(stream);
      }

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
          if (onAudioStreamData) {
            onAudioStreamData(event.data);
          }
        }
      };

      recorder.start(250); // 250ms chunks
      mediaRecorderRef.current = recorder;

      setIsRecording(true);
      setStreamActive(true);
      onVoiceStateChange('listening');
      startVolumeMeter();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Microphone access denied';
      console.warn('Microphone permission or hardware error:', errorMsg);
      setAudioError(errorMsg);
      setIsRecording(false);
      onVoiceStateChange('idle');
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
      setAudioError('Browser speech recognition not supported. Please type in the input bar.');
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.continuous = false; // Capture discrete sentence utterance
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsRecording(true);
        onVoiceStateChange('listening');
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }

        const trimmed = transcript.trim();
        if (trimmed) {
          speechBufferRef.current = trimmed;
        }

        // Reset silence timer on every new speech chunk
        if (speechSilenceTimeoutRef.current) {
          clearTimeout(speechSilenceTimeoutRef.current);
        }

        // When user pauses for 1000ms, automatically trigger reply!
        speechSilenceTimeoutRef.current = setTimeout(() => {
          stopSpeechRecognition();
          stopAudioCapture();
        }, 1000);
      };

      recognition.onerror = (e: any) => {
        console.warn('Speech recognition event:', e.error);
        if (e.error === 'not-allowed') {
          setAudioError('Microphone permission blocked. Please allow mic access in your browser address bar.');
          setIsRecording(false);
          onVoiceStateChange('idle');
        } else if (e.error === 'network') {
          // Brave browser blocks Google's speech recognition cloud service by default
          setAudioError('Brave Shields blocked browser speech-to-text. Enable Google services for speech in Brave, or use the input box to type.');
          setIsRecording(false);
          onVoiceStateChange('idle');
        } else if (e.error === 'no-speech') {
          // User paused without saying words
          setIsRecording(false);
          onVoiceStateChange('idle');
        }
      };

      recognition.onend = () => {
        setIsRecording(false);
        dispatchCapturedSpeech();
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

  // Push to Talk handler (MouseDown / TouchStart)
  const handlePushToTalkStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (voiceState === 'speaking') {
      interruptSpeaking();
    }
    startAudioCapture();
  };

  const handlePushToTalkEnd = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isHandsFree && isRecording) {
      if (speechDetectedDuringRecordingRef.current || recordedChunksRef.current.length > 0) {
        finishAndTranscribeAudio();
      } else {
        stopAudioCapture();
      }
    }
  };

  const toggleHandsFree = () => {
    if (isHandsFree) {
      setIsHandsFree(false);
      stopAudioCapture();
      onVoiceStateChange('idle');
    } else {
      setIsHandsFree(true);
      startAudioCapture();
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

        {/* Single Tap Toggle Microphone Button */}
        <button
          onClick={() => {
            if (isRecording) {
              if (speechDetectedDuringRecordingRef.current || recordedChunksRef.current.length > 0) {
                finishAndTranscribeAudio();
              } else {
                stopAudioCapture();
                onVoiceStateChange('idle');
              }
            } else {
              if (voiceState === 'speaking') {
                interruptSpeaking();
              }
              startAudioCapture();
            }
          }}
          className={`flex-1 py-4 px-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-2.5 shadow-xl transition-all select-none active:scale-[0.96] ${
            isRecording
              ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-blue-600/30 ring-2 ring-cyan-400 ring-offset-2 ring-offset-zinc-950 animate-pulse'
              : 'bg-zinc-800 hover:bg-zinc-750 text-zinc-100 border border-zinc-700 hover:border-zinc-500'
          }`}
          aria-label={isRecording ? 'Stop listening' : 'Start speaking'}
        >
          <Mic className={`w-5 h-5 ${isRecording ? 'text-white animate-bounce' : 'text-cyan-400'}`} />
          <span>{isRecording ? 'Listening (Pause to Translate)...' : 'Tap to Speak'}</span>
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
        <div className="text-[11px] text-zinc-400 bg-zinc-900/80 border border-white/10 px-3.5 py-1.5 rounded-xl text-center backdrop-blur-md">
          {audioError}
        </div>
      )}
    </div>
  );
};
