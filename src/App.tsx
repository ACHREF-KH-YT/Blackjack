/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Spade, 
  HelpCircle, 
  Sparkles, 
  TrendingUp, 
  Trophy, 
  History, 
  Tv, 
  Info,
  ChevronRight,
  RefreshCw,
  Coins
} from 'lucide-react';

import { TableState, LeaderboardEntry, PlayerState, GameHistoryEntry } from './types';
import TableLobby from './components/TableLobby';
import { playBlackjackSound } from './utils/audio';
import { calculateHandScore } from './gameUtils';
import BlackjackTable from './components/BlackjackTable';
import Leaderboard from './components/Leaderboard';
import Dashboard from './components/Dashboard';
import { 
  getLocalLeaderboard, 
  createLocalTable, 
  addBotToLocalTable, 
  removePlayerFromLocalTable, 
  placeLocalBet, 
  startLocalGame, 
  processLocalPlayerAction 
} from './utils/localGame';

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLocal, setIsLocal] = useState(false);
  
  // Player state persisting to localStorage
  const [playerName, setPlayerName] = useState(() => {
    return localStorage.getItem('bj_player_name') || `User-${Math.floor(100 + Math.random() * 900)}`;
  });

  const [tableId, setTableIdState] = useState<string | null>(null);
  const tableIdRef = useRef<string | null>(null);
  const setTableId = (val: string | null) => {
    setTableIdState(val);
    tableIdRef.current = val;
  };
  const [table, setTable] = useState<TableState | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(() => getLocalLeaderboard());
  const [logs, setLogs] = useState<string[]>([]);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showHowToPlay, setShowHowToPlay] = useState(false);

  // Sync player name changes to localStorage
  useEffect(() => {
    localStorage.setItem('bj_player_name', playerName);
  }, [playerName]);

  // Connect to the WebSocket server
  useEffect(() => {
    // Under development/production, Socket.IO is attached to the same host/port serving this SPA
    const socketInstance: Socket = io(window.location.origin, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socketInstance.on('connect', () => {
      console.log('Socket.IO connected:', socketInstance.id);
      setIsConnected(true);
    });

    socketInstance.on('disconnect', () => {
      console.log('Socket.IO disconnected');
      setIsConnected(false);
    });

    socketInstance.on('leaderboard-data', (data: LeaderboardEntry[]) => {
      setLeaderboard(data);
    });

    socketInstance.on('table-created', ({ tableId, player }: { tableId: string; player: PlayerState }) => {
      setTableId(tableId);
      setJoinError(null);
      showToast(`Table ${tableId} successfully hosted!`, 'success');
    });

    socketInstance.on('joined-table', ({ tableId, player }: { tableId: string; player: PlayerState }) => {
      setTableId(tableId);
      setJoinError(null);
      showToast(`Joined table ${tableId}!`, 'success');
    });

    socketInstance.on('join-error', (err: string) => {
      setJoinError(err);
      showToast(err, 'error');
    });

    socketInstance.on('toast-error', (err: string) => {
      showToast(err, 'error');
    });

    let previousHadBlackjack = false;

    socketInstance.on('table-updated', (updatedTable: TableState) => {
      setTable(updatedTable);

      if (socketInstance.id) {
        const localP = updatedTable.players[socketInstance.id];
        if (localP) {
          const mainScore = calculateHandScore(localP.hand);
          const splitScore = localP.splitHand ? calculateHandScore(localP.splitHand) : 0;
          const hasBJ = localP.status === 'blackjack' || 
                        (localP.hand.length === 2 && mainScore === 21) || 
                        (localP.splitHand && localP.splitHand.length === 2 && splitScore === 21);

          if (hasBJ && !previousHadBlackjack) {
            playBlackjackSound();
          }
          previousHadBlackjack = hasBJ;
        } else {
          previousHadBlackjack = false;
        }
      }
    });

    socketInstance.on('log-event', (message: string) => {
      setLogs(prev => [message, ...prev].slice(0, 100));
    });

    socketInstance.on('round-concluded', (entry: GameHistoryEntry) => {
      // Show summary highlight toast for local player if actually in the table
      if (socketInstance.id && tableIdRef.current) {
        const localResult = entry.players.find(p => p.name.toLowerCase() === playerName.toLowerCase());
        if (localResult) {
          const change = localResult.chipsChange;
          if (localResult.outcome === 'blackjack') {
            showToast(`🎰 BLACKJACK! You won $${change}!`, 'success');
          } else if (change > 0) {
            showToast(`🎉 You won $${change}!`, 'success');
          } else if (change < 0) {
            showToast(`📉 You lost $${Math.abs(change)}.`, 'error');
          } else {
            showToast(`🤝 Push! Your bet was returned.`, 'info');
          }
        }
      }
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [playerName]);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Socket action emitters or local game fallbacks
  const handleHostTable = () => {
    if (!playerName.trim()) return;

    if (!socket || !isConnected) {
      // Boot in local offline mode
      setIsLocal(true);
      const localId = 'local-player-1';
      const lobbyId = `BJ-LOCAL-${Math.floor(100000 + Math.random() * 900000)}`;
      const newTable = createLocalTable(lobbyId, localId, playerName.trim());
      setTableId(lobbyId);
      setTable(newTable);
      setLogs([`Table ${lobbyId} hosted in OFFLINE mode (Perfect for Vercel & GitHub!)`]);
      showToast(`Offline table hosted! Enjoy bot chairs and persistent leaderboards.`, 'success');
      return;
    }

    socket.emit('create-table', { playerName: playerName.trim() });
  };

  const handleJoinTable = (code: string) => {
    if (!playerName.trim() || !code.trim()) return;

    if (!socket || !isConnected) {
      // Boot in local offline mode
      setIsLocal(true);
      const localId = 'local-player-1';
      const cleanCode = code.toUpperCase().trim();
      const newTable = createLocalTable(cleanCode, localId, playerName.trim());
      setTableId(cleanCode);
      setTable(newTable);
      setLogs([`Joined local table ${cleanCode}! Playing against bots offline.`]);
      showToast(`Joined offline table ${cleanCode}!`, 'success');
      return;
    }

    socket.emit('join-table', { tableId: code, playerName: playerName.trim() });
  };

  const handlePlaceBet = (amount: number) => {
    if (isLocal) {
      if (!table) return;
      const onLog = (msg: string) => setLogs(prev => [msg, ...prev].slice(0, 100));
      const updatedTable = placeLocalBet(table, 'local-player-1', amount, onLog);
      setTable(updatedTable);

      // Trigger blackjack sound if natural blackjack was dealt immediately
      const localP = updatedTable.players['local-player-1'];
      if (localP) {
        const score = calculateHandScore(localP.hand);
        if (score === 21 && localP.hand.length === 2) {
          playBlackjackSound();
        }
      }

      // If round has concluded instantly (e.g. dealer blackjack/bust or player blackjack)
      if (updatedTable.status === 'round-over') {
        const entry = updatedTable.history[0];
        if (entry) {
          const localResult = entry.players.find(p => p.name.toLowerCase() === playerName.toLowerCase());
          if (localResult) {
            const change = localResult.chipsChange;
            if (localResult.outcome === 'blackjack') {
              showToast(`🎰 BLACKJACK! You won $${change}!`, 'success');
            } else if (change > 0) {
              showToast(`🎉 You won $${change}!`, 'success');
            } else if (change < 0) {
              showToast(`📉 You lost $${Math.abs(change)}.`, 'error');
            } else {
              showToast(`🤝 Push! Your bet was returned.`, 'info');
            }
          }
          setLeaderboard(getLocalLeaderboard());
        }
      }
      return;
    }

    if (!socket || !tableId) return;
    socket.emit('place-bet', { tableId, amount });
  };

  const handlePlayerAction = (action: 'hit' | 'stand' | 'double' | 'surrender' | 'split') => {
    if (isLocal) {
      if (!table) return;
      const onLog = (msg: string) => setLogs(prev => [msg, ...prev].slice(0, 100));
      const onToast = (text: string, type: 'success' | 'error' | 'info') => showToast(text, type);
      const updatedTable = processLocalPlayerAction(table, 'local-player-1', action, onLog, onToast);
      setTable(updatedTable);

      // Check for blackjack sound
      const localP = updatedTable.players['local-player-1'];
      if (localP) {
        const mainScore = calculateHandScore(localP.hand);
        const splitScore = localP.splitHand ? calculateHandScore(localP.splitHand) : 0;
        const hasBJ = localP.status === 'blackjack' || 
                      (localP.hand.length === 2 && mainScore === 21) || 
                      (localP.splitHand && localP.splitHand.length === 2 && splitScore === 21);
        if (hasBJ) {
          playBlackjackSound();
        }
      }

      // If round has concluded, trigger the success toasts and update leaderboard
      if (updatedTable.status === 'round-over') {
        const entry = updatedTable.history[0];
        if (entry) {
          const localResult = entry.players.find(p => p.name.toLowerCase() === playerName.toLowerCase());
          if (localResult) {
            const change = localResult.chipsChange;
            if (localResult.outcome === 'blackjack') {
              showToast(`🎰 BLACKJACK! You won $${change}!`, 'success');
            } else if (change > 0) {
              showToast(`🎉 You won $${change}!`, 'success');
            } else if (change < 0) {
              showToast(`📉 You lost $${Math.abs(change)}.`, 'error');
            } else {
              showToast(`🤝 Push! Your bet was returned.`, 'info');
            }
          }
          setLeaderboard(getLocalLeaderboard());
        }
      }
      return;
    }

    if (!socket || !tableId) return;
    socket.emit('player-action', { tableId, action });
  };

  const handleAddBot = () => {
    if (isLocal) {
      if (!table) return;
      const updatedTable = addBotToLocalTable(table);
      setTable(updatedTable);
      setLogs(prev => [`Bot added to the table.`, ...prev]);
      return;
    }

    if (!socket || !tableId) return;
    socket.emit('add-bot', { tableId });
  };

  const handleRemovePlayer = (pId: string) => {
    if (isLocal) {
      if (!table) return;
      const updatedTable = removePlayerFromLocalTable(table, pId);
      setTable(updatedTable);
      setLogs(prev => [`Bot or player removed from table.`, ...prev]);
      return;
    }

    if (!socket || !tableId) return;
    socket.emit('remove-player', { tableId, playerId: pId });
  };

  const handleStartGame = () => {
    if (isLocal) {
      if (!table) return;
      const onLog = (msg: string) => setLogs(prev => [msg, ...prev].slice(0, 100));
      const updatedTable = startLocalGame(table, onLog);
      setTable(updatedTable);
      return;
    }

    if (!socket || !tableId) return;
    socket.emit('start-game', { tableId });
  };

  const handleSkipTimer = () => {
    if (isLocal) return;

    if (!socket || !tableId) return;
    socket.emit('skip-timer', { tableId });
  };

  const handleLeaveTable = () => {
    if (isLocal) {
      setIsLocal(false);
      setTableId(null);
      setTable(null);
      setLogs([]);
      setLeaderboard(getLocalLeaderboard());
      return;
    }

    if (socket && tableId) {
      socket.emit('leave-table', { tableId });
    }
    setTableId(null);
    setTable(null);
    setLogs([]);
    if (socket) {
      socket.emit('get-leaderboard');
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0c0f] text-slate-200 flex flex-col font-sans antialiased selection:bg-emerald-500/20 relative overflow-x-hidden">
      {/* Stake-like subtle grid pattern */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none z-0" 
        style={{ 
          backgroundImage: `
            linear-gradient(to right, #ffffff 1px, transparent 1px),
            linear-gradient(to bottom, #ffffff 1px, transparent 1px)
          `,
          backgroundSize: '24px 24px'
        }}
      />
      {/* Stake-style ambient glows */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-blue-500/5 blur-[120px] pointer-events-none z-0" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-emerald-500/5 blur-[120px] pointer-events-none z-0" />
      {/* Toast Notification Container */}
      <div className="fixed top-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full px-4">
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, y: -20 }}
              className={`p-4 rounded-xl border shadow-xl flex items-center justify-between gap-3 text-xs font-semibold ${
                toastMessage.type === 'success'
                  ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-300 shadow-emerald-900/10'
                  : toastMessage.type === 'error'
                  ? 'bg-red-950/90 border-red-500/30 text-red-300 shadow-red-900/10'
                  : 'bg-[#1a1d23]/95 border-slate-700/50 text-slate-300 shadow-black/40'
              }`}
            >
              <span>{toastMessage.text}</span>
              <button 
                onClick={() => setToastMessage(null)} 
                className="text-[10px] uppercase tracking-wider text-slate-500 hover:text-white font-mono"
              >
                Dismiss
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Global Header Styled as a Premium Bento Section */}
      <header className="border-b border-slate-800 bg-[#1a1d23]/95 backdrop-blur-sm sticky top-0 z-40 px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center font-bold text-black text-2xl shadow-lg shadow-emerald-500/20">
            <Spade className="w-5 h-5 text-black fill-black" />
          </div>
          <div>
            <span className="font-bold tracking-tight text-white uppercase text-sm sm:text-base flex items-center gap-2">
              BLACKJACK PRO <span className="text-emerald-500 text-[10px] px-2 py-0.5 border border-emerald-500/30 rounded font-mono tracking-wider">LIVE</span>
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${isLocal ? 'bg-emerald-400' : (isConnected ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse')}`} />
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest font-mono">
                {isLocal ? 'OFFLINE Practice Mode (Active)' : (isConnected ? 'MULTIPLAYER ONLINE' : 'OFFLINE Practice Mode (Standby)')}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHowToPlay(!showHowToPlay)}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">How To Play</span>
          </button>
        </div>
      </header>

      {/* Quick Instruction Collapsible Overlay */}
      <AnimatePresence>
        {showHowToPlay && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-[#16191e] border-b border-slate-850 px-4 sm:px-6 py-6 text-xs text-slate-300 overflow-hidden"
          >
            <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h4 className="font-bold text-white mb-1.5 uppercase tracking-widest flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Custom Rigged Dealer</span>
                </h4>
                <p className="leading-relaxed text-slate-400">
                  To keep the matchups thrilling, the dealer always hits or stands to get exactly <span className="text-emerald-400 font-bold">18 or 19 points</span> randomly, pre-determined at round start.
                </p>
              </div>
              <div>
                <h4 className="font-bold text-white mb-1.5 uppercase tracking-widest flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Standard Actions</span>
                </h4>
                <p className="leading-relaxed text-slate-400">
                  Choose <span className="font-semibold text-white">Hit</span> for a new card, <span className="font-semibold text-white">Stand</span> to lock score, <span className="font-semibold text-white">Double</span> to double bet & receive 1 card, or <span className="font-semibold text-white">Surrender</span> to forfeit 50% bet.
                </p>
              </div>
              <div>
                <h4 className="font-bold text-white mb-1.5 uppercase tracking-widest flex items-center gap-1">
                  <Trophy className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Bots & Friend Seats</span>
                </h4>
                <p className="leading-relaxed text-slate-400">
                  Add custom bot chairs to empty seats to play with companions. Share your Table Code so friends can join your table in real time!
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main App Body */}
      <main className="flex-1 px-4 sm:px-6 py-8 max-w-7xl w-full mx-auto flex flex-col gap-8">
        {!tableId ? (
          // TABLE LOBBY STATE (NOT YET JOINED)
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-2">
              <TableLobby
                playerName={playerName}
                setPlayerName={setPlayerName}
                onHost={handleHostTable}
                onJoin={handleJoinTable}
                joinError={joinError}
              />
            </div>
            
            <div className="space-y-6">
              {/* Leaderboard panel */}
              <Leaderboard 
                entries={leaderboard} 
                onRefresh={() => socket?.emit('get-leaderboard')}
              />

              {/* Server Details Info Card */}
              <div className="bg-[#16191e] border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-emerald-400" />
                  <span>BLACKJACK RULES</span>
                </h3>
                <ul className="space-y-2 text-xs text-slate-400 leading-normal">
                  <li className="flex items-start gap-1.5">
                    <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0 mt-0.5" />
                    <span>Four full decks in shoe shuffled dynamically.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0 mt-0.5" />
                    <span>Standard payout split: 3:2 on Blackjack, 1:1 on Win.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0 mt-0.5" />
                    <span>Split actions are currently limited to double downs to maintain maximum speed.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0 mt-0.5" />
                    <span>Bankrupt accounts receive a courtesy refill of $500 automatically.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        ) : (
          // TABLE ACTIVE STATE
          <div className="flex flex-col gap-8">
            {/* 1. Blackjack Felt Table */}
            {table ? (
              <BlackjackTable
                table={table}
                localPlayerId={isLocal ? 'local-player-1' : (socket?.id || '')}
                onPlaceBet={handlePlaceBet}
                onPlayerAction={handlePlayerAction}
                onAddBot={handleAddBot}
                onRemovePlayer={handleRemovePlayer}
                onStartGame={handleStartGame}
                onSkipTimer={handleSkipTimer}
                onLeaveTable={handleLeaveTable}
              />
            ) : (
              <div className="p-20 text-center bg-[#16191e] border border-slate-800 rounded-2xl">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mx-auto"></div>
                <p className="text-xs text-slate-400 mt-4 font-mono uppercase tracking-wider">Synchronizing table state...</p>
              </div>
            )}

            {/* 2. Side-by-side Live Dashboard (Logs & History) */}
            {table && (
              <Dashboard
                history={table.history}
                logs={logs}
                playerChips={table.players[isLocal ? 'local-player-1' : (socket?.id || '')]?.chips || 0}
                playerName={playerName}
              />
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-[#0d0f12] py-6 text-center text-xs text-slate-600 mt-auto">
        <p>© 2026 Blackjack Club • Bento Grid High-Fidelity Table Edition</p>
      </footer>
    </div>
  );
}
