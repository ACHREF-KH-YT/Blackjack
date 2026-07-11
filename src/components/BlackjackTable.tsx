/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, 
  Cpu, 
  Settings, 
  PlusCircle, 
  LogOut, 
  CheckCircle2, 
  Timer, 
  Play, 
  RotateCcw, 
  TrendingUp, 
  Coins 
} from 'lucide-react';
import { TableState, PlayerState, Card } from '../types';
import CardItem from './CardItem';
import { calculateHandScore, isBlackjack } from '../gameUtils';

interface BlackjackTableProps {
  table: TableState;
  localPlayerId: string;
  onPlaceBet: (amount: number) => void;
  onPlayerAction: (action: 'hit' | 'stand' | 'double' | 'surrender' | 'split') => void;
  onAddBot: () => void;
  onRemovePlayer: (playerId: string) => void;
  onStartGame: () => void;
  onSkipTimer: () => void;
  onLeaveTable: () => void;
}

export default function BlackjackTable({
  table,
  localPlayerId,
  onPlaceBet,
  onPlayerAction,
  onAddBot,
  onRemovePlayer,
  onStartGame,
  onSkipTimer,
  onLeaveTable,
}: BlackjackTableProps) {
  const [betInput, setBetInput] = useState<number>(25);

  const localPlayer = table.players[localPlayerId];
  const isHost = table.hostId === localPlayerId;
  const isMyTurn = localPlayer && table.status === 'playing' && table.activeSeatIndex === localPlayer.seatIndex;

  // Group players by seat index
  const seats: (PlayerState | null)[] = Array(table.settings.seatsCount).fill(null);
  Object.values(table.players).forEach(p => {
    if (p.seatIndex >= 0 && p.seatIndex < table.settings.seatsCount) {
      seats[p.seatIndex] = p;
    }
  });

  // Calculate dealer score (only including revealed cards)
  const dealerScore = calculateHandScore(table.dealerHand.filter(c => c.isRevealed));
  const dealerHasBlackjack = isBlackjack(table.dealerHand);

  // Quick chip select
  const chipValues = [10, 25, 50, 100, 250];

  const handleChipClick = (val: number) => {
    if (!localPlayer) return;
    const nextBet = val;
    if (nextBet <= localPlayer.chips) {
      setBetInput(nextBet);
    }
  };

  return (
    <div className="w-full flex flex-col gap-6 font-sans">
      {/* Table Felt Area with Premium Stake Blue-Grey Gradient */}
      <div 
        id="blackjack-felt"
        className="relative bg-gradient-to-b from-[#1a2c38] to-[#0f212e] border-4 border-[#213743] rounded-3xl shadow-2xl p-6 sm:p-8 min-h-[520px] flex flex-col justify-between overflow-hidden"
      >
        {/* Subtle grid pattern overlay */}
        <div 
          className="absolute inset-0 opacity-15 pointer-events-none" 
          style={{ 
            backgroundImage: 'radial-gradient(circle at 50% 50%, #fff 0.5px, transparent 0.5px)', 
            backgroundSize: '24px 24px' 
          }}
        />

        {/* Stake-Style Center Felt Printed Guidelines */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none z-0 opacity-[0.05] mt-24">
          <div className="border border-white rounded-full w-[260px] h-[130px] flex flex-col items-center justify-center px-4 text-center">
            <span className="text-[10px] font-bold tracking-[0.2em] text-white uppercase mb-1 font-mono">Blackjack Pays 2 to 1</span>
            <span className="text-[8px] tracking-[0.15em] text-white uppercase max-w-[190px] font-mono">Dealer stands on all 17s</span>
          </div>
        </div>

        {/* Top Header Row (Dealer & Table Controls) */}
        <div className="z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center font-bold text-black text-xl">B</span>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-white">
                  BLACKJACK PRO <span className="text-emerald-500 text-xs ml-2 px-2 py-0.5 border border-emerald-500/30 rounded font-mono">LIVE</span>
                </h1>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">
                  Table #{table.id} • Stakes: ${table.settings.minBet}/{table.settings.maxBet}
                </p>
              </div>
            </div>
          </div>

          {/* Table Control Settings Panel for Host */}
          <div className="flex gap-2 items-center flex-wrap">
            {isHost && table.status === 'lobby' && (
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={onStartGame}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-lg shadow-emerald-900/20 cursor-pointer uppercase tracking-wider transition-all"
              >
                Start Game
              </motion.button>
            )}

            {isHost && (table.status === 'betting' || table.status === 'round-over') && (
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={onSkipTimer}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold border border-slate-700 cursor-pointer transition-all"
                title="Skip timer countdown"
              >
                Skip Timer ({table.turnTimer}s)
              </motion.button>
            )}

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={onLeaveTable}
              className="px-3 py-2 bg-red-950/20 hover:bg-red-900/40 text-red-400 border border-red-800/40 rounded-lg text-xs font-bold cursor-pointer transition-all"
            >
              Leave Table
            </motion.button>
          </div>
        </div>

        {/* Dealer Zone */}
        <div className="flex flex-col items-center gap-4 z-10 my-8">
          <div className="flex flex-col items-center gap-1.5">
            <div className="text-xs font-bold text-slate-400/75 uppercase tracking-[0.3em] font-mono">
              Dealer Stands on {table.dealerTarget}
            </div>
            {table.dealerHand.length > 0 && (
              <div className="bg-black/40 px-4 py-1 rounded-full border border-white/10 text-white font-mono text-xs">
                Hand: {dealerScore}
              </div>
            )}
          </div>

          {/* Dealer Card Pile */}
          <div className="flex gap-2 min-h-[112px] sm:min-h-[144px] items-center justify-center py-2 px-6 rounded-2xl border border-dashed border-slate-700/30 bg-black/30 w-full max-w-sm">
            {table.dealerHand.length === 0 ? (
              <span className="text-xs text-slate-500 font-mono uppercase tracking-wider">Awaiting round start...</span>
            ) : (
              <div className="flex -space-x-8 sm:-space-x-10">
                {table.dealerHand.map((card, idx) => (
                  <CardItem key={card.id} card={card} index={idx} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Player Positions Arc Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end z-10 my-4">
          {seats.map((player, seatIdx) => {
            const isSeatActiveTurn = table.status === 'playing' && table.activeSeatIndex === seatIdx;

            const isMe = player && player.id === localPlayerId;
            const activeHandIndex = (player && player.activeHandIndex) ?? 0;
            const isSplitMode = player ? !!player.splitHand : false;
            const activeHand = isSplitMode && activeHandIndex === 1 && player ? (player.splitHand || []) : (player ? player.hand : []);
            const activeScore = calculateHandScore(activeHand);
            const activeBet = isSplitMode && activeHandIndex === 1 && player ? (player.splitBet || player.currentBet) : (player ? player.currentBet : 0);

            const val1 = player ? player.hand[0]?.value : undefined;
            const val2 = player ? player.hand[1]?.value : undefined;
            const getCardValue = (val: string) => ['J', 'Q', 'K', '10'].includes(val) ? 10 : (val === 'A' ? 11 : parseInt(val) || 0);
            const isSplittable = player && player.hand.length === 2 && (val1 === val2 || (val1 && val2 && getCardValue(val1) === getCardValue(val2)));
            const showSplit = isSplittable && !isSplitMode && player && player.chips >= player.currentBet;

            const showDouble = activeHand.length === 2 && player && player.chips >= activeBet;
            const showSurrender = !isSplitMode && player && player.hand.length === 2;
            
            return (
              <div 
                key={seatIdx} 
                className="flex flex-col items-center gap-2 relative"
              >
                {/* Active Turn Highlight ring */}
                {isSeatActiveTurn && (
                  <span className="absolute -inset-1 rounded-2xl bg-emerald-500/10 border-2 border-emerald-400/60 animate-pulse pointer-events-none" />
                )}

                {player ? (
                  // Occupied Seat styled like a premium Bento block
                  <div className="w-full bg-[#1a1d23] border border-slate-800 rounded-2xl p-4 flex flex-col items-center shadow-lg relative transition-all">
                    {/* Discard button for bots */}
                    {isHost && player.type === 'bot' && (
                      <button
                        onClick={() => onRemovePlayer(player.id)}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-900/80 hover:bg-red-600 border border-red-700/50 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-md cursor-pointer transition-colors"
                        title="Remove Bot"
                      >
                        ×
                      </button>
                    )}

                    {/* Hand Score Badge */}
                    {player.hand.length > 0 && player.currentBet > 0 && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-[#0d0f12] border border-slate-800 rounded-md shadow-lg flex items-center gap-1.5">
                        <span className="text-[10px] font-mono font-bold text-white">
                          {player.splitHand ? 'SPLIT HANDS' : `${calculateHandScore(player.hand)} pts`}
                        </span>
                        {player.status === 'bust' && !player.splitHand && (
                          <span className="text-[9px] bg-red-950 text-red-400 border border-red-800/30 font-bold uppercase px-1 rounded font-mono">BUST</span>
                        )}
                        {player.status === 'blackjack' && !player.splitHand && (
                          <span className="text-[9px] bg-emerald-950 text-emerald-400 border border-emerald-800/30 font-bold uppercase px-1 rounded font-mono">BJ</span>
                        )}
                        {player.status === 'stand' && !player.splitHand && (
                          <span className="text-[9px] bg-slate-800 text-slate-300 font-bold uppercase px-1 rounded font-mono">STAND</span>
                        )}
                      </div>
                    )}

                    {/* Avatar Icon / Type */}
                    <div className="mb-2">
                      {player.type === 'bot' ? (
                        <div className="w-10 h-10 bg-slate-800 border border-slate-700 text-emerald-400 rounded-full flex items-center justify-center">
                          <Cpu className="w-4 h-4" />
                        </div>
                      ) : (
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          player.id === localPlayerId 
                            ? 'bg-emerald-600 border border-emerald-400 text-white' 
                            : 'bg-slate-800 border border-slate-700 text-slate-300'
                        }`}>
                          <User className="w-4 h-4" />
                        </div>
                      )}
                    </div>

                    {/* Name & Chips */}
                    <span className="text-xs font-bold text-slate-200 truncate max-w-[100px]">
                      {player.name}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mt-0.5">
                      ${player.chips.toLocaleString()}
                    </span>

                    {/* Current Bet stack */}
                    {player.currentBet > 0 ? (
                      <div className="mt-3 flex items-center gap-1.5 px-3 py-1 bg-black/40 border border-white/5 rounded-full">
                        <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 border border-dashed border-white/20 shadow-inner" />
                        <span className="text-xs font-mono font-bold text-emerald-400">${player.currentBet}</span>
                      </div>
                    ) : (
                      <div className="mt-3 text-[9px] text-slate-500 font-bold uppercase tracking-widest">
                        {table.status === 'betting' ? 'BETTING...' : 'WAITING'}
                      </div>
                    )}

                    {/* Cards Stack */}
                    <div className="mt-3 w-full flex flex-col gap-3 items-center">
                      {player.hand.length === 0 ? (
                        <div className="h-6 text-[10px] text-slate-600 font-mono uppercase tracking-wider flex items-center">No Cards</div>
                      ) : (
                        <div className="flex flex-col gap-2 items-center w-full">
                          {/* Main Hand */}
                          <div className={`flex flex-col items-center w-full p-1.5 rounded-xl transition-all ${player.splitHand && player.activeHandIndex === 0 ? 'bg-emerald-500/10 border border-emerald-500/30' : ''}`}>
                            {player.splitHand && (
                              <div className="text-[9px] uppercase font-bold text-slate-400 mb-1 flex items-center gap-1">
                                <span>Main Hand</span>
                                {player.activeHandIndex === 0 && table.activeSeatIndex === seatIdx && table.status === 'playing' && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                                )}
                              </div>
                            )}
                            <div className="flex -space-x-6 sm:-space-x-8 py-1 justify-center">
                              {player.hand.map((card, idx) => (
                                <CardItem key={card.id} card={card} index={idx} />
                              ))}
                            </div>
                            {player.splitHand && (
                              <span className="text-[10px] font-mono font-bold text-slate-400 mt-0.5">
                                Score: {calculateHandScore(player.hand)}
                              </span>
                            )}
                          </div>

                          {/* Split Hand */}
                          {player.splitHand && (
                            <div className={`flex flex-col items-center w-full p-1.5 rounded-xl transition-all ${player.activeHandIndex === 1 ? 'bg-emerald-500/10 border border-emerald-500/30' : ''}`}>
                              <div className="text-[9px] uppercase font-bold text-slate-400 mb-1 flex items-center gap-1">
                                <span>Split Hand</span>
                                {player.activeHandIndex === 1 && table.activeSeatIndex === seatIdx && table.status === 'playing' && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                                )}
                              </div>
                              <div className="flex -space-x-6 sm:-space-x-8 py-1 justify-center">
                                {player.splitHand.map((card, idx) => (
                                  <CardItem key={card.id} card={card} index={idx} />
                                ))}
                              </div>
                              <span className="text-[10px] font-mono font-bold text-slate-400 mt-0.5">
                                Score: {calculateHandScore(player.splitHand)}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* ACTIONS RENDERED HERE DIRECTLY IN CHAIR COHESIVELY */}
                    {isSeatActiveTurn && player.id === localPlayerId && (
                      <div className="mt-4 w-full border-t border-slate-850 pt-3 flex flex-col gap-2">
                        <div className="text-[10px] font-bold text-center uppercase tracking-widest text-emerald-400">
                          Your Turn {player.splitHand && `(${player.activeHandIndex === 1 ? 'Split Hand' : 'Main Hand'})`}
                        </div>
                        
                        {/* Compact Action Buttons */}
                        <div className="grid grid-cols-2 gap-2 w-full">
                          <button
                            onClick={() => onPlayerAction('hit')}
                            className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-emerald-950/20 cursor-pointer text-center"
                          >
                            Hit
                          </button>
                          <button
                            onClick={() => onPlayerAction('stand')}
                            className="py-2.5 px-3 bg-red-900/20 hover:bg-red-900/30 active:scale-95 text-red-400 border border-red-900/30 font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer text-center"
                          >
                            Stand
                          </button>
                        </div>

                        <div className="flex flex-col gap-1.5 mt-1 w-full">
                          {showDouble && (
                            <button
                              onClick={() => onPlayerAction('double')}
                              className="w-full py-2 bg-amber-600/10 hover:bg-amber-600/20 active:scale-95 text-amber-500 border border-amber-600/30 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all cursor-pointer text-center"
                            >
                              Double Down
                            </button>
                          )}

                          {showSplit && (
                            <button
                              onClick={() => onPlayerAction('split')}
                              className="w-full py-2 bg-indigo-600/10 hover:bg-indigo-600/30 active:scale-95 text-indigo-400 border border-indigo-500/30 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all cursor-pointer text-center"
                            >
                              Split Pair
                            </button>
                          )}

                          {showSurrender && (
                            <button
                              onClick={() => onPlayerAction('surrender')}
                              className="w-full py-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-400 border border-slate-700/50 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all cursor-pointer text-center"
                            >
                              Surrender
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Bot Turn Active Indicator inside Bot Chair */}
                    {isSeatActiveTurn && player.type === 'bot' && (
                      <div className="mt-4 w-full border-t border-slate-800 pt-3 flex flex-col items-center gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 animate-pulse">Bot Deciding...</span>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce delay-100" />
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce delay-200" />
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce delay-300" />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  // Empty Seat trigger
                  <button
                    onClick={onAddBot}
                    className="w-full h-32 rounded-2xl border-2 border-dashed border-white/10 hover:border-emerald-500/30 hover:bg-white/5 flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <span className="text-white/30 text-2xl font-light">+</span>
                    <span className="text-[9px] text-white/30 uppercase tracking-widest font-bold">Add Bot</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Local Player Bet Placing Phase Controls */}
      {localPlayer && table.status === 'betting' && localPlayer.currentBet === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#1a1d23] border border-slate-800 rounded-2xl p-5 shadow-2xl flex flex-col lg:flex-row items-center justify-between gap-6"
        >
          {/* AVAILABLE CHIPS WALLET BENTO */}
          <div className="w-full lg:w-1/3 flex flex-col justify-center border-b lg:border-b-0 lg:border-r border-slate-800 pb-4 lg:pb-0 lg:pr-6">
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">Available Chips</p>
            <div className="text-2xl font-mono text-emerald-400">${localPlayer.chips.toLocaleString()}</div>
            <div className="mt-2 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-500 transition-all duration-500" 
                style={{ width: `${Math.min(100, (localPlayer.chips / 2000) * 100)}%` }}
              />
            </div>
          </div>

          {/* CHIPS SELECTION & INPUT CLUSTER */}
          <div className="flex-1 w-full flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              {chipValues.map(val => (
                <button
                  key={val}
                  onClick={() => handleChipClick(val)}
                  disabled={localPlayer.chips < val}
                  className="relative w-11 h-11 rounded-full border-2 border-dashed border-white/30 font-mono font-extrabold text-xs flex items-center justify-center hover:scale-115 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer shadow-lg"
                  style={{
                    backgroundColor: val === 10 ? '#10b981' : val === 25 ? '#2563eb' : val === 50 ? '#dc2626' : val === 100 ? '#7c3aed' : '#d97706'
                  }}
                >
                  {val}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 uppercase font-bold mb-1">Bet Value</span>
                <input
                  type="number"
                  value={betInput}
                  min={table.settings.minBet}
                  max={Math.min(table.settings.maxBet, localPlayer.chips)}
                  onChange={(e) => setBetInput(Math.max(10, parseInt(e.target.value) || 10))}
                  className="px-3 py-2 bg-[#0d0f12] border border-slate-800 rounded-xl focus:outline-none focus:border-emerald-500 font-mono text-sm text-slate-200 w-24 text-center"
                />
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onPlaceBet(betInput)}
                className="flex-1 md:flex-initial px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs uppercase tracking-wider shadow-lg shadow-emerald-900/20 cursor-pointer transition-all mt-4"
              >
                Place Bet
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}
      {/* Spectator or Sitting-out banner */}
      {localPlayer && table.status === 'playing' && !isMyTurn && localPlayer.currentBet > 0 && (
        <div className="bg-[#16191e] border border-slate-800 rounded-xl p-4 text-center text-xs text-slate-400 uppercase tracking-wider font-mono">
          Waiting for other table players to play their hands...
        </div>
      )}

      {localPlayer && table.status === 'playing' && localPlayer.currentBet === 0 && (
        <div className="bg-emerald-950/20 border border-emerald-800/20 rounded-xl p-4 text-center text-xs text-emerald-400 uppercase tracking-widest font-mono">
          Spectating round. Ready to buy-in next round.
        </div>
      )}
    </div>
  );
}
