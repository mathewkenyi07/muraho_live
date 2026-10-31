import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'GEMINI_API_KEY environment variable is not configured' },
        { status: 500 }
      );
    }

    let mimeType = 'audio/webm';
    let base64Audio = '';

    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const audioFile = formData.get('file') || formData.get('audio');

      if (!audioFile || !(audioFile instanceof Blob)) {
        return NextResponse.json(
          { success: false, error: 'Audio file is required in "file" or "audio" form field' },
          { status: 400 }
        );
      }

      mimeType = audioFile.type || 'audio/webm';
      // Normalize generic mime types if empty
      if (!mimeType || mimeType === 'application/octet-stream') {
        mimeType = 'audio/webm';
      }

      const arrayBuffer = await audioFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      base64Audio = buffer.toString('base64');
    } else {
      const body = await req.json();
      base64Audio = body.audio || body.data || body.base64Audio || '';
      if (body.mimeType) {
        mimeType = body.mimeType;
      }

      if (!base64Audio) {
        return NextResponse.json(
          { success: false, error: 'Audio base64 data is required in request body' },
          { status: 400 }
        );
      }

      // Strip data url prefix if included
      if (base64Audio.includes('base64,')) {
        const parts = base64Audio.split('base64,');
        base64Audio = parts[1];
        const match = parts[0].match(/data:(.*?);/);
        if (match && match[1]) {
          mimeType = match[1];
        }
      }
    }

    const promptText =
      'You are a speech-to-text transcriber. Transcribe the spoken words from this audio. Output JSON format: {"transcription": "<spoken words>"}. If no clear speech is heard, return {"transcription": ""}';

    const modelsToTry = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.5-flash'];
    let lastError = '';
    let data: any = null;

    for (const model of modelsToTry) {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const geminiPayload = {
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: base64Audio,
                },
              },
              {
                text: promptText,
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
        },
      };

      try {
        const response = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(geminiPayload),
        });

        if (response.ok) {
          data = await response.json();
          break;
        } else {
          lastError = await response.text();
          console.warn(`[API /transcribe] Model ${model} returned error:`, lastError);
        }
      } catch (err: any) {
        lastError = err?.message || String(err);
      }
    }

    if (!data) {
      return NextResponse.json(
        { success: false, error: 'Transcription service unavailable', details: lastError },
        { status: 502 }
      );
    }
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    let transcription = '';
    if (candidateText) {
      try {
        const cleaned = candidateText.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
        const parsed = JSON.parse(cleaned);
        transcription = parsed.transcription ?? '';
      } catch (parseErr) {
        console.warn('[API /transcribe] Failed to parse JSON response from Gemini, using raw text:', candidateText);
        transcription = candidateText.trim();
      }
    }

    return NextResponse.json({
      success: true,
      text: transcription,
    });
  } catch (error: any) {
    console.error('[API /transcribe] Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'Transcription failed', details: error?.message || String(error) },
      { status: 500 }
    );
  }
}
