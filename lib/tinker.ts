/**
 * Tinker LoRA Adapter & Prompt Orchestrator for Kigali Street Vernacular
 * Handles prompt shaping for Kinyarwanda moto-taxi dialogue, slang insertion,
 * and calling the Tinker fine-tuned model or fallback heuristic engine.
 */

import kigaliData from '../data/kigali_pairs.json';

export interface TinkerTranslateRequest {
  text: string;
  sourceLang: 'en' | 'rw';
  targetLang: 'en' | 'rw';
  style?: 'street' | 'polite' | 'formal';
  context?: {
    origin?: string;
    destination?: string;
    currentFareOffer?: number;
    benchmarkFare?: number;
  };
}

export interface TinkerTranslateResponse {
  translatedText: string;
  vernacularText?: string;
  detectedSlang: string[];
  suggestedAction?: 'counter_offer' | 'accept_fare' | 'ask_helmet' | 'request_momo';
  modelUsed: string;
  latencyMs: number;
}

export class TinkerClient {
  private apiKey?: string;
  private endpoint: string;

  constructor(apiKey?: string, endpoint: string = 'https://api.tinker.run/v1/generate') {
    this.apiKey = apiKey || process.env.TINKER_API_KEY;
    this.endpoint = endpoint;
  }

  /**
   * Orchestrate translation and Kigali vernacular styling
   */
  async translateAndStyle(req: TinkerTranslateRequest): Promise<TinkerTranslateResponse> {
    const startTime = Date.now();
    const style = req.style || 'street';

    // If live API key is configured, call Tinker LoRA adapter endpoint
    if (this.apiKey) {
      try {
        const prompt = this.buildTinkerPrompt(req);
        const res = await fetch(this.endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'tinker-kinyarwanda-kigali-lora-v1',
            prompt,
            temperature: 0.3,
            max_tokens: 150,
          }),
        });

        if (res.ok) {
          const json = await res.json();
          const generated = json.choices?.[0]?.text?.trim() || json.output?.trim();
          if (generated) {
            return {
              translatedText: generated,
              vernacularText: generated,
              detectedSlang: this.extractSlang(generated),
              modelUsed: 'tinker-lora-badrex-adapter',
              latencyMs: Date.now() - startTime,
            };
          }
        }
      } catch (err) {
        console.warn('[TinkerClient] External call failed, falling back to local orchestrator:', err);
      }
    }

    // Real-time live translation for ANY arbitrary English or Kinyarwanda input
    try {
      const sl = req.sourceLang;
      const tl = req.targetLang;
      const gtxUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(req.text.trim())}`;
      const gtxRes = await fetch(gtxUrl, { cache: 'no-store' });
      if (gtxRes.ok) {
        const data = await gtxRes.json();
        const translated: string = data[0]?.map((item: any) => item[0]).join('') || '';
        if (translated) {
          const vernacular = this.embellishWithVernacular(translated, req.text);
          return {
            translatedText: translated,
            vernacularText: vernacular,
            detectedSlang: this.extractSlang(vernacular),
            modelUsed: 'live-neural-translator',
            latencyMs: Date.now() - startTime,
          };
        }
      }
    } catch (e) {
      console.warn('[TinkerClient] Live translation API error, checking fallback pairs:', e);
    }

    // Heuristic Kigali Street Vernacular Fallback Engine
    const fallbackResult = this.generateFallbackVernacular(req);
    return {
      ...fallbackResult,
      latencyMs: Date.now() - startTime,
    };
  }

  private embellishWithVernacular(translation: string, original: string): string {
    const origLower = original.toLowerCase();
    // Add natural vernacular touch if transit or informal
    if (origLower.includes('please') && !translation.toLowerCase().includes('murakoze')) {
      return `${translation}, murakoze`;
    }
    return translation;
  }

  private buildTinkerPrompt(req: TinkerTranslateRequest): string {
    return `### Instruction: You are an expert Kigali street moto-taxi translator and cultural mediator.
Translate between English and everyday Kigali street Kinyarwanda vernacular (incorporating 'motari', 'wangu', 'kabisa', 'sawa sawa', etc.).
Source language: ${req.sourceLang}
Target language: ${req.targetLang}
Context: origin=${req.context?.origin || 'unknown'}, destination=${req.context?.destination || 'unknown'}, fare=${req.context?.currentFareOffer || 'none'}
Input: "${req.text}"
Output (natural Kigali response):`;
  }

  private extractSlang(text: string): string[] {
    const found: string[] = [];
    const textLower = text.toLowerCase();
    const lexicon = kigaliData.slang_lexicon as Record<string, string>;

    for (const word of Object.keys(lexicon)) {
      if (textLower.includes(word.toLowerCase())) {
        found.push(`${word} (${lexicon[word]})`);
      }
    }
    return found;
  }

  private generateFallbackVernacular(req: TinkerTranslateRequest): Omit<TinkerTranslateResponse, 'latencyMs'> {
    const input = req.text.trim();
    const inputLower = input.toLowerCase();

    // Check seed dialogue pairs in kigali_pairs.json
    for (const pair of kigaliData.dialogue_pairs) {
      if (
        req.sourceLang === 'en' &&
        pair.english_translation.toLowerCase().includes(inputLower)
      ) {
        return {
          translatedText: pair.kinyarwanda_standard,
          vernacularText: pair.kinyarwanda_vernacular,
          detectedSlang: this.extractSlang(pair.kinyarwanda_vernacular),
          suggestedAction: pair.category === 'counter_offer' ? 'counter_offer' : undefined,
          modelUsed: 'tinker-seed-orchestrator',
        };
      }
      if (
        req.sourceLang === 'rw' &&
        (pair.kinyarwanda_vernacular.toLowerCase().includes(inputLower) ||
          pair.kinyarwanda_standard.toLowerCase().includes(inputLower))
      ) {
        return {
          translatedText: pair.english_translation,
          vernacularText: pair.kinyarwanda_vernacular,
          detectedSlang: this.extractSlang(pair.kinyarwanda_vernacular),
          modelUsed: 'tinker-seed-orchestrator',
        };
      }
    }

    // Pattern matching heuristics for common Kigali transit phrases
    if (req.sourceLang === 'en') {
      if (inputLower.includes('how much') || inputLower.includes('price') || inputLower.includes('fare')) {
        const dest = req.context?.destination || 'KCC';
        return {
          translatedText: `Kugera ${dest} ni angahe? Mpa igiciro kizima.`,
          vernacularText: `Motari wangu, kugeza ${dest} ni bingahe? Igiciro cyiza kabisa.`,
          detectedSlang: ['motari (Motorcycle taxi operator in Rwanda)', 'wangu (My friend / buddy)', 'kabisa (Totally / absolutely)'],
          suggestedAction: 'counter_offer',
          modelUsed: 'tinker-heuristic-v1',
        };
      }

      if (inputLower.includes('too expensive') || inputLower.includes('high') || inputLower.includes('cut') || inputLower.includes('reduce')) {
        const price = req.context?.benchmarkFare || 1200;
        return {
          translatedText: `Birakabije cyane! Mpa igiciro cya ${price} RWF tugende.`,
          vernacularText: `Ibyo birakabije kabisa! Fata ${price} RWF tereka ingofero twigendere wangu.`,
          detectedSlang: ['kabisa (Totally / absolutely)', 'ingofero (Passenger helmet)', 'wangu (My friend)'],
          suggestedAction: 'counter_offer',
          modelUsed: 'tinker-heuristic-v1',
        };
      }

      if (inputLower.includes('deal') || inputLower.includes('agreed') || inputLower.includes('ok') || inputLower.includes('let\'s go')) {
        return {
          translatedText: `Ni byiza, mpa ingofero tugende.`,
          vernacularText: `Sawa sawa, tereka ingofero tugende ntwike ikirere!`,
          detectedSlang: ['sawa sawa (All good / agreed)', 'ingofero (Passenger helmet)', 'gutwika (Cruising fast / exciting)'],
          suggestedAction: 'ask_helmet',
          modelUsed: 'tinker-heuristic-v1',
        };
      }

      if (inputLower.includes('momo') || inputLower.includes('mobile money') || inputLower.includes('pay')) {
        return {
          translatedText: `Ndashaka kwishyura ukoresheje Mobile Money.`,
          vernacularText: `Ufite nomero ya MoMo (MTN) cyangwa nishyure kashi?`,
          detectedSlang: ['MoMo (MTN Mobile Money)', 'kashi (Cash money)'],
          suggestedAction: 'request_momo',
          modelUsed: 'tinker-heuristic-v1',
        };
      }

      if (inputLower.includes('slow down') || inputLower.includes('careful') || inputLower.includes('fast')) {
        return {
          translatedText: `Gabanya umuvuduko witondere umuhanda.`,
          vernacularText: `Motari gabanya umuvuduko gatoya wangu, twitondere ikirere!`,
          detectedSlang: ['motari (Motorcycle taxi)', 'wangu (My friend)'],
          modelUsed: 'tinker-heuristic-v1',
        };
      }

      // Default translation to Kigali conversational Kinyarwanda
      return {
        translatedText: `Muraho, ${input}`,
        vernacularText: `Bite wangu, ${input} sawa kabisa?`,
        detectedSlang: ['wangu (My friend)', 'kabisa (Totally)'],
        modelUsed: 'tinker-heuristic-v1',
      };
    } else {
      // Kinyarwanda to English heuristics
      if (inputLower.includes('igihumbi') || inputLower.includes('1000') || inputLower.includes('2000') || inputLower.includes('1500')) {
        return {
          translatedText: `The driver is stating their fare offer: "${input}". They want to negotiate.`,
          vernacularText: input,
          detectedSlang: this.extractSlang(input),
          suggestedAction: 'counter_offer',
          modelUsed: 'tinker-heuristic-v1',
        };
      }

      if (inputLower.includes('sawa') || inputLower.includes('urakoze') || inputLower.includes('yego')) {
        return {
          translatedText: `Agreed! The motari accepted the ride and is ready.`,
          vernacularText: input,
          detectedSlang: this.extractSlang(input),
          suggestedAction: 'ask_helmet',
          modelUsed: 'tinker-heuristic-v1',
        };
      }

      return {
        translatedText: `Motari says: "${input}".`,
        vernacularText: input,
        detectedSlang: this.extractSlang(input),
        modelUsed: 'tinker-heuristic-v1',
      };
    }
  }
}

export const tinkerClient = new TinkerClient();
