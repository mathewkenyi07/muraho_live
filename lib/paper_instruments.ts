/**
 * Paper Instruments (Ultramarine) Cultural & Safety Guardrails
 * Provides safety boundary validation, emergency detection (medical, police),
 * and cultural etiquette checks for Kigali transit negotiations.
 */

export interface GuardrailCheckResult {
  passed: boolean;
  isEmergency: boolean;
  emergencyType?: 'medical' | 'police' | 'fire' | 'harassment';
  culturalWarning?: string;
  suggestedAction?: 'emergency_dial' | 'rephrase_respectfully' | 'proceed';
  cleanedText: string;
  reasons: string[];
}

export class PaperInstrumentsGuardrails {
  private apiKey?: string;
  private endpoint: string;

  constructor(apiKey?: string, endpoint: string = 'https://api.paperinstruments.com/v1/ultramarine/validate') {
    this.apiKey = apiKey || process.env.PAPER_INSTRUMENTS_API_KEY || process.env.ULTRAMARINE_API_KEY;
    this.endpoint = endpoint;
  }

  /**
   * Run full cultural & safety evaluation on text before or after translation
   */
  async evaluate(text: string, language: 'en' | 'rw' = 'en'): Promise<GuardrailCheckResult> {
    // Check Paper Instruments Ultramarine remote API if key provided
    if (this.apiKey) {
      try {
        const res = await fetch(this.endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text,
            language,
            context: 'east_africa_transit_safety',
            policies: ['emergency_detection', 'cultural_deescalation', 'respectful_bargaining'],
          }),
        });

        if (res.ok) {
          const remoteResult = await res.json();
          return remoteResult;
        }
      } catch (err) {
        console.warn('[PaperInstruments] Remote validation failed, using internal Ultramarine rules:', err);
      }
    }

    // Heuristic Ultramarine rule engine
    return this.evaluateLocalRules(text, language);
  }

  private evaluateLocalRules(text: string, language: 'en' | 'rw'): GuardrailCheckResult {
    const textLower = text.toLowerCase();
    const reasons: string[] = [];

    // 1. Emergency detection (Ambulance 112/912, Police 112)
    const medicalKeywords = ['ambulance', 'imbangukiragutabara', 'ibitaro', 'hospital', 'bleeding', 'accident', 'injured', 'kugwa'];
    const policeKeywords = ['police', 'polisi', 'thief', 'igisambo', 'robbery', 'attacked', 'threat', 'danger', 'akaga'];

    const isMedical = medicalKeywords.some((w) => textLower.includes(w));
    const isPolice = policeKeywords.some((w) => textLower.includes(w));

    if (isMedical || isPolice) {
      const emergencyType = isMedical ? 'medical' : 'police';
      reasons.push(`Emergency signal detected: ${emergencyType.toUpperCase()}`);
      return {
        passed: false,
        isEmergency: true,
        emergencyType,
        suggestedAction: 'emergency_dial',
        cleanedText: text,
        reasons,
      };
    }

    // 2. Cultural Etiquette & Aggressive bargaining guardrails
    // In Rwandan culture, extreme public shouting, insults, or derogatory names toward drivers can escalate situations.
    const aggressiveWords = ['idiot', 'stupid', 'imbwa', 'gupfa', 'scammer', 'thief', 'shut up'];
    const hasAggressive = aggressiveWords.some((w) => textLower.includes(w));

    if (hasAggressive) {
      reasons.push('Harsh confrontational language detected. Rwandan bargaining works best with respectful wit (e.g. "Mpa igiciro kizima bro").');
      return {
        passed: true, // Allow conversation to proceed but with warning
        isEmergency: false,
        culturalWarning: 'Tone recommendation: Motaris in Kigali respond much more favorably to calm, humorous banter rather than direct hostility.',
        suggestedAction: 'rephrase_respectfully',
        cleanedText: this.sanitizeText(text),
        reasons,
      };
    }

    // 3. Helmet & Legal regulation reminder
    if (textLower.includes('no helmet') || textLower.includes('nta ngofero')) {
      reasons.push('Safety violation: Helmets (ingofero) are strictly mandatory by Rwandan National Police.');
      return {
        passed: true,
        isEmergency: false,
        culturalWarning: 'Legal requirement: Never ride without an approved passenger helmet (ingofero). Traffic police issue strict fines.',
        suggestedAction: 'proceed',
        cleanedText: text,
        reasons,
      };
    }

    return {
      passed: true,
      isEmergency: false,
      suggestedAction: 'proceed',
      cleanedText: text,
      reasons: ['Passed cultural and safety checks.'],
    };
  }

  private sanitizeText(text: string): string {
    return text.replace(/\b(idiot|stupid|scammer)\b/gi, '[assertive]');
  }
}

export const paperInstrumentsGuardrails = new PaperInstrumentsGuardrails();
