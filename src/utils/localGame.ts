/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TableState, PlayerState, Card, PlayerStatus, GameHistoryEntry, LeaderboardEntry } from '../types';
import { createDeck, calculateHandScore, isBlackjack, generateRiggedDealerHand } from '../gameUtils';

// Helper to save and load leaderboard locally
export function getLocalLeaderboard(): LeaderboardEntry[] {
  try {
    const data = localStorage.getItem('bj_local_leaderboard');
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.error(e);
  }
  // Default values
  return [
    { name: 'Casino Royale', chips: 15000, wins: 45, roundsPlayed: 100 },
    { name: 'Wynn VIP', chips: 12000, wins: 32, roundsPlayed: 75 },
    { name: 'Card Shark', chips: 8500, wins: 24, roundsPlayed: 60 },
    { name: 'Saka Spar Bot', chips: 5000, wins: 15, roundsPlayed: 50 }
  ];
}

export function saveLocalLeaderboard(leaderboard: LeaderboardEntry[]) {
  try {
    localStorage.setItem('bj_local_leaderboard', JSON.stringify(leaderboard));
  } catch (e) {
    console.error(e);
  }
}

export function updateLocalLeaderboard(name: string, chips: number, didWin = false) {
  const leaderboard = getLocalLeaderboard();
  const entry = leaderboard.find(e => e.name.toLowerCase() === name.toLowerCase());
  if (entry) {
    entry.chips = Math.max(entry.chips, chips);
    entry.roundsPlayed += 1;
    if (didWin) entry.wins += 1;
  } else {
    leaderboard.push({
      name,
      chips,
      wins: didWin ? 1 : 0,
      roundsPlayed: 1
    });
  }
  leaderboard.sort((a, b) => b.chips - a.chips);
  saveLocalLeaderboard(leaderboard.slice(0, 15));
}

const BOT_NAMES = ['Bot Alfred', 'Bot Beatrice', 'Bot Charlie', 'Bot Daisy', 'Bot Ethan', 'Bot Fiona'];

export function createLocalTable(id: string, hostId: string, hostName: string): TableState {
  const initialPlayer: PlayerState = {
    id: hostId,
    name: hostName || 'Player 1',
    chips: 1000,
    currentBet: 0,
    hand: [],
    status: 'idle',
    type: 'human',
    seatIndex: 0
  };

  return {
    id,
    hostId,
    status: 'lobby',
    players: { [hostId]: initialPlayer },
    dealerHand: [],
    dealerStatus: 'idle',
    dealerTarget: 17,
    activeSeatIndex: -1,
    turnTimer: 0,
    turnTimerMax: 15,
    deckCount: 4,
    roundNumber: 0,
    history: [],
    settings: {
      minBet: 10,
      maxBet: 500,
      seatsCount: 4,
      botCount: 0
    }
  };
}

export function addBotToLocalTable(table: TableState): TableState {
  const updated = { ...table, players: { ...table.players } };
  const currentBots = Object.values(updated.players).filter(p => p.type === 'bot');
  if (currentBots.length >= table.settings.seatsCount - 1) return table;

  // Find empty seat index (exclude index 0 which is human host)
  const occupiedSeats = Object.values(updated.players).map(p => p.seatIndex);
  let emptySeat = -1;
  for (let s = 1; s < table.settings.seatsCount; s++) {
    if (!occupiedSeats.includes(s)) {
      emptySeat = s;
      break;
    }
  }

  if (emptySeat === -1) return table;

  const name = BOT_NAMES[currentBots.length % BOT_NAMES.length];
  const botId = `bot-${Math.random().toString(36).substring(2, 7)}`;
  const bot: PlayerState = {
    id: botId,
    name,
    chips: 1000,
    currentBet: 0,
    hand: [],
    status: 'idle',
    type: 'bot',
    seatIndex: emptySeat
  };

  updated.players[botId] = bot;
  updated.settings.botCount = currentBots.length + 1;
  return updated;
}

export function removePlayerFromLocalTable(table: TableState, playerId: string): TableState {
  const updated = { ...table, players: { ...table.players } };
  if (updated.players[playerId]) {
    const pType = updated.players[playerId].type;
    delete updated.players[playerId];
    if (pType === 'bot') {
      const currentBots = Object.values(updated.players).filter(p => p.type === 'bot');
      updated.settings.botCount = currentBots.length;
    }
  }
  return updated;
}

// Global local deck
let localDeck: Card[] = [];

function getLocalDeck(): Card[] {
  if (localDeck.length < 20) {
    localDeck = createDeck(4);
  }
  return localDeck;
}

export function placeLocalBet(
  table: TableState,
  playerId: string,
  amount: number,
  onLog: (msg: string) => void
): TableState {
  const updated = { ...table, players: { ...table.players } };
  const p = updated.players[playerId];
  if (!p || amount < table.settings.minBet || amount > table.settings.maxBet || p.chips < amount) {
    return table;
  }

  p.chips -= amount;
  p.currentBet = amount;
  p.status = 'playing';

  onLog(`${p.name} placed a bet of $${amount}.`);

  return runLocalGameLoop(updated, onLog);
}

export function startLocalGame(table: TableState, onLog: (msg: string) => void): TableState {
  const updated = { ...table, players: { ...table.players }, status: 'betting' as const };
  updated.roundNumber += 1;

  Object.values(updated.players).forEach(p => {
    p.hand = [];
    p.currentBet = 0;
    p.status = 'betting';
    p.splitHand = undefined;
    p.splitBet = undefined;
    p.splitStatus = undefined;
    p.activeHandIndex = undefined;
  });

  onLog(`Round ${updated.roundNumber} started! Place your initial bets.`);

  return runLocalGameLoop(updated, onLog);
}

export function runLocalGameLoop(table: TableState, onLog: (msg: string) => void): TableState {
  const updated = { ...table, players: { ...table.players } };
  if (updated.status !== 'betting') return table;

  const activePlayers = Object.values(updated.players).filter(p => p.status === 'betting');

  // Automate bot bets
  activePlayers.forEach(p => {
    if (p.type === 'bot' && p.currentBet === 0) {
      const possibleBets = [10, 25, 50, 100].filter(b => b <= p.chips && b >= table.settings.minBet);
      const chosenBet = possibleBets[Math.floor(Math.random() * possibleBets.length)] || table.settings.minBet;
      if (p.chips >= chosenBet) {
        p.currentBet = chosenBet;
        p.chips -= chosenBet;
        p.status = 'playing';
        onLog(`${p.name} auto-bet $${chosenBet}.`);
      } else {
        // Bankrupt bot refill
        p.chips = 1000;
        const fallbackBet = 50;
        p.chips -= fallbackBet;
        p.currentBet = fallbackBet;
        p.status = 'playing';
        onLog(`Courtesy refill! ${p.name} received $1000 and bet $${fallbackBet}.`);
      }
    }
  });

  // Check if human has also placed their bet
  const humanPlayer = Object.values(updated.players).find(p => p.type === 'human');
  const allBet = Object.values(updated.players).every(p => p.currentBet > 0 || p.status === 'idle');

  if (allBet && humanPlayer && humanPlayer.currentBet > 0) {
    // Transition to playing and deal cards!
    updated.status = 'playing';
    updated.dealerTarget = 17;
    return dealLocalInitialCards(updated, onLog);
  }

  return updated;
}

function dealLocalInitialCards(table: TableState, onLog: (msg: string) => void): TableState {
  const updated = { ...table, players: { ...table.players } };
  const deck = getLocalDeck();

  // Reset dealer Hand
  updated.dealerHand = [];
  updated.dealerStatus = 'playing';

  // Deal 2 cards to dealer
  const dealerCard1 = deck.pop()!;
  dealerCard1.isRevealed = true;
  const dealerCard2 = deck.pop()!;
  dealerCard2.isRevealed = false; // face down hole card
  updated.dealerHand = [dealerCard1, dealerCard2];

  onLog(`Dealer deals cards. One card face up, one card hidden.`);

  // Deal 2 cards to players with active bet
  Object.values(updated.players).forEach(p => {
    p.hand = [];
    if (p.currentBet > 0) {
      p.status = 'playing';
      const c1 = deck.pop()!;
      const c2 = deck.pop()!;
      c1.isRevealed = true;
      c2.isRevealed = true;
      p.hand = [c1, c2];

      const score = calculateHandScore(p.hand);
      if (score === 21) {
        p.status = 'blackjack';
        onLog(`🎰 ${p.name} gets a NATURAL BLACKJACK!`);
      } else {
        onLog(`${p.name} receives ${c1.value}${c1.suit[0].toUpperCase()} and ${c2.value}${c2.suit[0].toUpperCase()} (Total: ${score}).`);
      }
    } else {
      p.status = 'idle';
    }
  });

  updated.activeSeatIndex = -1;
  return moveLocalToNextPlayerTurn(updated, onLog);
}

export function moveLocalToNextPlayerTurn(table: TableState, onLog: (msg: string) => void): TableState {
  const updated = { ...table, players: { ...table.players } };
  
  let nextSeat = updated.activeSeatIndex + 1;
  let found = false;

  while (nextSeat < updated.settings.seatsCount) {
    const playerAtSeat = Object.values(updated.players).find(p => p.seatIndex === nextSeat);
    if (playerAtSeat && playerAtSeat.currentBet > 0 && playerAtSeat.status === 'playing') {
      updated.activeSeatIndex = nextSeat;
      found = true;
      break;
    }
    nextSeat++;
  }

  if (found) {
    const activePlayer = Object.values(updated.players).find(p => p.seatIndex === updated.activeSeatIndex);
    if (activePlayer) {
      if (activePlayer.type === 'bot') {
        // Run bot turn immediately / automatically in local state
        return runLocalBotTurn(updated, activePlayer.id, onLog);
      } else {
        onLog(`It's your turn, ${activePlayer.name}! Make your move.`);
      }
    }
  } else {
    // No more active players -> Dealer's Turn!
    return runLocalDealerTurn(updated, onLog);
  }

  return updated;
}

function runLocalBotTurn(table: TableState, botId: string, onLog: (msg: string) => void): TableState {
  let updated = { ...table, players: { ...table.players } };
  const bot = updated.players[botId];
  if (!bot || bot.status !== 'playing' || updated.activeSeatIndex !== bot.seatIndex) return table;

  const deck = getLocalDeck();
  let score = calculateHandScore(bot.hand);

  // Standard bot strategy: Hit on 16 or below, Stand on 17+
  while (score < 17) {
    const card = deck.pop()!;
    card.isRevealed = true;
    bot.hand.push(card);
    score = calculateHandScore(bot.hand);
    onLog(`${bot.name} hits and receives ${card.value}${card.suit[0].toUpperCase()} (Total: ${score}).`);

    if (score > 21) {
      bot.status = 'bust';
      onLog(`🚨 ${bot.name} BUSTS with ${score}!`);
      break;
    } else if (score === 21) {
      bot.status = 'stand';
      onLog(`${bot.name} reaches 21!`);
      break;
    }
  }

  if (bot.status === 'playing') {
    bot.status = 'stand';
    onLog(`${bot.name} stands on ${score}.`);
  }

  return moveLocalToNextPlayerTurn(updated, onLog);
}

export function processLocalPlayerAction(
  table: TableState,
  playerId: string,
  action: 'hit' | 'stand' | 'double' | 'surrender' | 'split',
  onLog: (msg: string) => void,
  onToast: (text: string, type: 'success' | 'error' | 'info') => void
): TableState {
  let updated = { ...table, players: { ...table.players } };
  const p = updated.players[playerId];
  if (!p || p.seatIndex !== updated.activeSeatIndex || p.status !== 'playing') return table;

  const deck = getLocalDeck();

  if (action === 'split') {
    const val1 = p.hand[0]?.value;
    const val2 = p.hand[1]?.value;
    const getCardValue = (val: string) => ['J', 'Q', 'K', '10'].includes(val) ? 10 : (val === 'A' ? 11 : parseInt(val) || 0);
    const isSplittable = p.hand.length === 2 && (val1 === val2 || getCardValue(val1) === getCardValue(val2));

    if (!isSplittable) {
      onToast('Hand is not eligible for a Split!', 'error');
      return table;
    }
    if (p.chips < p.currentBet) {
      onToast('Insufficient chips to split!', 'error');
      return table;
    }

    // Execute split
    const splitBet = p.currentBet;
    p.chips -= splitBet;
    p.splitBet = splitBet;
    p.splitHand = [p.hand.pop()!];
    p.splitStatus = 'playing';
    p.activeHandIndex = 0;

    // Deal dynamic cards to both hands
    const card1 = deck.pop()!;
    card1.isRevealed = true;
    p.hand.push(card1);

    const card2 = deck.pop()!;
    card2.isRevealed = true;
    p.splitHand.push(card2);

    onLog(`${p.name} split their hand of ${val1}s! Placed additional bet of $${splitBet}.`);
  } else if (action === 'hit') {
    if (p.splitHand && p.splitBet) {
      const card = deck.pop()!;
      card.isRevealed = true;

      if (p.activeHandIndex === 0) {
        p.hand.push(card);
        const score = calculateHandScore(p.hand);
        if (score > 21) {
          onLog(`${p.name}'s first hand hits, gets ${card.value}${card.suit[0].toUpperCase()}, and BUSTS with ${score}! Switching to split hand.`);
          p.activeHandIndex = 1;
        } else if (score === 21) {
          onLog(`${p.name}'s first hand hits, gets ${card.value}${card.suit[0].toUpperCase()}, and reaches 21! Switching to split hand.`);
          p.activeHandIndex = 1;
        } else {
          onLog(`${p.name}'s first hand hits, gets ${card.value}${card.suit[0].toUpperCase()}. Hand total: ${score}.`);
        }
      } else {
        p.splitHand.push(card);
        const score = calculateHandScore(p.splitHand);
        if (score > 21) {
          p.splitStatus = 'bust';
          p.status = calculateHandScore(p.hand) > 21 ? 'bust' : 'stand';
          onLog(`${p.name}'s split hand hits, gets ${card.value}${card.suit[0].toUpperCase()}, and BUSTS with ${score}! Turn complete.`);
          return moveLocalToNextPlayerTurn(updated, onLog);
        } else if (score === 21) {
          p.splitStatus = 'stand';
          p.status = 'stand';
          onLog(`${p.name}'s split hand hits, gets ${card.value}${card.suit[0].toUpperCase()}, and reaches 21! Turn complete.`);
          return moveLocalToNextPlayerTurn(updated, onLog);
        } else {
          onLog(`${p.name}'s split hand hits, gets ${card.value}${card.suit[0].toUpperCase()}. Split hand total: ${score}.`);
        }
      }
    } else {
      const card = deck.pop()!;
      card.isRevealed = true;
      p.hand.push(card);

      const score = calculateHandScore(p.hand);
      if (score > 21) {
        p.status = 'bust';
        onLog(`${p.name} hits, gets ${card.value}${card.suit[0].toUpperCase()}, and BUSTS with ${score}!`);
        return moveLocalToNextPlayerTurn(updated, onLog);
      } else if (score === 21) {
        p.status = 'stand';
        onLog(`${p.name} hits, gets ${card.value}${card.suit[0].toUpperCase()}, and reaches 21!`);
        return moveLocalToNextPlayerTurn(updated, onLog);
      } else {
        onLog(`${p.name} hits, gets ${card.value}${card.suit[0].toUpperCase()}. Hand total is ${score}.`);
      }
    }
  } else if (action === 'stand') {
    if (p.splitHand && p.splitBet) {
      if (p.activeHandIndex === 0) {
        const score = calculateHandScore(p.hand);
        onLog(`${p.name} stands on first hand (${score}). Switching to split hand.`);
        p.activeHandIndex = 1;
      } else {
        p.splitStatus = 'stand';
        p.status = 'stand';
        const score = calculateHandScore(p.splitHand);
        onLog(`${p.name} stands on split hand (${score}). Turn complete.`);
        return moveLocalToNextPlayerTurn(updated, onLog);
      }
    } else {
      p.status = 'stand';
      const score = calculateHandScore(p.hand);
      onLog(`${p.name} stands on ${score}.`);
      return moveLocalToNextPlayerTurn(updated, onLog);
    }
  } else if (action === 'double') {
    if (p.splitHand && p.splitBet) {
      if (p.activeHandIndex === 0) {
        if (p.chips < p.currentBet) {
          onToast('Insufficient chips to Double Down on first hand!', 'error');
          return table;
        }
        const doubleBet = p.currentBet;
        p.chips -= doubleBet;
        p.currentBet += doubleBet;

        const card = deck.pop()!;
        card.isRevealed = true;
        p.hand.push(card);

        const score = calculateHandScore(p.hand);
        onLog(`${p.name} doubles down on first hand, gets ${card.value}${card.suit[0].toUpperCase()}. Bet is $${p.currentBet}. Score: ${score}. Switching to split hand.`);
        p.activeHandIndex = 1;
      } else {
        if (p.chips < p.splitBet) {
          onToast('Insufficient chips to Double Down on split hand!', 'error');
          return table;
        }
        const doubleBet = p.splitBet;
        p.chips -= doubleBet;
        p.splitBet += doubleBet;

        const card = deck.pop()!;
        card.isRevealed = true;
        p.splitHand.push(card);

        const score = calculateHandScore(p.splitHand);
        if (score > 21) {
          p.splitStatus = 'bust';
        } else {
          p.splitStatus = 'stand';
        }
        p.status = calculateHandScore(p.hand) > 21 ? (score > 21 ? 'bust' : 'stand') : 'stand';

        onLog(`${p.name} doubles down on split hand, gets ${card.value}${card.suit[0].toUpperCase()}. Split Bet is $${p.splitBet}. Score: ${score}. Turn complete.`);
        return moveLocalToNextPlayerTurn(updated, onLog);
      }
    } else {
      if (p.chips < p.currentBet) {
        onToast('Insufficient chips to Double Down!', 'error');
        return table;
      }
      const doubleBet = p.currentBet;
      p.chips -= doubleBet;
      p.currentBet += doubleBet;

      const card = deck.pop()!;
      card.isRevealed = true;
      p.hand.push(card);

      const score = calculateHandScore(p.hand);
      if (score > 21) {
        p.status = 'bust';
        onLog(`${p.name} doubles down, gets ${card.value}${card.suit[0].toUpperCase()}, and BUSTS with ${score}!`);
      } else {
        p.status = 'stand';
        onLog(`${p.name} doubles down, gets ${card.value}${card.suit[0].toUpperCase()}. Total bet is now $${p.currentBet}. Final score: ${score}.`);
      }
      return moveLocalToNextPlayerTurn(updated, onLog);
    }
  } else if (action === 'surrender') {
    p.status = 'surrendered';
    // Return 50% bet
    const returnAmount = Math.floor(p.currentBet / 2);
    p.chips += returnAmount;
    onLog(`${p.name} surrendered. Forfeits half of the $${p.currentBet} bet. Retains $${returnAmount}.`);
    return moveLocalToNextPlayerTurn(updated, onLog);
  }

  return updated;
}

function runLocalDealerTurn(table: TableState, onLog: (msg: string) => void): TableState {
  let updated = { ...table, players: { ...table.players }, status: 'dealer-turn' as const };
  const deck = getLocalDeck();

  // Reveal hole card
  updated.dealerHand.forEach(c => c.isRevealed = true);
  let score = calculateHandScore(updated.dealerHand);

  onLog(`Dealer reveals hole card. Hand total is ${score}.`);

  // Simple dealer strategy or custom rigged strategy
  // Note: the dealer always stands on soft 17 (standard or custom 18/19 rigging)
  const target = updated.dealerTarget || 17;

  while (score < target) {
    const card = deck.pop()!;
    card.isRevealed = true;
    updated.dealerHand.push(card);
    score = calculateHandScore(updated.dealerHand);
    onLog(`Dealer hits and gets ${card.value}${card.suit[0].toUpperCase()} (Total: ${score}).`);

    if (score > 21) {
      updated.dealerStatus = 'bust';
      onLog(`Dealer BUSTS with ${score}!`);
      break;
    }
  }

  if (updated.dealerStatus !== 'bust') {
    updated.dealerStatus = 'stand';
    onLog(`Dealer stands on ${score}.`);
  }

  return concludeLocalRound(updated, onLog);
}

function concludeLocalRound(table: TableState, onLog: (msg: string) => void): TableState {
  const updated = { ...table, players: { ...table.players }, status: 'round-over' as const };
  const dealerScore = calculateHandScore(updated.dealerHand);
  const dealerHasBlackjack = isBlackjack(updated.dealerHand);

  const historyPlayers: GameHistoryEntry['players'] = [];

  Object.values(updated.players).forEach(p => {
    if (p.currentBet === 0) return;

    let chipsChange = -p.currentBet;
    let outcome: GameHistoryEntry['players'][0]['outcome'] = 'lose';

    const playerScore = calculateHandScore(p.hand);

    if (p.status === 'surrendered') {
      outcome = 'surrender';
      chipsChange = -Math.floor(p.currentBet / 2);
    } else if (p.status === 'bust') {
      outcome = 'bust';
      chipsChange = -p.currentBet;
    } else if (updated.dealerStatus === 'bust') {
      if (p.status === 'blackjack') {
        outcome = 'blackjack';
        // Blackjack pays 2:1 now
        const winAmount = p.currentBet * 2;
        chipsChange = winAmount;
        p.chips += p.currentBet + winAmount;
      } else {
        outcome = 'win';
        chipsChange = p.currentBet;
        p.chips += p.currentBet * 2;
      }
    } else {
      // Dealer has not busted
      if (p.status === 'blackjack') {
        if (dealerHasBlackjack) {
          outcome = 'push';
          chipsChange = 0;
          p.chips += p.currentBet;
        } else {
          outcome = 'blackjack';
          // Blackjack pays 2:1 now
          const winAmount = p.currentBet * 2;
          chipsChange = winAmount;
          p.chips += p.currentBet + winAmount;
        }
      } else {
        if (dealerHasBlackjack) {
          outcome = 'lose';
          chipsChange = -p.currentBet;
        } else if (playerScore > dealerScore) {
          outcome = 'win';
          chipsChange = p.currentBet;
          p.chips += p.currentBet * 2;
        } else if (playerScore < dealerScore) {
          outcome = 'lose';
          chipsChange = -p.currentBet;
        } else {
          outcome = 'push';
          chipsChange = 0;
          p.chips += p.currentBet;
        }
      }
    }

    // Process split hand outcome if exists
    let splitChipsChange = 0;
    let splitOutcome: GameHistoryEntry['players'][0]['outcome'] = 'none';

    if (p.splitHand && p.splitBet) {
      const splitScore = calculateHandScore(p.splitHand);
      splitChipsChange = -p.splitBet;

      if (p.splitStatus === 'bust') {
        splitOutcome = 'bust';
        splitChipsChange = -p.splitBet;
      } else if (updated.dealerStatus === 'bust') {
        if (isBlackjack(p.splitHand)) {
          splitOutcome = 'blackjack';
          // 2:1 payout on split blackjack if triggered (usually standard win, but let's give the user 2:1!)
          const winAmount = p.splitBet * 2;
          splitChipsChange = winAmount;
          p.chips += p.splitBet + winAmount;
        } else {
          splitOutcome = 'win';
          splitChipsChange = p.splitBet;
          p.chips += p.splitBet * 2;
        }
      } else {
        if (isBlackjack(p.splitHand)) {
          if (dealerHasBlackjack) {
            splitOutcome = 'push';
            splitChipsChange = 0;
            p.chips += p.splitBet;
          } else {
            splitOutcome = 'blackjack';
            const winAmount = p.splitBet * 2;
            splitChipsChange = winAmount;
            p.chips += p.splitBet + winAmount;
          }
        } else {
          if (dealerHasBlackjack) {
            splitOutcome = 'lose';
            splitChipsChange = -p.splitBet;
          } else if (splitScore > dealerScore) {
            splitOutcome = 'win';
            splitChipsChange = p.splitBet;
            p.chips += p.splitBet * 2;
          } else if (splitScore < dealerScore) {
            splitOutcome = 'lose';
            splitChipsChange = -p.splitBet;
          } else {
            splitOutcome = 'push';
            splitChipsChange = 0;
            p.chips += p.splitBet;
          }
        }
      }
    }

    const totalChipsChange = chipsChange + splitChipsChange;

    historyPlayers.push({
      name: p.name,
      bet: p.currentBet + (p.splitBet || 0),
      score: playerScore,
      chipsChange: totalChipsChange,
      status: p.status,
      outcome: outcome
    });

    onLog(`${p.name} outcome: ${outcome.toUpperCase()} (${chipsChange >= 0 ? '+' : ''}$${chipsChange}).`);
    if (p.splitHand && p.splitBet) {
      onLog(`${p.name}'s Split Outcome: ${splitOutcome.toUpperCase()} (${splitChipsChange >= 0 ? '+' : ''}$${splitChipsChange}).`);
    }

    // Bankrupt check
    if (p.chips < updated.settings.minBet) {
      if (p.type === 'bot') {
        p.chips = 1000;
      } else {
        p.chips = 500;
        onLog(`Courtesy refill! ${p.name} is given $500 chips to stay in the game.`);
      }
    }

    // Save local leaderboard
    updateLocalLeaderboard(
      p.name,
      p.chips,
      outcome === 'win' || outcome === 'blackjack' || splitOutcome === 'win' || splitOutcome === 'blackjack'
    );
  });

  const historyEntry: GameHistoryEntry = {
    id: `hist-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toLocaleTimeString(),
    roundNumber: updated.roundNumber,
    dealerHand: updated.dealerHand,
    dealerScore: dealerScore,
    dealerTarget: updated.dealerTarget,
    players: historyPlayers
  };

  updated.history = [historyEntry, ...updated.history].slice(0, 50);

  return updated;
}
