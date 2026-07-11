/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { Trophy, Award, Users, RefreshCw } from 'lucide-react';
import { LeaderboardEntry } from '../types';

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  onRefresh?: () => void;
}

export default function Leaderboard({ entries, onRefresh }: LeaderboardProps) {
  return (
    <div className="bg-[#16191e] border border-slate-800 rounded-2xl flex flex-col overflow-hidden">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">LEADERBOARD</h3>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="p-1 bg-[#1a1d23] hover:bg-slate-700 rounded border border-slate-750 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Refresh Leaderboard"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="p-4 space-y-2 max-h-[280px] overflow-y-auto custom-scrollbar">
        {entries.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-6">No players logged yet.</p>
        ) : (
          entries.map((entry, idx) => {
            const isTop3 = idx < 3;
            const rankStr = String(idx + 1).padStart(2, '0');

            return (
              <motion.div
                key={entry.name + idx}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="flex justify-between items-center bg-[#1a1d23] p-3 rounded-lg border border-slate-800/50 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-mono italic ${isTop3 ? 'text-emerald-500' : 'text-slate-500'}`}>
                    {rankStr}.
                  </span>
                  <div>
                    <span className="text-sm font-medium text-slate-200 block max-w-[120px] truncate">
                      {entry.name}
                    </span>
                    <span className="text-[10px] text-slate-500 uppercase font-mono">
                      {entry.wins}W • {entry.roundsPlayed}R
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-sm font-mono text-emerald-400 font-semibold block">
                    ${entry.chips >= 1000 ? `${(entry.chips / 1000).toFixed(1)}k` : entry.chips}
                  </span>
                  <span className="text-[9px] text-slate-500 uppercase tracking-wider block font-mono">Max Chips</span>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
