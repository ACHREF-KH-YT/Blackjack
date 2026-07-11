/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Suit = 'hearts' | 'diamonds' | 'spades' | 'clubs';
export type CardValue = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  suit: Suit;
  value: CardValue;
  id: string; // Unique card identifier for animation keys
  isRevealed?: boolean;
}

export type PlayerStatus = 
  | 'idle'
  | 'betting'
  | 'playing'
  | 'stand'
  | 'bust'
  | 'blackjack'
  | 'surrendered';

export interface PlayerState {
  id: string;
  name: string;
  chips: number;
  currentBet: number;
  hand: Card[];
  status: PlayerStatus;
  type: 'human' | 'bot';
  seatIndex: number;
  splitHand?: Card[];
  splitBet?: number;
  splitStatus?: PlayerStatus;
  activeHandIndex?: 0 | 1;
}

export type GameStatus = 
  | 'lobby'
  | 'betting'
  | 'playing'
  | 'dealer-turn'
  | 'round-over';

export interface GameHistoryEntry {
  id: string;
  timestamp: string;
  roundNumber: number;
  dealerHand: Card[];
  dealerScore: number;
  dealerTarget: number;
  players: {
    name: string;
    bet: number;
    score: number;
    chipsChange: number;
    status: string;
    outcome: 'win' | 'lose' | 'push' | 'blackjack' | 'bust' | 'surrender' | 'none';
  }[];
}

export interface LeaderboardEntry {
  name: string;
  chips: number;
  wins: number;
  roundsPlayed: number;
}

export interface TableState {
  id: string;
  hostId: string;
  status: GameStatus;
  players: { [id: string]: PlayerState };
  dealerHand: Card[];
  dealerStatus: 'idle' | 'playing' | 'stand' | 'bust' | 'blackjack';
  dealerTarget: number;
  activeSeatIndex: number; // 0, 1, 2, 3
  turnTimer: number; // For interactive turn countdowns
  turnTimerMax: number;
  deckCount: number;
  roundNumber: number;
  history: GameHistoryEntry[];
  settings: {
    minBet: number;
    maxBet: number;
    seatsCount: number;
    botCount: number;
  };
}
