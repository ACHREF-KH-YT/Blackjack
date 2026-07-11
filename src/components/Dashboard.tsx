/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { History, MessageSquare, Landmark, CircleAlert, Sparkles } from 'lucide-react';
import { GameHistoryEntry } from '../types';

interface DashboardProps {
  history: GameHistoryEntry[];
  logs: string[];
  playerChips: number;
  playerName: string;
}

export default function Dashboard({ history, logs, playerChips, playerName }: DashboardProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full">
      {/* Real-time Ticker Feed */}
      <div className="bg-[#16191e] border border-slate-800 rounded-2xl flex flex-col h-[340px] overflow-hidden">
        <div className="p-4 border-b border-slate-800">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">LIVE TABLE LOGS</h3>
        </div>
        
        <div className="flex-1 p-4 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto bg-[#1a1d23] border border-slate-800/60 rounded-xl p-3 font-mono text-xs space-y-2 pr-2 custom-scrollbar">
            {logs.length === 0 ? (
              <div className="text-slate-600 italic text-center py-16">
                Waiting for events to occur at the table...
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {logs.map((log, index) => (
                  <motion.div
                    key={index + '-' + log.substring(0, 10)}
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="py-1 border-b border-[#0d0f12]/40 text-slate-300 last:border-0 flex gap-2 items-start"
                  >
                    <span className="text-emerald-500 font-bold select-none">›</span>
                    <span>{log}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>

      {/* Game History List */}
      <div className="bg-[#16191e] border border-slate-800 rounded-2xl flex flex-col h-[340px] overflow-hidden">
        <div className="p-4 border-b border-slate-800">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">HAND HISTORY LOGS</h3>
        </div>

        <div className="flex-1 p-4 overflow-y-auto space-y-3 custom-scrollbar">
          {history.length === 0 ? (
            <div className="text-slate-600 text-xs italic text-center py-20">
              No completed rounds recorded in this session.
            </div>
          ) : (
            history.map((entry) => {
              const outcomeColors: Record<string, string> = {
                win: 'text-emerald-400',
                blackjack: 'text-emerald-300 font-bold',
                push: 'text-indigo-400',
                lose: 'text-red-400',
                bust: 'text-red-500',
                surrender: 'text-slate-400',
              };

              return (
                <div
                  key={entry.id}
                  className="p-3 bg-[#1a1d23] border border-slate-800/80 rounded-xl space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-400 font-mono">
                      Round #{entry.roundNumber}
                    </span>
                    <span className="text-slate-500 text-[10px] font-mono">{entry.timestamp}</span>
                  </div>

                  {/* Dealer Result */}
                  <div className="flex justify-between items-center bg-[#0d0f12] px-2 py-1.5 rounded border border-slate-800/40">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Dealer Stand</span>
                    <span className="font-mono text-xs text-slate-300">
                      {entry.dealerScore} pts (Stands on {entry.dealerTarget})
                    </span>
                  </div>

                  {/* Player Hand Results */}
                  <div className="space-y-1">
                    {entry.players.map((ph, pi) => {
                      const isMe = ph.name.toLowerCase() === playerName.toLowerCase();
                      const statusLabel = ph.outcome.toUpperCase();
                      const isWin = ph.chipsChange > 0;
                      const isLose = ph.chipsChange < 0;

                      return (
                        <div
                          key={pi}
                          className={`flex items-center justify-between text-xs py-1.5 px-2 rounded-lg ${
                            isMe ? 'bg-[#0d0f12] border-l-2 border-emerald-500 pl-2' : 'border-l-2 border-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <span className={`font-medium ${isMe ? 'text-emerald-400 font-semibold' : 'text-slate-300'}`}>
                              {ph.name}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              (Bet ${ph.bet})
                            </span>
                          </div>

                          <div className="flex items-center gap-3 font-mono">
                            <span className="text-[10px] text-slate-400">
                              {ph.score} pts
                            </span>
                            <span className={`text-[10px] tracking-wider font-bold ${outcomeColors[ph.outcome] || 'text-slate-300'}`}>
                              {statusLabel}
                            </span>
                            <span className={isWin ? 'text-emerald-400 font-bold' : isLose ? 'text-red-400' : 'text-slate-400'}>
                              {ph.chipsChange >= 0 ? `+$${ph.chipsChange}` : `-$${Math.abs(ph.chipsChange)}`}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
