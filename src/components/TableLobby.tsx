/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Spade, Key, Users, Sparkles, HelpCircle } from 'lucide-react';

interface TableLobbyProps {
  playerName: string;
  setPlayerName: (name: string) => void;
  onHost: () => void;
  onJoin: (tableId: string) => void;
  joinError: string | null;
}

export default function TableLobby({
  playerName,
  setPlayerName,
  onHost,
  onJoin,
  joinError,
}: TableLobbyProps) {
  const [tableCode, setTableCode] = useState('');

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableCode.trim()) return;
    onJoin(tableCode.toUpperCase().trim());
  };

  return (
    <div className="min-h-screen bg-[#0d0f12] text-slate-200 flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden font-sans">
      {/* Decorative bento-inspired background lights */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md bg-[#1a1d23] border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 z-10"
      >
        {/* Header/Title */}
        <div className="flex flex-col items-center mb-8">
          <motion.div
            initial={{ rotate: -10, scale: 0.9 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: 'spring', delay: 0.1 }}
            className="w-12 h-12 bg-emerald-500 rounded-lg flex items-center justify-center font-bold text-black text-2xl shadow-lg shadow-emerald-500/20 mb-4"
          >
            <Spade className="w-6 h-6 text-black fill-black" />
          </motion.div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            BLACKJACK PRO <span className="text-emerald-500 text-xs ml-1.5 px-2 py-0.5 border border-emerald-500/30 rounded inline-block font-mono tracking-wide align-middle">LIVE</span>
          </h1>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1.5 text-center">
            Server-Authoritative Real-Time Multiplayer
          </p>
        </div>

        {/* Form Inputs */}
        <div className="space-y-6">
          {/* Player Name */}
          <div>
            <label htmlFor="playerName" className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
              Your Avatar Name
            </label>
            <input
              type="text"
              id="playerName"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="e.g. CardShark, SakaBot"
              maxLength={15}
              className="w-full px-4 py-3 bg-[#0d0f12] border border-slate-800 rounded-xl focus:outline-none focus:border-emerald-500 text-slate-200 placeholder-slate-600 transition-colors"
            />
          </div>

          <hr className="border-slate-800 my-2" />

          {/* Action Blocks */}
          <div className="grid grid-cols-1 gap-4">
            {/* Host Table */}
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={onHost}
              disabled={!playerName.trim()}
              className="w-full flex items-center justify-center gap-3 px-5 py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold rounded-lg shadow-lg shadow-emerald-900/20 transition-all cursor-pointer text-sm"
            >
              <Users className="w-4 h-4" />
              <span>CREATE & HOST TABLE</span>
            </motion.button>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-slate-850"></div>
              <span className="flex-shrink mx-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">or</span>
              <div className="flex-grow border-t border-slate-850"></div>
            </div>

            {/* Join Table Form */}
            <form onSubmit={handleJoinSubmit} className="space-y-3">
              <div>
                <label htmlFor="tableCode" className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                  Have an invitation code?
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    id="tableCode"
                    value={tableCode}
                    onChange={(e) => setTableCode(e.target.value.toUpperCase())}
                    placeholder="BJ-XXXXXX"
                    className="flex-1 px-4 py-3 bg-[#0d0f12] border border-slate-800 rounded-xl focus:outline-none focus:border-emerald-500 text-slate-200 placeholder-slate-600 transition-colors uppercase font-mono tracking-wider text-sm"
                  />
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={!playerName.trim() || !tableCode.trim()}
                    className="px-6 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 disabled:text-slate-600 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl border border-slate-700/50 cursor-pointer uppercase tracking-wider"
                  >
                    Join
                  </motion.button>
                </div>
              </div>
            </form>
          </div>

          {/* Join Errors */}
          {joinError && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-center"
            >
              <p className="text-xs font-medium text-rose-400">{joinError}</p>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
