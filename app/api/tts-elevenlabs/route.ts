import { NextRequest, NextResponse } from 'next/server';
import { elevenLabsService } from '@/lib/elevenlabs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, voiceId, format = 'base64' } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Text parameter is required' }, { status: 400 });
    }

    const ttsResult = await elevenLabsService.synthesizeSpeech({
      text,
      voiceId,
    });

    if (format === 'audio' && ttsResult.audioBuffer) {
      return new Response(new Uint8Array(ttsResult.audioBuffer), {
        status: 200,
        headers: {
          'Content-Type': ttsResult.contentType,
          'Content-Length': ttsResult.audioBuffer.length.toString(),
          'X-Latency-Ms': ttsResult.latencyMs.toString(),
          'X-TTS-Model': ttsResult.modelUsed,
          'X-Fallback': ttsResult.isMockFallback ? 'true' : 'false',
        },
      });
    }

    return NextResponse.json({
      success: true,
      audioBase64: ttsResult.audioBase64,
      contentType: ttsResult.contentType,
      latencyMs: ttsResult.latencyMs,
      modelUsed: ttsResult.modelUsed,
      isMockFallback: ttsResult.isMockFallback,
    });
  } catch (err: any) {
    console.error('[API /tts-elevenlabs] Error:', err);
    return NextResponse.json(
      { error: 'Speech synthesis failed', details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
