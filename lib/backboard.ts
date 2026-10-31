/**
 * Backboard Session Memory Client
 * Tracks bargaining state, trip origin, destination, proposed and agreed fares in RWF,
 * and maintains conversational context across turns for Kigali street transit.
 */

export interface BargainingTurn {
  speaker: 'user' | 'motari';
  text: string;
  kinyarwanda: string;
  proposedPrice?: number;
  timestamp: string;
}

export interface BargainingSession {
  sessionId: string;
  origin?: string;
  destination?: string;
  initialDriverOffer?: number; // RWF
  userCounterOffer?: number; // RWF
  agreedPrice?: number; // RWF
  fairPriceBenchmark?: number; // RWF
  status: 'initial' | 'negotiating' | 'deal_agreed' | 'rejected';
  history: BargainingTurn[];
  created_at: string;
  updated_at: string;
}

// In-memory fallback session store for serverless or local testing
const inMemorySessions = new Map<string, BargainingSession>();

export class BackboardClient {
  private apiKey?: string;
  private baseUrl: string;

  constructor(apiKey?: string, baseUrl: string = 'https://api.backboard.ai/v1') {
    this.apiKey = apiKey || process.env.BACKBOARD_API_KEY;
    this.baseUrl = baseUrl;
  }

  /**
   * Get or initialize session state
   */
  async getSession(sessionId: string): Promise<BargainingSession> {
    if (this.apiKey) {
      try {
        const res = await fetch(`${this.baseUrl}/sessions/${sessionId}`, {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        });
        if (res.ok) {
          return await res.json();
        }
      } catch (err) {
        console.warn('[BackboardClient] External fetch failed, falling back to in-memory state:', err);
      }
    }

    if (!inMemorySessions.has(sessionId)) {
      const newSession: BargainingSession = {
        sessionId,
        status: 'initial',
        history: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      inMemorySessions.set(sessionId, newSession);
    }
    return inMemorySessions.get(sessionId)!;
  }

  /**
   * Update bargaining state after an exchange
   */
  async updateSession(
    sessionId: string,
    updates: Partial<Omit<BargainingSession, 'sessionId' | 'created_at'>>
  ): Promise<BargainingSession> {
    const session = await this.getSession(sessionId);

    const updatedSession: BargainingSession = {
      ...session,
      ...updates,
      history: updates.history || session.history,
      updated_at: new Date().toISOString(),
    };

    if (this.apiKey) {
      try {
        await fetch(`${this.baseUrl}/sessions/${sessionId}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatedSession),
        });
      } catch (err) {
        console.warn('[BackboardClient] Sync to remote failed, continuing with local state');
      }
    }

    inMemorySessions.set(sessionId, updatedSession);
    return updatedSession;
  }

  /**
   * Append a turn to session conversation and infer bargaining state transition
   */
  async recordTurn(
    sessionId: string,
    turn: BargainingTurn,
    landmarks?: { origin?: string; destination?: string; benchmark?: number }
  ): Promise<BargainingSession> {
    const session = await this.getSession(sessionId);
    const newHistory = [...session.history, turn];

    // Extract potential prices mentioned in text or turn
    let initialOffer = session.initialDriverOffer;
    let counterOffer = session.userCounterOffer;
    let agreedPrice = session.agreedPrice;
    let status = session.status;

    if (turn.proposedPrice) {
      if (turn.speaker === 'motari') {
        if (!initialOffer) initialOffer = turn.proposedPrice;
      } else {
        counterOffer = turn.proposedPrice;
      }
    }

    // Check deal closure keywords
    const textLower = (turn.text + ' ' + turn.kinyarwanda).toLowerCase();
    if (
      textLower.includes('sawa') ||
      textLower.includes('deal') ||
      textLower.includes('tugende') ||
      textLower.includes('ingofero') ||
      textLower.includes('tereka')
    ) {
      if (counterOffer || initialOffer) {
        agreedPrice = counterOffer || initialOffer;
        status = 'deal_agreed';
      }
    } else if (status === 'initial' && (initialOffer || counterOffer)) {
      status = 'negotiating';
    }

    return await this.updateSession(sessionId, {
      history: newHistory,
      origin: landmarks?.origin || session.origin,
      destination: landmarks?.destination || session.destination,
      fairPriceBenchmark: landmarks?.benchmark || session.fairPriceBenchmark,
      initialDriverOffer: initialOffer,
      userCounterOffer: counterOffer,
      agreedPrice,
      status,
    });
  }
}

export const backboardClient = new BackboardClient();
