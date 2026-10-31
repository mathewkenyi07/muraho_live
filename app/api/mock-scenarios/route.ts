import { NextRequest, NextResponse } from 'next/server';

export interface AcousticScenario {
  id: string;
  title: string;
  description: string;
  noiseProfile: 'heavy_traffic' | 'rain_storm' | 'crowded_market';
  audioPromptUrl?: string;
  transcriptRawKinyarwanda: string;
  cleanedKinyarwanda: string;
  englishTranslation: string;
  kigaliVernacularCounter: string;
  fairBenchmarkRwf: number;
  driverOfferRwf: number;
  suggestedCounterRwf: number;
  acousticFallbackActive: boolean;
  notes: string;
}

const MOCK_SCENARIOS: Record<string, AcousticScenario> = {
  scenario_1_nyabugogo_traffic: {
    id: 'scenario_1_nyabugogo_traffic',
    title: 'Nyabugogo Bus Park - Heavy Engine & Horn Noise',
    description: 'High background decibel environment with diesel engines revving and overlapping crowd chatter.',
    noiseProfile: 'heavy_traffic',
    transcriptRawKinyarwanda: '...[ingoma/moteri]... kcc ... ibihumbi bibiri gusa wangu ...',
    cleanedKinyarwanda: 'KCC ni ibihumbi bibiri (2,000 RWF) gusa wangu.',
    englishTranslation: 'KCC is just two thousand Rwandan Francs (2,000 RWF), my friend.',
    kigaliVernacularCounter: 'Ibihumbi bibiri birakabije kabisa! Fata 1,200 RWF tereka ingofero twigendere.',
    fairBenchmarkRwf: 1200,
    driverOfferRwf: 2000,
    suggestedCounterRwf: 1200,
    acousticFallbackActive: true,
    notes: 'Acoustic filter isolates driver pitch; Tinker triggers street counter-bid with helmet prompt.',
  },
  scenario_2_kimironko_rain: {
    id: 'scenario_2_kimironko_rain',
    title: 'Kimironko Market - Heavy Tropical Downpour',
    description: 'Heavy rainfall on corrugated tin roofs and road spray muffling vocal frequencies.',
    noiseProfile: 'rain_storm',
    transcriptRawKinyarwanda: '...[imvura]... umuhanda uranyerera ... mpa igihumbi na magana atanu ...',
    cleanedKinyarwanda: 'Umuhanda uranyerera, mpa igihumbi na magana atanu (1,500 RWF).',
    englishTranslation: 'The road is slippery from rain, give me one thousand five hundred (1,500 RWF).',
    kigaliVernacularCounter: 'Sawa ndaguha 1,300 RWF ariko motari gabanya umuvuduko witondere amazi!',
    fairBenchmarkRwf: 1000,
    driverOfferRwf: 1500,
    suggestedCounterRwf: 1300,
    acousticFallbackActive: true,
    notes: 'Paper Instruments injects road safety / slippery weather advisory to reduce speed.',
  },
  scenario_3_biryogo_hail: {
    id: 'scenario_3_biryogo_hail',
    title: 'Biryogo Nyamirambo - Quick MoMo Settlement & Departure',
    description: 'Pedestrian car-free zone with street music and quick bargaining close.',
    noiseProfile: 'crowded_market',
    transcriptRawKinyarwanda: '...[umuziki]... remera ni bibiri ... ufite momo? ...',
    cleanedKinyarwanda: 'Remera ni bibiri (2,000 RWF). Ufite MoMo se?',
    englishTranslation: 'To Remera is 2,000 RWF. Do you have Mobile Money?',
    kigaliVernacularCounter: 'Fata 1,800 RWF kuri MoMo ako kanya. Tereka kode yawe!',
    fairBenchmarkRwf: 1800,
    driverOfferRwf: 2000,
    suggestedCounterRwf: 1800,
    acousticFallbackActive: true,
    notes: 'Backboard locks agreed price at 1,800 RWF and prepares MoMo merchant USSD workflow.',
  },
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const scenarioId = searchParams.get('id');

  if (scenarioId && MOCK_SCENARIOS[scenarioId]) {
    return NextResponse.json({
      success: true,
      scenario: MOCK_SCENARIOS[scenarioId],
    });
  }

  return NextResponse.json({
    success: true,
    scenarios: Object.values(MOCK_SCENARIOS),
  });
}
