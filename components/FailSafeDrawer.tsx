'use client';

import React from 'react';
import { FailSafeScenario } from '@/lib/types';
import { Bike, ShoppingBag, Utensils, Zap, ChevronUp, ChevronDown, CheckCircle2 } from 'lucide-react';

export const DEMO_SCENARIOS: FailSafeScenario[] = [
  {
    id: 'moto-ride',
    title: 'Moto Taxi to Downtown',
    category: 'moto',
    icon: 'bike',
    shortDesc: 'Bargain fare to Nyabugogo / CBD & enforce helmet check',
    userPrompt: 'Ndashaka kujya Nyabugogo. Ni angahe?',
    simulatedResponse: {
      text: 'I want to go to Nyabugogo. The fair standard fare is around 1,000 to 1,500 RWF. Always inspect the passenger helmet before mounting!',
      kinyarwanda: 'Ndajya Nyabugogo. Mpa igihumbi (1,000 RWF). Nshobora kubona ingofero?',
      translation: 'I am going to Nyabugogo. Give me 1,000 RWF. Can I have the helmet?',
      audioText: 'Ndajya Nyabugogo. Mpa igihumbi. Reba niba ufite ingofero yisukuye mbere yo kwicara.',
      culturalAlert: {
        id: 'safety-helmet-alert',
        type: 'safety',
        title: 'Rwanda Police Helmet Regulation',
        description: 'Wearing a securely fastened helmet is strictly enforced by Rwanda National Police. You may also request a hygiene hairnet.',
        badge: 'Safety First',
        urgency: 'high',
        kinyarwandaPhrase: 'Mfasha kumpa ingofero yisukuye',
        translation: 'Please provide a clean helmet',
      },
      momoData: {
        merchantCode: '891024',
        merchantName: 'Jean Bosco (Moto Taxi)',
        amountRwf: 1200,
        itemDescription: 'Moto Ride: Kacyiru to Nyabugogo',
        ussdString: '*182*8*1*891024*1200#',
      },
    },
  },
  {
    id: 'kimironko-market',
    title: 'Kimironko Market Bargaining',
    category: 'market',
    icon: 'shopping-bag',
    shortDesc: 'Negotiate fresh passion fruit (Maracuja) & avocados',
    userPrompt: 'Aba maracuja n’amavoka biragura bite?',
    simulatedResponse: {
      text: 'At Kimironko Market, polite smiling negotiation is customary. For 1kg of passion fruit and 2 avocados, expect around 2,500 RWF total.',
      kinyarwanda: 'Gabanyaho gake se, ndagura byinshi!',
      translation: 'Can you reduce the price a little, I am buying in bulk!',
      audioText: 'Komeza useke ubwire umucuruzi uti: Gabanyaho gake se ndagura byinshi. Igiciro gikwiye ni ibihumbi bibiri na magana atanu.',
      culturalAlert: {
        id: 'market-etiquette-alert',
        type: 'etiquette',
        title: 'Kimironko Bargaining Etiquette',
        description: 'Greet warmly with "Muraho" first before haggling. Never argue aggressively; a warm, cheerful tone always earns the local rate.',
        badge: 'Cultural Tip',
        urgency: 'medium',
        kinyarwandaPhrase: 'Muraho neza, gabanyaho make',
        translation: 'Hello, please offer a gentle discount',
      },
      momoData: {
        merchantCode: '455120',
        merchantName: 'Mama Claudine Fruits (Kimironko)',
        amountRwf: 2500,
        itemDescription: '1kg Maracuja & 3 Ripe Hass Avocados',
        ussdString: '*182*8*1*455120*2500#',
      },
    },
  },
  {
    id: 'brochettes-order',
    title: 'Brochettes & Akabanga at Pub',
    category: 'food',
    icon: 'utensils',
    shortDesc: 'Order goat brochettes with grilled plantains (Ibirayi)',
    userPrompt: 'Ndashaka ihene ebyiri n’ibirayi',
    simulatedResponse: {
      text: 'Ordering legendary Rwandan goat brochettes with roasted potatoes! Goat brochettes typically take 25-35 minutes fresh off the charcoal grill.',
      kinyarwanda: 'Mpa ziriya z’ihene ebyiri n’ibirayi, ushireho n’Akabanga gake.',
      translation: 'Give me two goat brochettes with potatoes, and bring some Akabanga chili.',
      audioText: 'Mpa ziriya zihene ebyiri nibirayi, ushireho nAkabanga gake. Ziratinda gato kuko zitekwa ako kanya.',
      culturalAlert: {
        id: 'akabanga-warning',
        type: 'tip',
        title: 'Akabanga Chili Dropper',
        description: 'Akabanga scotch bonnet chili oil is potent! Apply just 1 or 2 small drops directly to your fork or meat, never pour freely.',
        badge: 'Local Flavor',
        urgency: 'low',
        kinyarwandaPhrase: 'Ndashaka Akabanga gusa',
        translation: 'I just need the Akabanga chili dropper',
      },
      momoData: {
        merchantCode: '109923',
        merchantName: 'Chez Lando Lounge & Brochettes',
        amountRwf: 4500,
        itemDescription: '2 Goat Skewers + Roasted Potatoes + Virunga Water',
        ussdString: '*182*8*1*109923*4500#',
      },
    },
  },
];

interface FailSafeDrawerProps {
  isOpen: boolean;
  onToggle: () => void;
  onSelectScenario: (scenario: FailSafeScenario) => void;
  activeScenarioId?: string | null;
}

export const FailSafeDrawer: React.FC<FailSafeDrawerProps> = ({
  isOpen,
  onToggle,
  onSelectScenario,
  activeScenarioId,
}) => {
  const getIcon = (category: string) => {
    switch (category) {
      case 'moto':
        return <Bike className="w-5 h-5 text-amber-400" />;
      case 'market':
        return <ShoppingBag className="w-5 h-5 text-emerald-400" />;
      case 'food':
      default:
        return <Utensils className="w-5 h-5 text-rose-400" />;
    }
  };

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-40 transition-all duration-300 ease-in-out ${
        isOpen ? 'translate-y-0' : 'translate-y-[calc(100%-48px)]'
      }`}
    >
      <div className="max-w-xl mx-auto px-4">
        {/* Drawer container */}
        <div className="rounded-t-3xl bg-zinc-900/95 backdrop-blur-2xl border-t border-x border-zinc-800 shadow-[0_-10px_35px_rgba(0,0,0,0.7)] text-white overflow-hidden">
          {/* Grab handle & toggle header */}
          <button
            onClick={onToggle}
            className="w-full h-12 flex items-center justify-between px-5 bg-zinc-800/60 hover:bg-zinc-800/90 transition-colors select-none"
            aria-label="Toggle Fail-Safe scenarios drawer"
          >
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                Acoustic Fail-Safe & Judge Scenarios
              </span>
              <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-mono">
                3 Scenarios
              </span>
            </div>

            <div className="flex items-center text-zinc-400">
              {isOpen ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronUp className="w-4 h-4" />
              )}
            </div>
          </button>

          {/* Drawer content list */}
          <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            {DEMO_SCENARIOS.map((scenario) => {
              const isCurrent = activeScenarioId === scenario.id;
              return (
                <button
                  key={scenario.id}
                  onClick={() => {
                    onSelectScenario(scenario);
                  }}
                  className={`relative text-left p-3.5 rounded-2xl border transition-all duration-200 group flex flex-col justify-between ${
                    isCurrent
                      ? 'bg-amber-500/10 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                      : 'bg-zinc-800/40 border-zinc-700/50 hover:bg-zinc-800/80 hover:border-zinc-600'
                  }`}
                >
                  {isCurrent && (
                    <div className="absolute top-2 right-2">
                      <CheckCircle2 className="w-4 h-4 text-amber-400" />
                    </div>
                  )}

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-2 rounded-xl bg-black/40 border border-white/5">
                        {getIcon(scenario.category)}
                      </div>
                      <span className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors">
                        {scenario.title}
                      </span>
                    </div>

                    <p className="text-[11px] leading-tight text-zinc-400">
                      {scenario.shortDesc}
                    </p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-zinc-400">
                    <span className="italic font-mono truncate max-w-[150px]">
                      &ldquo;{scenario.userPrompt}&rdquo;
                    </span>
                    <span className="font-semibold text-amber-400 group-hover:underline">
                      Run ➔
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="px-5 py-2.5 bg-black/40 border-t border-white/5 flex items-center justify-between text-[11px] text-zinc-500">
            <span>Instant fail-safe fallback when acoustic noise or WiFi is low.</span>
            <span className="text-zinc-400 font-mono">Muraho Core v1.0</span>
          </div>
        </div>
      </div>
    </div>
  );
};
