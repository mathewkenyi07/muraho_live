'use client';

import React, { useState } from 'react';
import { MoMoPaymentData } from '@/lib/types';
import { PhoneCall, Copy, Check, X, QrCode, Smartphone, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';

interface MoMoModalProps {
  paymentData: MoMoPaymentData | null;
  isOpen: boolean;
  onClose: () => void;
}

export const MoMoModal: React.FC<MoMoModalProps> = ({
  paymentData,
  isOpen,
  onClose,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedUSSD, setCopiedUSSD] = useState(false);
  const [isSimulatingSuccess, setIsSimulatingSuccess] = useState(false);

  if (!isOpen || !paymentData) return null;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(paymentData.merchantCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCopyUSSD = async () => {
    try {
      await navigator.clipboard.writeText(paymentData.ussdString);
      setCopiedUSSD(true);
      setTimeout(() => setCopiedUSSD(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDial = () => {
    // Mobile tel protocol with encoded hash '%23'
    // Standard Rwandan MoMo Pay string: *182*8*1*CODE#
    const dialString = paymentData.ussdString.replace(/#/g, '%23');
    window.location.href = `tel:${dialString}`;
  };

  const triggerCelebration = () => {
    setIsSimulatingSuccess(true);
    confetti({
      particleCount: 60,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#FBBF24', '#F59E0B', '#10B981', '#3B82F6'],
    });
    setTimeout(() => {
      setIsSimulatingSuccess(false);
      onClose();
    }, 2200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-sm rounded-3xl bg-zinc-900/95 border border-amber-500/30 p-6 shadow-2xl shadow-amber-500/10 text-white overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Yellow-Gold MTN MoMo Accent Ribbon */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600" />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-amber-500 flex items-center justify-center text-zinc-950 font-black shadow-lg shadow-amber-500/20">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-base tracking-tight text-white">
                MTN MoMoPay
              </span>
              <span className="text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">
                Rwanda
              </span>
            </div>
            <p className="text-xs text-zinc-400">1-Tap Dial or Code Copy</p>
          </div>
        </div>

        {/* Merchant & Amount card */}
        <div className="p-4 rounded-2xl bg-black/50 border border-white/5 mb-4 text-center">
          <p className="text-xs text-zinc-400 uppercase tracking-wider font-medium">
            Merchant / Payee
          </p>
          <h3 className="text-lg font-bold text-white mt-0.5">
            {paymentData.merchantName}
          </h3>
          {paymentData.itemDescription && (
            <p className="text-xs text-zinc-400 mt-0.5 italic">
              {paymentData.itemDescription}
            </p>
          )}

          <div className="mt-3 pt-3 border-t border-white/10 flex items-baseline justify-center gap-1.5">
            <span className="text-xs text-amber-400 font-bold uppercase">RWF</span>
            <span className="text-3xl font-extrabold tracking-tight text-white">
              {paymentData.amountRwf.toLocaleString()}
            </span>
          </div>
        </div>

        {/* USSD Box */}
        <div className="mb-4">
          <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
            Dial Code String
          </div>
          <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/80 border border-zinc-700/80 font-mono text-sm text-amber-300">
            <span>{paymentData.ussdString}</span>
            <button
              onClick={handleCopyUSSD}
              className="p-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white transition-colors flex items-center gap-1 text-xs"
              title="Copy USSD string"
            >
              {copiedUSSD ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[11px] text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span className="text-[11px]">Copy</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Merchant Code Box */}
        <div className="mb-5 flex items-center justify-between p-3 rounded-xl bg-zinc-800/40 border border-white/5 text-xs text-zinc-300">
          <div>
            <span className="text-zinc-500 block text-[10px] uppercase tracking-wider">
              Merchant Code Only
            </span>
            <span className="font-bold text-sm text-white tracking-widest font-mono">
              {paymentData.merchantCode}
            </span>
          </div>
          <button
            onClick={handleCopyCode}
            className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
            title="Copy merchant code"
          >
            {copiedCode ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex flex-col gap-2.5">
          <button
            onClick={handleDial}
            className="w-full py-3.5 px-4 rounded-xl font-bold text-sm text-zinc-950 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 active:scale-[0.98] transition-all duration-150 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
          >
            <PhoneCall className="w-4 h-4" />
            <span>Launch USSD Dialer (*182#)</span>
          </button>

          <button
            onClick={triggerCelebration}
            disabled={isSimulatingSuccess}
            className="w-full py-2.5 px-3 rounded-xl font-medium text-xs text-zinc-300 bg-zinc-800 hover:bg-zinc-700/80 active:scale-[0.98] border border-white/5 transition-all flex items-center justify-center gap-1.5"
          >
            {isSimulatingSuccess ? (
              <>
                <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
                <span>Simulating Payment Confirmation...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Simulate MoMo Payment Success</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
