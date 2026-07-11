/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Plays a celebratory sound when a player hits Blackjack.
 * Combines a synthesized retro casino arpeggio (Web Audio API)
 * with a spoken voice synthesis saying "Blackjack!"
 */
export function playBlackjackSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      const ctx = new AudioContextClass();
      
      const playTone = (freq: number, startTime: number, duration: number, type: 'sine' | 'square' | 'sawtooth' | 'triangle' = 'triangle') => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = type;
        osc.frequency.setValueAtTime(freq, startTime);
        
        gain.gain.setValueAtTime(0.18, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(startTime);
        osc.stop(startTime + duration);
      };

      const now = ctx.currentTime;
      // An elegant casino arpeggio (C Major chord rising with sparkle)
      playTone(523.25, now, 0.15, 'triangle');       // C5
      playTone(659.25, now + 0.08, 0.15, 'triangle'); // E5
      playTone(783.99, now + 0.16, 0.15, 'triangle'); // G5
      playTone(1046.50, now + 0.24, 0.4, 'sine');     // C6
    }
  } catch (e) {
    console.warn('AudioContext playback error or blocked:', e);
  }

  try {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance('Blackjack!');
      utterance.pitch = 1.25; // Energetic, cheerful pitch
      utterance.rate = 1.05;  // Energetic pace
      utterance.volume = 1.0;
      
      const voices = window.speechSynthesis.getVoices();
      // Look for a natural english voice
      const englishVoice = voices.find(v => v.lang.startsWith('en')) || voices[0];
      if (englishVoice) {
        utterance.voice = englishVoice;
      }
      
      window.speechSynthesis.speak(utterance);
    }
  } catch (e) {
    console.warn('SpeechSynthesis error or blocked:', e);
  }
}
