/**
 * ElevenLabs Flash v2.5 Low-Latency Voice Synthesis Client
 * Optimized for sub-150ms street audio responses with streaming or instant mp3 buffer generation.
 * Fallbacks to synthetic web speech / pre-cached audio indicators if no API key is set.
 */

export interface ElevenLabsTTSRequest {
  text: string;
  voiceId?: string; // Default to natural conversational voice (e.g. 'pNInz6obpgDQGcFmaJgB' Adam or multiligual)
  modelId?: string; // eleven_flash_v2_5 or eleven_multilingual_v2
  stability?: number;
  similarityBoost?: number;
}

export interface ElevenLabsTTSResponse {
  audioBuffer?: Buffer;
  audioBase64?: string;
  contentType: string;
  latencyMs: number;
  modelUsed: string;
  isMockFallback: boolean;
}

export class ElevenLabsService {
  private apiKey?: string;
  private defaultVoiceId: string = 'pNInz6obpgDQGcFmaJgB'; // Fast, clear multilingual baseline
  private flashModelId: string = 'eleven_flash_v2_5';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.ELEVENLABS_API_KEY;
  }

  /**
   * Synthesize speech using Flash v2.5
   */
  async synthesizeSpeech(req: ElevenLabsTTSRequest): Promise<ElevenLabsTTSResponse> {
    const startTime = Date.now();
    const voiceId = req.voiceId || this.defaultVoiceId;
    const modelId = req.modelId || this.flashModelId;

    if (this.apiKey) {
      try {
        const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`;
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'xi-api-key': this.apiKey,
            'Content-Type': 'application/json',
            Accept: 'audio/mpeg',
          },
          body: JSON.stringify({
            text: req.text,
            model_id: modelId,
            voice_settings: {
              stability: req.stability ?? 0.45,
              similarity_boost: req.similarityBoost ?? 0.75,
              style: 0.1,
              use_speaker_boost: true,
            },
          }),
        });

        if (res.ok) {
          const arrayBuffer = await res.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          return {
            audioBuffer: buffer,
            audioBase64: buffer.toString('base64'),
            contentType: 'audio/mpeg',
            latencyMs: Date.now() - startTime,
            modelUsed: modelId,
            isMockFallback: false,
          };
        } else {
          const errText = await res.text();
          console.warn('[ElevenLabs] TTS generation returned error:', res.status, errText);
        }
      } catch (err) {
        console.warn('[ElevenLabs] Fetch failed, triggering synthetic fallback:', err);
      }
    }

    // 2. High-Fidelity Neural Voice Synthesis via Gemini 2.5 Flash Preview TTS
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      try {
        const ttsUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${geminiKey}`;
        const payload = {
          contents: [{
            parts: [{ text: `Read this Kinyarwanda phrase aloud clearly and naturally: "${req.text}"` }]
          }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: "Aoede"
                }
              }
            }
          }
        };

        const ttsRes = await fetch(ttsUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (ttsRes.ok) {
          const ttsData = await ttsRes.json();
          const audioPart = ttsData.candidates?.[0]?.content?.parts?.[0]?.inlineData;
          if (audioPart?.data) {
            const wavBuffer = this.pcmToWavBuffer(audioPart.data, 24000);
            return {
              audioBuffer: wavBuffer,
              audioBase64: wavBuffer.toString('base64'),
              contentType: 'audio/wav',
              latencyMs: Date.now() - startTime,
              modelUsed: 'gemini-2.5-flash-tts',
              isMockFallback: false,
            };
          }
        }
      } catch (e) {
        console.warn('[ElevenLabsService] Gemini TTS fallback failed:', e);
      }
    }

    // Elegant fallback: Generate a lightweight 1-second silent/chime WAV buffer so client audio players don't crash
    const mockWavBuffer = this.generateFallbackPcmWav();
    return {
      audioBuffer: mockWavBuffer,
      audioBase64: mockWavBuffer.toString('base64'),
      contentType: 'audio/wav',
      latencyMs: Date.now() - startTime,
      modelUsed: 'mock-offline-flash-tts',
      isMockFallback: true,
    };
  }

  /**
   * Converts raw 16-bit Mono Linear PCM into standard playable WAV format
   */
  private pcmToWavBuffer(pcmBase64: string, sampleRate: number = 24000): Buffer {
    const pcmBuffer = Buffer.from(pcmBase64, 'base64');
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
    const blockAlign = (numChannels * bitsPerSample) / 8;
    const dataSize = pcmBuffer.length;
    const header = Buffer.alloc(44);

    header.write('RIFF', 0);
    header.writeUInt32LE(36 + dataSize, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20); // PCM
    header.writeUInt16LE(numChannels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);

    return Buffer.concat([header, pcmBuffer]);
  }

  /**
   * Generates a valid 16-bit 44.1kHz PCM WAV buffer (short pleasant feedback tone)
   */
  private generateFallbackPcmWav(): Buffer {
    const sampleRate = 22050;
    const durationSec = 0.4;
    const numSamples = Math.floor(sampleRate * durationSec);
    const byteLength = 44 + numSamples * 2;
    const buffer = Buffer.alloc(byteLength);

    // RIFF header
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(byteLength - 8, 4);
    buffer.write('WAVE', 8);

    // fmt subchunk
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16); // subchunk1size (16 for PCM)
    buffer.writeUInt16LE(1, 20); // audioFormat (1 = PCM)
    buffer.writeUInt16LE(1, 22); // numChannels (1 = Mono)
    buffer.writeUInt32LE(sampleRate, 24); // sampleRate
    buffer.writeUInt32LE(sampleRate * 2, 28); // byteRate
    buffer.writeUInt16LE(2, 32); // blockAlign
    buffer.writeUInt16LE(16, 34); // bitsPerSample

    // data subchunk
    buffer.write('data', 36);
    buffer.writeUInt32LE(numSamples * 2, 40);

    // Simple decaying sine wave tone (440Hz A note)
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const decay = Math.exp(-4 * t);
      const sample = Math.sin(2 * Math.PI * 440 * t) * decay * 12000;
      buffer.writeInt16LE(Math.floor(sample), 44 + i * 2);
    }

    return buffer;
  }
}

export const elevenLabsService = new ElevenLabsService();
