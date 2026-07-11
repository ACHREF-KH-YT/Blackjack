/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { Card, Suit } from '../types';

interface CardItemProps {
  card: Card;
  index: number;
  key?: React.Key;
}

const SUIT_SYMBOLS: Record<Suit, string> = {
  hearts: '♥',
  diamonds: '♦',
  spades: '♠',
  clubs: '♣',
};

const SUIT_COLORS: Record<Suit, string> = {
  hearts: 'text-red-600',
  diamonds: 'text-red-600',
  spades: 'text-slate-900',
  clubs: 'text-slate-900',
};

export default function CardItem({ card, index }: CardItemProps) {
  const { value, suit, isRevealed } = card;

  // Face-down card styling
  if (!isRevealed) {
    return (
      <motion.div
        id={`card-back-${card.id}`}
        initial={{ scale: 0.3, y: -150, rotate: -20, opacity: 0 }}
        animate={{ scale: 1, y: 0, rotate: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 15, stiffness: 100, delay: index * 0.15 }}
        className="relative w-20 h-28 sm:w-24 sm:h-36 rounded-xl shadow-lg border border-slate-700 bg-gradient-to-br from-indigo-900 to-slate-900 flex items-center justify-center cursor-help overflow-hidden select-none"
        style={{
          boxShadow: '0 8px 16px -4px rgba(0,0,0,0.5)',
        }}
      >
        {/* Intricate pattern for card back */}
        <div className="absolute inset-1.5 rounded-lg border border-indigo-500/30 bg-indigo-950/20 flex items-center justify-center">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-indigo-400/40 flex items-center justify-center rotate-45">
            <span className="text-xl sm:text-2xl text-indigo-400/50 font-serif">♠</span>
          </div>
        </div>
      </motion.div>
    );
  }

  const isRed = suit === 'hearts' || suit === 'diamonds';

  return (
    <motion.div
      id={`card-front-${card.id}`}
      initial={{ scale: 0.3, y: -150, rotate: 15, opacity: 0 }}
      animate={{ scale: 1, y: 0, rotate: 0, opacity: 1 }}
      whileHover={{
        scale: 1.15,
        y: -14,
        rotate: -2,
        zIndex: 50,
        boxShadow: isRed 
          ? '0 20px 25px -5px rgba(244, 63, 94, 0.45), 0 0 15px rgba(244, 63, 94, 0.2)' 
          : '0 20px 25px -5px rgba(15, 23, 42, 0.6), 0 0 15px rgba(51, 65, 85, 0.3)',
      }}
      transition={{ 
        type: 'spring', 
        damping: 15, 
        stiffness: 110, 
        delay: index * 0.1
      }}
      className={`relative w-20 h-28 sm:w-24 sm:h-36 rounded-xl bg-white border border-slate-200 shadow-md flex flex-col justify-between p-2 sm:p-3 cursor-pointer select-none`}
    >
      {/* Top Left */}
      <div className="flex flex-col items-center leading-none">
        <span className={`text-sm sm:text-lg font-bold ${SUIT_COLORS[suit]}`}>
          {value}
        </span>
        <span className={`text-xs sm:text-sm ${SUIT_COLORS[suit]}`}>
          {SUIT_SYMBOLS[suit]}
        </span>
      </div>

      {/* Large Center Icon */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20 text-3xl sm:text-5xl">
        <span className={SUIT_COLORS[suit]}>{SUIT_SYMBOLS[suit]}</span>
      </div>

      {/* Bottom Right */}
      <div className="flex flex-col items-center leading-none self-end rotate-180">
        <span className={`text-sm sm:text-lg font-bold ${SUIT_COLORS[suit]}`}>
          {value}
        </span>
        <span className={`text-xs sm:text-sm ${SUIT_COLORS[suit]}`}>
          {SUIT_SYMBOLS[suit]}
        </span>
      </div>
    </motion.div>
  );
}
