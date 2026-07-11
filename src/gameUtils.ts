/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Card, Suit, CardValue } from './types';

export const SUITS: Suit[] = ['hearts', 'diamonds', 'spades', 'clubs'];
export const VALUES: CardValue[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export function createDeck(decksCount = 4): Card[] {
  const deck: Card[] = [];
  for (let d = 0; d < decksCount; d++) {
    for (const suit of SUITS) {
      for (const value of VALUES) {
        deck.push({
          suit,
          value,
          id: `${suit}-${value}-${d}-${Math.random().toString(36).substring(2, 7)}`,
          isRevealed: true,
        });
      }
    }
  }
  return shuffle(deck);
}

export function shuffle(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function calculateHandScore(hand: Card[]): number {
  let score = 0;
  let acesCount = 0;

  for (const card of hand) {
    const val = card.value;
    if (val === 'A') {
      score += 11;
      acesCount += 1;
    } else if (['K', 'Q', 'J'].includes(val)) {
      score += 10;
    } else {
      score += parseInt(val, 10);
    }
  }

  while (score > 21 && acesCount > 0) {
    score -= 10;
    acesCount -= 1;
  }

  return score;
}

export function isBlackjack(hand: Card[]): boolean {
  return hand.length === 2 && calculateHandScore(hand) === 21;
}

/**
 * Rigged Dealer Hand Generator
 * The dealer always gets exactly 18 or 19 points randomly.
 * We generate a sequence of cards that sum up to the target score under Blackjack rules.
 */
export function generateRiggedDealerHand(target: 18 | 19): Card[] {
  const suits: Suit[] = ['hearts', 'diamonds', 'spades', 'clubs'];
  const valuesWithScores: { val: CardValue; score: number }[] = [
    { val: '2', score: 2 }, { val: '3', score: 3 }, { val: '4', score: 4 },
    { val: '5', score: 5 }, { val: '6', score: 6 }, { val: '7', score: 7 },
    { val: '8', score: 8 }, { val: '9', score: 9 }, { val: '10', score: 10 },
    { val: 'J', score: 10 }, { val: 'Q', score: 10 }, { val: 'K', score: 10 },
    { val: 'A', score: 11 }
  ];

  while (true) {
    // Generate candidates
    const deckPool = [...valuesWithScores];
    for (let i = deckPool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deckPool[i], deckPool[j]] = [deckPool[j], deckPool[i]];
    }

    const selected: { val: CardValue; score: number }[] = [];
    for (const card of deckPool) {
      selected.push(card);
      const sum = calculateScoreFromRaw(selected);
      if (sum === target) {
        return selected.map((c, idx) => ({
          id: `dealer-${idx}-${Math.random().toString(36).substring(2, 7)}`,
          suit: suits[Math.floor(Math.random() * suits.length)],
          value: c.val,
          isRevealed: false // Managed by game phase (first card revealed on deal)
        }));
      } else if (sum > target) {
        break;
      }
    }
  }
}

function calculateScoreFromRaw(cards: { val: CardValue; score: number }[]): number {
  let score = 0;
  let acesCount = 0;
  for (const c of cards) {
    score += c.score;
    if (c.val === 'A') acesCount++;
  }
  while (score > 21 && acesCount > 0) {
    score -= 10;
    acesCount--;
  }
  return score;
}
