import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "muraho-voice",
      version: "1.0.0",
      region: "kigali-rwanda",
      timestamp: new Date().toISOString(),
      sponsors: {
        elevenlabs: Boolean(process.env.ELEVENLABS_API_KEY),
        digitalocean: Boolean(process.env.DIGITALOCEAN_HOST),
        tinker: Boolean(process.env.TINKER_API_KEY),
        backboard: Boolean(process.env.BACKBOARD_API_KEY),
        browserbase: Boolean(process.env.BROWSERBASE_API_KEY),
        paperInstruments: Boolean(process.env.PAPER_INSTRUMENTS_API_KEY),
        gemini: Boolean(process.env.GEMINI_API_KEY),
        groq: Boolean(process.env.GROQ_API_KEY),
      },
    },
    { status: 200 }
  );
}
