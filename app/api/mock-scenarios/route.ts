import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let base64Audio = '';
    let mimeType = 'audio/webm';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('audio') as File | null;
      if (!file) {
        return NextResponse.json({ error: 'Audio file is required' }, { status: 400 });
      }
      mimeType = file.type || 'audio/webm';
      const arrayBuffer = await file.arrayBuffer();
      base64Audio = Buffer.from(arrayBuffer).toString('base64');
    } else {
      const body = await req.json();
      base64Audio = body.audioBase64 || body.audio;
      mimeType = body.mimeType || 'audio/webm';
    }

    if (!base64Audio) {
      return NextResponse.json({ error: 'No audio data received' }, { status: 400 });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
    }
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;

    const payload = {
      contents: [{
        parts: [
          { text: 'Transcribe the spoken words from this audio recording accurately. Return JSON format: {"transcription": "<exact spoken text>"}. If only background noise or silence is heard, return {"transcription": ""}.' },
          { inlineData: { mimeType, data: base64Audio } }
        ]
      }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      }
    };

    const res = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json();
      const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (textResponse) {
        try {
          const parsed = JSON.parse(textResponse);
          return NextResponse.json({
            success: true,
            text: (parsed.transcription || '').trim(),
            model: 'gemini-2.5-flash-transcribe'
          });
        } catch {
          return NextResponse.json({
            success: true,
            text: textResponse.trim(),
            model: 'gemini-2.5-flash-transcribe'
          });
        }
      }
    }

    return NextResponse.json({ success: true, text: '' });
  } catch (err: any) {
    console.error('[API /transcribe] Transcription error:', err);
    return NextResponse.json({ error: 'Transcription failed', details: err?.message || String(err) }, { status: 500 });
  }
}

