import { NextRequest, NextResponse } from 'next/server';
import { tinkerClient } from '@/lib/tinker';
import { backboardClient } from '@/lib/backboard';
import { paperInstrumentsGuardrails } from '@/lib/paper_instruments';
import { browserbaseFareService } from '@/lib/browserbase';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      text,
      sourceLang = 'en',
      targetLang = 'rw',
      sessionId = 'default-session',
      speaker = 'user',
      origin,
      destination,
      proposedPrice,
    } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Text prompt is required' }, { status: 400 });
    }

    // 1. Ultramarine Safety & Cultural Guardrails (Paper Instruments)
    const guardrailResult = await paperInstrumentsGuardrails.evaluate(text, sourceLang);
    if (guardrailResult.isEmergency) {
      return NextResponse.json({
        guardrailTriggered: true,
        emergency: true,
        emergencyType: guardrailResult.emergencyType,
        message: 'EMERGENCY_DETECTED',
        kinyarwandaEmergencyText: 'Hagarara hano vuba! Nkeneye ubufasha bw\'imbangukiragutabara (112) cyangwa polisi.',
        reasons: guardrailResult.reasons,
        suggestedEmergencyNumber: '112',
      }, { status: 200 });
    }

    // 2. Fetch Fare Benchmark baseline if landmarks are provided (Browserbase)
    let fareBenchmark = undefined;
    if (origin && destination) {
      const fareData = await browserbaseFareService.getFareBenchmark(origin, destination);
      fareBenchmark = fareData.motoFairRwf;
    }

    // 3. Translate and inject Kigali street vernacular (Tinker LoRA orchestration)
    const tinkerResult = await tinkerClient.translateAndStyle({
      text: guardrailResult.cleanedText,
      sourceLang,
      targetLang,
      context: {
        origin,
        destination,
        currentFareOffer: proposedPrice,
        benchmarkFare: fareBenchmark,
      },
    });

    // 4. Update session bargaining memory (Backboard)
    const updatedSession = await backboardClient.recordTurn(
      sessionId,
      {
        speaker,
        text,
        kinyarwanda: tinkerResult.vernacularText || tinkerResult.translatedText,
        proposedPrice: proposedPrice ? Number(proposedPrice) : undefined,
        timestamp: new Date().toISOString(),
      },
      {
        origin,
        destination,
        benchmark: fareBenchmark,
      }
    );

    return NextResponse.json({
      success: true,
      originalText: text,
      translatedText: tinkerResult.translatedText,
      vernacularText: tinkerResult.vernacularText,
      detectedSlang: tinkerResult.detectedSlang,
      suggestedAction: tinkerResult.suggestedAction,
      culturalWarning: guardrailResult.culturalWarning,
      modelUsed: tinkerResult.modelUsed,
      latencyMs: tinkerResult.latencyMs,
      session: updatedSession,
    });
  } catch (err: any) {
    console.error('[API /translate] Error processing request:', err);
    return NextResponse.json(
      { error: 'Translation processing failed', details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
