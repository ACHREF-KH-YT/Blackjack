/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { Server, Socket } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import { 
  TableState, 
  PlayerState, 
  PlayerStatus, 
  Card, 
  GameHistoryEntry, 
  LeaderboardEntry,
  GameStatus
} from './src/types';
import { 
  createDeck, 
  calculateHandScore, 
  generateRiggedDealerHand, 
  isBlackjack 
} from './src/gameUtils';

const PORT = 3000;
const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// In-memory databases
const tables: { [id: string]: TableState } = {};
let leaderboards: LeaderboardEntry[] = [];

// Load leaderboards from file if available
const LEADERBOARD_FILE = path.join(process.cwd(), 'leaderboard.json');
try {
  if (fs.existsSync(LEADERBOARD_FILE)) {
    leaderboards = JSON.parse(fs.readFileSync(LEADERBOARD_FILE, 'utf8'));
  } else {
    // Seed default leaderboard
    leaderboards = [
      { name: 'Casino Royale', chips: 15000, wins: 45, roundsPlayed: 100 },
      { name: 'Wynn VIP', chips: 12000, wins: 32, roundsPlayed: 75 },
      { name: 'Card Shark', chips: 8500, wins: 24, roundsPlayed: 60 },
      { name: 'Saka Spar Bot', chips: 5000, wins: 15, roundsPlayed: 50 },
    ];
    fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(leaderboards, null, 2));
  }
} catch (err) {
  console.error('Error loading leaderboard:', err);
}

function saveLeaderboards() {
  try {
    fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(leaderboards, null, 2));
  } catch (err) {
    console.error('Error saving leaderboard:', err);
  }
}

function updateLeaderboard(name: string, chips: number, didWin = false) {
  if (!name || name.startsWith('Bot ')) return; // Don't track bots in main leaderboard
  let entry = leaderboards.find(l => l.name.toLowerCase() === name.toLowerCase());
  if (entry) {
    entry.chips = Math.max(entry.chips, chips);
    entry.roundsPlayed += 1;
    if (didWin) entry.wins += 1;
  } else {
    leaderboards.push({
      name,
      chips,
      wins: didWin ? 1 : 0,
      roundsPlayed: 1
    });
  }
  // Sort and limit to top 10
  leaderboards.sort((a, b) => b.chips - a.chips);
  leaderboards = leaderboards.slice(0, 15);
  saveLeaderboards();
}

// Bot Names list
const BOT_NAMES = ['Bot Alfred', 'Bot Beatrice', 'Bot Charlie', 'Bot Daisy', 'Bot Ethan', 'Bot Fiona'];

// Helper to create a new empty table
function createNewTable(id: string, hostId: string): TableState {
  return {
    id,
    hostId,
    status: 'lobby',
    players: {},
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
      botCount: 0,
    }
  };
}

// Global active drawing decks per table
const tableDecks: { [id: string]: Card[] } = {};

function getTableDeck(tableId: string): Card[] {
  if (!tableDecks[tableId] || tableDecks[tableId].length < 20) {
    tableDecks[tableId] = createDeck(4);
  }
  return tableDecks[tableId];
}

function removePlayerFromTable(tableId: string, playerId: string, reason: string = 'left') {
  const table = tables[tableId];
  if (!table) return;

  if (table.players[playerId]) {
    const pName = table.players[playerId].name;
    const seatIdx = table.players[playerId].seatIndex;

    delete table.players[playerId];
    io.to(tableId).emit('log-event', `${pName} ${reason} the table.`);

    // Reassign host if host left
    if (table.hostId === playerId) {
      const remainingPlayers = Object.keys(table.players).filter(id => table.players[id].type === 'human');
      if (remainingPlayers.length > 0) {
        table.hostId = remainingPlayers[0];
        io.to(tableId).emit('log-event', `${table.players[table.hostId].name} is now the host of the table.`);
      } else {
        // No humans left, cleanup table
        delete tables[tableId];
        delete tableDecks[tableId];
        console.log(`Cleaned up empty table ${tableId}`);
        return;
      }
    }

    io.to(tableId).emit('table-updated', table);

    // If playing and it was active turn, move to next
    if (table.status === 'playing' && table.activeSeatIndex === seatIdx) {
      moveToNextPlayerTurn(tableId);
    }
  }
}

// Server game logic functions
async function runGameLoop(tableId: string) {
  const table = tables[tableId];
  if (!table) return;

  if (table.status === 'betting') {
    // Check if all players have placed bets
    const activePlayers = Object.values(table.players).filter(p => p.status === 'betting');
    const humanBetting = activePlayers.filter(p => p.type === 'human' && p.currentBet === 0);

    // Automate Bot betting if it's betting phase
    activePlayers.forEach(p => {
      if (p.type === 'bot' && p.currentBet === 0) {
        const possibleBets = [10, 25, 50, 100].filter(b => b <= p.chips && b >= table.settings.minBet);
        const chosenBet = possibleBets[Math.floor(Math.random() * possibleBets.length)] || table.settings.minBet;
        if (p.chips >= chosenBet) {
          p.currentBet = chosenBet;
          p.chips -= chosenBet;
          p.status = 'playing';
        } else {
          p.status = 'idle'; // No money left
        }
      }
    });

    // If everyone is ready (all have bet)
    const allBet = activePlayers.every(p => p.currentBet > 0);
    if (allBet || table.turnTimer <= 0) {
      // Force start round
      activePlayers.forEach(p => {
        if (p.currentBet === 0) {
          // Auto-bet min if possible, else sit out
          if (p.chips >= table.settings.minBet) {
            p.currentBet = table.settings.minBet;
            p.chips -= table.settings.minBet;
            p.status = 'playing';
          } else {
            p.status = 'idle';
          }
        } else {
          p.status = 'playing';
        }
      });

      // Move to PLAYING and deal cards!
      table.status = 'playing';
      table.dealerTarget = 17;
      
      // Deal cards
      dealInitialCards(tableId);
    }
  }
}

function dealInitialCards(tableId: string) {
  const table = tables[tableId];
  if (!table) return;

  const deck = getTableDeck(tableId);

  // Clear hands
  table.dealerHand = [];
  table.dealerStatus = 'playing';

  // Deal 2 actual random cards from the deck for the dealer
  const dealerCard1 = deck.pop()!;
  dealerCard1.isRevealed = true;
  const dealerCard2 = deck.pop()!;
  dealerCard2.isRevealed = false; // face down hole card
  table.dealerHand = [dealerCard1, dealerCard2];

  // Deal 2 cards to each player with a bet
  Object.values(table.players).forEach(p => {
    p.hand = [];
    if (p.currentBet > 0) {
      p.status = 'playing';
      const c1 = deck.pop()!;
      const c2 = deck.pop()!;
      c1.isRevealed = true;
      c2.isRevealed = true;
      p.hand = [c1, c2];

      if (isBlackjack(p.hand)) {
        p.status = 'blackjack';
      }
    } else {
      p.status = 'idle';
    }
  });

  // Start player turns
  moveToNextPlayerTurn(tableId);
}

function moveToNextPlayerTurn(tableId: string) {
  const table = tables[tableId];
  if (!table) return;

  // Find next seat index that has an active player who needs to act
  let nextSeat = table.activeSeatIndex + 1;
  let found = false;

  while (nextSeat < table.settings.seatsCount) {
    const playerAtSeat = Object.values(table.players).find(p => p.seatIndex === nextSeat);
    if (playerAtSeat && playerAtSeat.currentBet > 0 && playerAtSeat.status === 'playing') {
      table.activeSeatIndex = nextSeat;
      table.turnTimer = table.turnTimerMax;
      found = true;
      break;
    }
    nextSeat++;
  }

  if (found) {
    // Notify room of turn update
    io.to(tableId).emit('table-updated', table);

    // If active player is bot, automate turn
    const activePlayer = Object.values(table.players).find(p => p.seatIndex === table.activeSeatIndex);
    if (activePlayer && activePlayer.type === 'bot') {
      setTimeout(() => {
        runBotTurn(tableId, activePlayer.id);
      }, 1500);
    }
  } else {
    // No more players to act -> Dealer's Turn!
    runDealerTurn(tableId);
  }
}

function runBotTurn(tableId: string, botId: string) {
  const table = tables[tableId];
  if (!table) return;
  const bot = table.players[botId];
  if (!bot || bot.status !== 'playing' || table.activeSeatIndex !== bot.seatIndex) return;

  const score = calculateHandScore(bot.hand);
  // Standard bot behavior: hit under 17, stand on 17+
  if (score < 17) {
    // Bot Hits
    const deck = getTableDeck(tableId);
    const card = deck.pop()!;
    card.isRevealed = true;
    bot.hand.push(card);

    const newScore = calculateHandScore(bot.hand);
    if (newScore > 21) {
      bot.status = 'bust';
      io.to(tableId).emit('log-event', `${bot.name} hits, gets ${card.value}${card.suit[0].toUpperCase()}, and BUSTS with ${newScore}!`);
      setTimeout(() => moveToNextPlayerTurn(tableId), 1200);
    } else if (newScore === 21) {
      bot.status = 'stand';
      io.to(tableId).emit('log-event', `${bot.name} hits, gets ${card.value}${card.suit[0].toUpperCase()}, and reaches 21!`);
      setTimeout(() => moveToNextPlayerTurn(tableId), 1200);
    } else {
      io.to(tableId).emit('log-event', `${bot.name} hits, gets ${card.value}${card.suit[0].toUpperCase()}. Hand total is ${newScore}.`);
      io.to(tableId).emit('table-updated', table);
      // Let bot think again
      setTimeout(() => {
        runBotTurn(tableId, botId);
      }, 1500);
    }
  } else {
    // Bot Stands
    bot.status = 'stand';
    io.to(tableId).emit('log-event', `${bot.name} stands on ${score}.`);
    io.to(tableId).emit('table-updated', table);
    setTimeout(() => moveToNextPlayerTurn(tableId), 1200);
  }
}

async function runDealerTurn(tableId: string) {
  const table = tables[tableId];
  if (!table) return;

  table.status = 'dealer-turn';
  table.activeSeatIndex = -1;

  // Reveal all dealer cards!
  table.dealerHand.forEach(c => c.isRevealed = true);
  io.to(tableId).emit('table-updated', table);

  const initialScore = calculateHandScore(table.dealerHand);
  io.to(tableId).emit('log-event', `Dealer reveals hole card. Hand: ${table.dealerHand.map(c => `${c.value}${c.suit[0].toUpperCase()}`).join(', ')} (Total: ${initialScore}).`);

  const deck = getTableDeck(tableId);

  const drawNextCard = () => {
    const score = calculateHandScore(table.dealerHand);
    if (score < 17) {
      const card = deck.pop()!;
      card.isRevealed = true;
      table.dealerHand.push(card);
      const newScore = calculateHandScore(table.dealerHand);
      io.to(tableId).emit('log-event', `Dealer hits, gets ${card.value}${card.suit[0].toUpperCase()}. Score is ${newScore}.`);
      io.to(tableId).emit('table-updated', table);
      
      // Schedule next check/draw
      setTimeout(drawNextCard, 1200);
    } else {
      // Finished drawing
      if (score > 21) {
        table.dealerStatus = 'bust';
        io.to(tableId).emit('log-event', `Dealer BUSTS with ${score}!`);
      } else {
        table.dealerStatus = 'stand';
        io.to(tableId).emit('log-event', `Dealer stands on ${score}.`);
      }
      io.to(tableId).emit('table-updated', table);
      setTimeout(() => {
        concludeRound(tableId);
      }, 1000);
    }
  };

  // Start the dealer draw loop with a slight initial delay after revealing the hole card
  setTimeout(drawNextCard, 1200);
}

function concludeRound(tableId: string) {
  const table = tables[tableId];
  if (!table) return;

  const dealerScore = calculateHandScore(table.dealerHand);
  const roundLog: GameHistoryEntry['players'] = [];

  Object.values(table.players).forEach(p => {
    if (p.currentBet === 0) return;

    // 1. Resolve main hand
    const playerScore = calculateHandScore(p.hand);
    let outcome: 'win' | 'lose' | 'push' | 'blackjack' | 'bust' | 'surrender' = 'lose';
    let chipsChange = -p.currentBet;

    if (p.status === 'surrendered') {
      outcome = 'surrender';
      chipsChange = -Math.floor(p.currentBet / 2);
      p.chips += Math.floor(p.currentBet / 2);
    } else if (playerScore > 21) {
      outcome = 'bust';
      chipsChange = -p.currentBet;
    } else if (p.status === 'blackjack' && p.hand.length === 2) {
      // Blackjack beats standard 21
      if (isBlackjack(table.dealerHand)) {
        outcome = 'push';
        chipsChange = 0;
        p.chips += p.currentBet;
      } else {
        outcome = 'blackjack';
        // Blackjack pays 2:1
        const winAmount = Math.floor(p.currentBet * 2);
        chipsChange = winAmount;
        p.chips += p.currentBet + winAmount;
      }
    } else {
      // Compare scores
      if (dealerScore > 21) {
        outcome = 'win';
        chipsChange = p.currentBet;
        p.chips += p.currentBet * 2;
      } else if (playerScore > dealerScore) {
        outcome = 'win';
        chipsChange = p.currentBet;
        p.chips += p.currentBet * 2;
      } else if (playerScore === dealerScore) {
        outcome = 'push';
        chipsChange = 0;
        p.chips += p.currentBet;
      } else {
        outcome = 'lose';
        chipsChange = -p.currentBet;
      }
    }

    // 2. Resolve split hand if exists
    let splitOutcome: 'win' | 'lose' | 'push' | 'blackjack' | 'bust' | 'surrender' | 'none' = 'none';
    let splitChipsChange = 0;
    let splitScore = 0;

    if (p.splitHand && p.splitBet) {
      splitScore = calculateHandScore(p.splitHand);
      splitChipsChange = -p.splitBet;

      if (splitScore > 21) {
        splitOutcome = 'bust';
      } else if (isBlackjack(p.splitHand) && p.splitHand.length === 2) {
        if (isBlackjack(table.dealerHand)) {
          splitOutcome = 'push';
          splitChipsChange = 0;
          p.chips += p.splitBet;
        } else {
          splitOutcome = 'blackjack';
          const winAmount = Math.floor(p.splitBet * 2);
          splitChipsChange = winAmount;
          p.chips += p.splitBet + winAmount;
        }
      } else {
        if (dealerScore > 21) {
          splitOutcome = 'win';
          splitChipsChange = p.splitBet;
          p.chips += p.splitBet * 2;
        } else if (splitScore > dealerScore) {
          splitOutcome = 'win';
          splitChipsChange = p.splitBet;
          p.chips += p.splitBet * 2;
        } else if (splitScore === dealerScore) {
          splitOutcome = 'push';
          splitChipsChange = 0;
          p.chips += p.splitBet;
        } else {
          splitOutcome = 'lose';
          splitChipsChange = -p.splitBet;
        }
      }

      // Send explicit log message for split hand outcome
      io.to(tableId).emit('log-event', `${p.name}'s Split Hand got ${splitScore} and ${splitOutcome.toUpperCase()} (${splitChipsChange >= 0 ? '+' : ''}$${splitChipsChange}).`);
    }

    const totalChipsChange = chipsChange + splitChipsChange;

    // Save logs and leaderboards
    roundLog.push({
      name: p.name,
      bet: p.currentBet + (p.splitBet || 0),
      score: p.splitHand ? playerScore : playerScore,
      chipsChange: totalChipsChange,
      status: p.status,
      outcome: outcome
    });

    // Reset currentBet but we will clean split hand fields in startNextRoundBetting
    p.currentBet = 0;
    
    // Update main leaderboard database
    updateLeaderboard(p.name, p.chips, outcome === 'win' || outcome === 'blackjack' || splitOutcome === 'win' || splitOutcome === 'blackjack');
  });

  // Save history entry
  const historyEntry: GameHistoryEntry = {
    id: `round-${table.roundNumber}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toLocaleTimeString(),
    roundNumber: table.roundNumber,
    dealerHand: [...table.dealerHand],
    dealerScore,
    dealerTarget: table.dealerTarget,
    players: roundLog
  };

  table.history.unshift(historyEntry);
  if (table.history.length > 30) {
    table.history = table.history.slice(0, 30);
  }

  table.status = 'round-over';
  table.activeSeatIndex = -1;
  table.roundNumber += 1;
  table.turnTimer = 10; // 10 seconds break

  io.to(tableId).emit('table-updated', table);
  io.to(tableId).emit('round-concluded', historyEntry);
}

// Timer tick running every second
setInterval(() => {
  Object.keys(tables).forEach(tableId => {
    const table = tables[tableId];
    if (!table) return;

    if (table.status === 'betting') {
      if (table.turnTimer > 0) {
        table.turnTimer--;
        io.to(tableId).emit('timer-tick', table.turnTimer);
        if (table.turnTimer === 0) {
          runGameLoop(tableId);
        }
      }
    } else if (table.status === 'playing') {
      if (table.turnTimer > 0) {
        table.turnTimer--;
        io.to(tableId).emit('timer-tick', table.turnTimer);
        if (table.turnTimer === 0) {
          // Auto-stand the active player
          const activePlayer = Object.values(table.players).find(p => p.seatIndex === table.activeSeatIndex);
          if (activePlayer) {
            activePlayer.status = 'stand';
            io.to(tableId).emit('log-event', `${activePlayer.name}'s turn timed out. Standard Stand applied.`);
            moveToNextPlayerTurn(tableId);
          }
        }
      }
    } else if (table.status === 'round-over') {
      if (table.turnTimer > 0) {
        table.turnTimer--;
        io.to(tableId).emit('timer-tick', table.turnTimer);
        if (table.turnTimer === 0) {
          // Automatically start next betting phase
          startNextRoundBetting(tableId);
        }
      }
    }
  });
}, 1000);

function startNextRoundBetting(tableId: string) {
  const table = tables[tableId];
  if (!table || table.status !== 'round-over') return;

  // Clean bankrupt players or reset status
  Object.keys(table.players).forEach(pId => {
    const p = table.players[pId];
    if (p.chips < table.settings.minBet) {
      // Send bot back with fresh chips, or notify human
      if (p.type === 'bot') {
        p.chips = 1000;
        p.status = 'betting';
      } else {
        // Human bankrupt? Let's grant them a courtesy refill of 500 chips so they can keep playing!
        p.chips = 500;
        p.status = 'betting';
        io.to(tableId).emit('log-event', `Courtesy refill! ${p.name} is given 500 chips to stay in the game.`);
      }
    } else {
      p.status = 'betting';
    }
    p.hand = [];
    p.currentBet = 0;
    delete p.splitHand;
    delete p.splitBet;
    delete p.splitStatus;
    delete p.activeHandIndex;
  });

  table.status = 'betting';
  table.dealerHand = [];
  table.dealerStatus = 'idle';
  table.turnTimer = table.turnTimerMax;
  table.activeSeatIndex = -1;

  io.to(tableId).emit('table-updated', table);
  io.to(tableId).emit('log-event', `Round ${table.roundNumber + 1} Betting has started. Place your bets!`);
}

// Websocket Events Router
io.on('connection', (socket: Socket) => {
  console.log('Client connected:', socket.id);

  // Send initial leaderboard
  socket.emit('leaderboard-data', leaderboards);

  socket.on('get-leaderboard', () => {
    socket.emit('leaderboard-data', leaderboards);
  });

  socket.on('create-table', ({ playerName, avatar }: { playerName: string; avatar?: string }) => {
    const tableId = `BJ-${Math.floor(100000 + Math.random() * 900000)}`;
    const table = createNewTable(tableId, socket.id);
    
    // Join first seat
    const firstPlayer: PlayerState = {
      id: socket.id,
      name: playerName || 'Host Player',
      chips: 1000,
      currentBet: 0,
      hand: [],
      status: 'idle',
      type: 'human',
      seatIndex: 0
    };

    table.players[socket.id] = firstPlayer;
    tables[tableId] = table;

    socket.join(tableId);
    socket.emit('table-created', { tableId, player: firstPlayer });
    io.to(tableId).emit('table-updated', table);
    io.to(tableId).emit('log-event', `${playerName} created a new table ${tableId}!`);
  });

  socket.on('join-table', ({ tableId, playerName }: { tableId: string; playerName: string }) => {
    const table = tables[tableId];
    if (!table) {
      socket.emit('join-error', 'Table not found. Please double-check the code.');
      return;
    }

    // Find first empty seat index
    const occupiedSeats = Object.values(table.players).map(p => p.seatIndex);
    let assignedSeat = -1;
    for (let s = 0; s < table.settings.seatsCount; s++) {
      if (!occupiedSeats.includes(s)) {
        assignedSeat = s;
        break;
      }
    }

    if (assignedSeat === -1) {
      socket.emit('join-error', 'Table is currently full. No available chairs.');
      return;
    }

    const newPlayer: PlayerState = {
      id: socket.id,
      name: playerName || `Player ${assignedSeat + 1}`,
      chips: 1000,
      currentBet: 0,
      hand: [],
      status: table.status === 'betting' ? 'betting' : 'idle',
      type: 'human',
      seatIndex: assignedSeat
    };

    table.players[socket.id] = newPlayer;
    socket.join(tableId);
    
    socket.emit('joined-table', { tableId, player: newPlayer });
    io.to(tableId).emit('table-updated', table);
    io.to(tableId).emit('log-event', `${playerName} joined the table at seat ${assignedSeat + 1}!`);

    // Broadcast current leaderboard as well
    socket.emit('leaderboard-data', leaderboards);
  });

  socket.on('add-bot', ({ tableId }: { tableId: string }) => {
    const table = tables[tableId];
    if (!table) return;

    // Check if seats available
    const occupiedSeats = Object.values(table.players).map(p => p.seatIndex);
    let assignedSeat = -1;
    for (let s = 0; s < table.settings.seatsCount; s++) {
      if (!occupiedSeats.includes(s)) {
        assignedSeat = s;
        break;
      }
    }

    if (assignedSeat === -1) {
      socket.emit('toast-error', 'No empty chairs available for a bot.');
      return;
    }

    // Random bot name
    const botName = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)] + ` #${Math.floor(10 + Math.random() * 89)}`;
    const botId = `bot-${Math.random().toString(36).substring(2, 7)}`;

    const botPlayer: PlayerState = {
      id: botId,
      name: botName,
      chips: 1000,
      currentBet: 0,
      hand: [],
      status: table.status === 'betting' ? 'betting' : 'idle',
      type: 'bot',
      seatIndex: assignedSeat
    };

    table.players[botId] = botPlayer;
    table.settings.botCount = Object.values(table.players).filter(p => p.type === 'bot').length;

    io.to(tableId).emit('table-updated', table);
    io.to(tableId).emit('log-event', `${botName} (Bot) has sat down at seat ${assignedSeat + 1}.`);

    // If game is in betting phase, bot will instantly place bet via the game tick
    if (table.status === 'betting') {
      runGameLoop(tableId);
    }
  });

  socket.on('remove-player', ({ tableId, playerId }: { tableId: string; playerId: string }) => {
    const table = tables[tableId];
    if (!table) return;

    const p = table.players[playerId];
    if (!p) return;

    const name = p.name;
    const isBot = p.type === 'bot';

    delete table.players[playerId];
    table.settings.botCount = Object.values(table.players).filter(pl => pl.type === 'bot').length;

    io.to(tableId).emit('table-updated', table);
    io.to(tableId).emit('log-event', `${name} ${isBot ? '(Bot)' : ''} stood up and left the chair.`);

    // If it was the active player's turn, shift turns
    if (table.status === 'playing' && table.activeSeatIndex === p.seatIndex) {
      moveToNextPlayerTurn(tableId);
    }
  });

  socket.on('place-bet', ({ tableId, amount }: { tableId: string; amount: number }) => {
    const table = tables[tableId];
    if (!table || table.status !== 'betting') return;

    const p = table.players[socket.id];
    if (!p || p.chips < amount || amount < table.settings.minBet || amount > table.settings.maxBet) {
      socket.emit('bet-error', 'Invalid bet amount or insufficient chips.');
      return;
    }

    p.currentBet = amount;
    p.chips -= amount;
    p.status = 'playing';

    io.to(tableId).emit('table-updated', table);
    io.to(tableId).emit('log-event', `${p.name} bet $${amount}.`);

    // Trigger check/update immediately
    runGameLoop(tableId);
  });

  socket.on('start-game', ({ tableId }: { tableId: string }) => {
    const table = tables[tableId];
    if (!table || table.hostId !== socket.id) return;

    // Start betting phase
    table.roundNumber = 1;
    table.status = 'betting';
    table.turnTimer = table.turnTimerMax;
    
    // Set active seats to betting state
    Object.values(table.players).forEach(p => {
      p.status = 'betting';
      p.hand = [];
      p.currentBet = 0;
    });

    io.to(tableId).emit('table-updated', table);
    io.to(tableId).emit('log-event', `The host has started the session! Place your initial bets.`);
    
    runGameLoop(tableId);
  });

  socket.on('player-action', ({ tableId, action }: { tableId: string; action: 'hit' | 'stand' | 'double' | 'surrender' | 'split' }) => {
    const table = tables[tableId];
    if (!table || table.status !== 'playing') return;

    const p = table.players[socket.id];
    if (!p || p.seatIndex !== table.activeSeatIndex || p.status !== 'playing') return;

    const deck = getTableDeck(tableId);

    if (action === 'split') {
      const val1 = p.hand[0]?.value;
      const val2 = p.hand[1]?.value;
      const getCardValue = (val: string) => ['J', 'Q', 'K', '10'].includes(val) ? 10 : (val === 'A' ? 11 : parseInt(val) || 0);
      const isSplittable = p.hand.length === 2 && (val1 === val2 || getCardValue(val1) === getCardValue(val2));

      if (!isSplittable) {
        socket.emit('toast-error', 'Hand is not eligible for a Split!');
        return;
      }
      if (p.chips < p.currentBet) {
        socket.emit('toast-error', 'Insufficient chips to split!');
        return;
      }

      // Execute Split
      const splitBet = p.currentBet;
      p.chips -= splitBet;
      p.splitBet = splitBet;
      p.splitHand = [p.hand.pop()!];
      p.splitStatus = 'playing';
      p.activeHandIndex = 0;

      // Deal a new card to both hands
      const card1 = deck.pop()!;
      card1.isRevealed = true;
      p.hand.push(card1);

      const card2 = deck.pop()!;
      card2.isRevealed = true;
      p.splitHand.push(card2);

      io.to(tableId).emit('log-event', `${p.name} split their hand of ${val1}s! Placed additional bet of $${splitBet}.`);
      io.to(tableId).emit('table-updated', table);
    } else if (action === 'hit') {
      if (p.splitHand && p.splitBet) {
        const card = deck.pop()!;
        card.isRevealed = true;

        if (p.activeHandIndex === 0) {
          p.hand.push(card);
          const score = calculateHandScore(p.hand);
          if (score > 21) {
            io.to(tableId).emit('log-event', `${p.name}'s first hand hits, gets ${card.value}${card.suit[0].toUpperCase()}, and BUSTS with ${score}! Switching to split hand.`);
            p.activeHandIndex = 1;
          } else if (score === 21) {
            io.to(tableId).emit('log-event', `${p.name}'s first hand hits, gets ${card.value}${card.suit[0].toUpperCase()}, and reaches 21! Switching to split hand.`);
            p.activeHandIndex = 1;
          } else {
            io.to(tableId).emit('log-event', `${p.name}'s first hand hits, gets ${card.value}${card.suit[0].toUpperCase()}. Hand total: ${score}.`);
          }
          io.to(tableId).emit('table-updated', table);
        } else {
          p.splitHand.push(card);
          const score = calculateHandScore(p.splitHand);
          if (score > 21) {
            p.splitStatus = 'bust';
            p.status = calculateHandScore(p.hand) > 21 ? 'bust' : 'stand';
            io.to(tableId).emit('log-event', `${p.name}'s split hand hits, gets ${card.value}${card.suit[0].toUpperCase()}, and BUSTS with ${score}! Turn complete.`);
            io.to(tableId).emit('table-updated', table);
            setTimeout(() => moveToNextPlayerTurn(tableId), 1200);
          } else if (score === 21) {
            p.splitStatus = 'stand';
            p.status = 'stand';
            io.to(tableId).emit('log-event', `${p.name}'s split hand hits, gets ${card.value}${card.suit[0].toUpperCase()}, and reaches 21! Turn complete.`);
            io.to(tableId).emit('table-updated', table);
            setTimeout(() => moveToNextPlayerTurn(tableId), 1200);
          } else {
            io.to(tableId).emit('log-event', `${p.name}'s split hand hits, gets ${card.value}${card.suit[0].toUpperCase()}. Split hand total: ${score}.`);
            io.to(tableId).emit('table-updated', table);
          }
        }
      } else {
        const card = deck.pop()!;
        card.isRevealed = true;
        p.hand.push(card);

        const score = calculateHandScore(p.hand);
        if (score > 21) {
          p.status = 'bust';
          io.to(tableId).emit('log-event', `${p.name} hits, gets ${card.value}${card.suit[0].toUpperCase()}, and BUSTS with ${score}!`);
          io.to(tableId).emit('table-updated', table);
          setTimeout(() => moveToNextPlayerTurn(tableId), 1200);
        } else if (score === 21) {
          p.status = 'stand';
          io.to(tableId).emit('log-event', `${p.name} hits, gets ${card.value}${card.suit[0].toUpperCase()}, and reaches 21!`);
          io.to(tableId).emit('table-updated', table);
          setTimeout(() => moveToNextPlayerTurn(tableId), 1200);
        } else {
          io.to(tableId).emit('log-event', `${p.name} hits, gets ${card.value}${card.suit[0].toUpperCase()}. Hand total is ${score}.`);
          io.to(tableId).emit('table-updated', table);
        }
      }
    } else if (action === 'stand') {
      if (p.splitHand && p.splitBet) {
        if (p.activeHandIndex === 0) {
          const score = calculateHandScore(p.hand);
          io.to(tableId).emit('log-event', `${p.name} stands on first hand (${score}). Switching to split hand.`);
          p.activeHandIndex = 1;
          io.to(tableId).emit('table-updated', table);
        } else {
          p.splitStatus = 'stand';
          p.status = 'stand';
          const score = calculateHandScore(p.splitHand);
          io.to(tableId).emit('log-event', `${p.name} stands on split hand (${score}). Turn complete.`);
          io.to(tableId).emit('table-updated', table);
          moveToNextPlayerTurn(tableId);
        }
      } else {
        p.status = 'stand';
        const score = calculateHandScore(p.hand);
        io.to(tableId).emit('log-event', `${p.name} stands on ${score}.`);
        io.to(tableId).emit('table-updated', table);
        moveToNextPlayerTurn(tableId);
      }
    } else if (action === 'double') {
      if (p.splitHand && p.splitBet) {
        if (p.activeHandIndex === 0) {
          if (p.chips < p.currentBet) {
            socket.emit('toast-error', 'Insufficient chips to Double Down on first hand!');
            return;
          }
          const doubleBet = p.currentBet;
          p.chips -= doubleBet;
          p.currentBet += doubleBet;

          const card = deck.pop()!;
          card.isRevealed = true;
          p.hand.push(card);

          const score = calculateHandScore(p.hand);
          io.to(tableId).emit('log-event', `${p.name} doubles down on first hand, gets ${card.value}${card.suit[0].toUpperCase()}. Bet is $${p.currentBet}. Score: ${score}. Switching to split hand.`);
          p.activeHandIndex = 1;
          io.to(tableId).emit('table-updated', table);
        } else {
          if (p.chips < p.splitBet) {
            socket.emit('toast-error', 'Insufficient chips to Double Down on split hand!');
            return;
          }
          const doubleBet = p.splitBet;
          p.chips -= doubleBet;
          p.splitBet += doubleBet;

          const card = deck.pop()!;
          card.isRevealed = true;
          p.splitHand.push(card);

          const score = calculateHandScore(p.splitHand);
          const firstScore = calculateHandScore(p.hand);

          if (score > 21) {
            p.splitStatus = 'bust';
            p.status = firstScore > 21 ? 'bust' : 'stand';
            io.to(tableId).emit('log-event', `${p.name} doubles down on split hand, gets ${card.value}${card.suit[0].toUpperCase()} and BUSTS with ${score}! Bet is $${p.splitBet}. Turn complete.`);
          } else {
            p.splitStatus = 'stand';
            p.status = 'stand';
            io.to(tableId).emit('log-event', `${p.name} doubles down on split hand, gets ${card.value}${card.suit[0].toUpperCase()}. Bet is $${p.splitBet}. Score: ${score}. Turn complete.`);
          }

          io.to(tableId).emit('table-updated', table);
          setTimeout(() => moveToNextPlayerTurn(tableId), 1200);
        }
      } else {
        // Validate eligibility
        if (p.hand.length !== 2) return;
        if (p.chips < p.currentBet) {
          socket.emit('toast-error', 'Insufficient chips to Double Down!');
          return;
        }

        const doubleBet = p.currentBet;
        p.chips -= doubleBet;
        p.currentBet += doubleBet;

        const card = deck.pop()!;
        card.isRevealed = true;
        p.hand.push(card);

        const score = calculateHandScore(p.hand);
        io.to(tableId).emit('log-event', `${p.name} doubles down, gets ${card.value}${card.suit[0].toUpperCase()}. Total bet: $${p.currentBet}. Hand: ${score}.`);
        
        if (score > 21) {
          p.status = 'bust';
        } else {
          p.status = 'stand';
        }

        io.to(tableId).emit('table-updated', table);
        setTimeout(() => moveToNextPlayerTurn(tableId), 1200);
      }
    } else if (action === 'surrender') {
      if (p.hand.length !== 2) return;
      p.status = 'surrendered';
      io.to(tableId).emit('log-event', `${p.name} surrenders hand and forfeits half of the bet.`);
      io.to(tableId).emit('table-updated', table);
      moveToNextPlayerTurn(tableId);
    }
  });

  socket.on('skip-timer', ({ tableId }: { tableId: string }) => {
    const table = tables[tableId];
    if (!table || table.hostId !== socket.id) return;

    if (table.status === 'betting') {
      table.turnTimer = 0;
      runGameLoop(tableId);
    } else if (table.status === 'round-over') {
      startNextRoundBetting(tableId);
    }
  });

  socket.on('leave-table', ({ tableId }: { tableId: string }) => {
    removePlayerFromTable(tableId, socket.id, 'left');
    socket.leave(tableId);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected socket id:', socket.id);
    
    // Check all tables and remove this player
    Object.keys(tables).forEach(tableId => {
      removePlayerFromTable(tableId, socket.id, 'disconnected and left');
    });
  });
});

// Setup dev server or static file hosting for production
async function startAppServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startAppServer();
