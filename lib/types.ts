export type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

export interface CulturalAlert {
  id: string;
  type: 'fare' | 'etiquette' | 'safety' | 'tip';
  title: string;
  description: string;
  kinyarwandaPhrase?: string;
  translation?: string;
  badge?: string;
  urgency?: 'low' | 'medium' | 'high';
  timestamp?: number;
}

export interface MoMoPaymentData {
  merchantCode: string;
  merchantName: string;
  amountRwf: number;
  itemDescription?: string;
  ussdString: string; // e.g. *182*8*1*CODE*AMOUNT# or *182*8*1*CODE#
}

export interface TranscriptMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  text: string;
  kinyarwandaSnippet?: string;
  translationSnippet?: string;
  timestamp: string;
}

export interface FailSafeScenario {
  id: string;
  title: string;
  category: 'moto' | 'market' | 'food';
  icon: string;
  shortDesc: string;
  userPrompt: string;
  simulatedResponse: {
    text: string;
    kinyarwanda: string;
    translation: string;
    audioText: string;
    culturalAlert?: CulturalAlert;
    momoData?: MoMoPaymentData;
  };
}
