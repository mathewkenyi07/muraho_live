import { NextRequest, NextResponse } from 'next/server';
import { browserbaseFareService } from '@/lib/browserbase';
import kigaliData from '@/data/kigali_pairs.json';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const origin = searchParams.get('origin');
    const destination = searchParams.get('destination');

    // If both origin and destination provided, compute fare benchmark
    if (origin && destination) {
      const fare = await browserbaseFareService.getFareBenchmark(origin, destination);
      return NextResponse.json({
        success: true,
        fare,
      });
    }

    // Otherwise return list of supported Kigali landmarks and fare matrix
    return NextResponse.json({
      success: true,
      landmarks: kigaliData.landmarks,
      matrix: kigaliData.fare_matrix,
    });
  } catch (err: any) {
    console.error('[API /fares] Error:', err);
    return NextResponse.json(
      { error: 'Failed to retrieve fare benchmark', details: err?.message || String(err) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { origin, destination } = body;

    if (!origin || !destination) {
      return NextResponse.json(
        { error: 'Both origin and destination are required' },
        { status: 400 }
      );
    }

    const fare = await browserbaseFareService.getFareBenchmark(origin, destination);
    return NextResponse.json({
      success: true,
      fare,
    });
  } catch (err: any) {
    console.error('[API /fares POST] Error:', err);
    return NextResponse.json(
      { error: 'Failed to calculate fare', details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
