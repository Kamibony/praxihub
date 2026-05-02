'use client';

import React, { useState, useEffect, useRef } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase';
import { Play, Square, Volume2, Mic } from 'lucide-react';

type SlideState = 'Welcome' | 'Student View' | 'Institution View' | 'Coordinator View';
type AvatarState = 'idle' | 'loading' | 'speaking';

export default function ShowcasePage() {
  const [currentSlide, setCurrentSlide] = useState<SlideState>('Welcome');
  const [avatarState, setAvatarState] = useState<AvatarState>('idle');
  const [narration, setNarration] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      synthRef.current = window.speechSynthesis;
    }

    // Stop speaking when unmounted
    return () => {
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  const handleGenerateNarration = async (view: SlideState) => {
    setAvatarState('loading');
    setNarration('');

    try {
      const generateNarration = httpsCallable<{ viewContext: string }, { narration: string }>(functions, 'generateShowcaseNarration');
      const result = await generateNarration({ viewContext: view });
      setNarration(result.data.narration);
      setAvatarState('idle');
    } catch (error) {
      console.error('Narration Error:', error);
      setNarration('Nepodařilo se načíst data.');
      setAvatarState('idle');
    }
  };

  const handlePlayAudio = () => {
    if (!synthRef.current || !narration) return;

    synthRef.current.cancel(); // Stop anything currently playing

    const utterance = new SpeechSynthesisUtterance(narration);

    // Attempt to set a Slovak or Czech voice
    const voices = synthRef.current.getVoices();
    const preferredVoice = voices.find(v => v.lang.includes('sk') || v.lang.includes('cs'));
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onstart = () => {
      setAvatarState('speaking');
      setIsPlaying(true);
    };

    utterance.onend = () => {
      setAvatarState('idle');
      setIsPlaying(false);
    };

    utterance.onerror = () => {
      setAvatarState('idle');
      setIsPlaying(false);
    };

    synthRef.current.speak(utterance);
  };

  const handleStopAudio = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    setAvatarState('idle');
    setIsPlaying(false);
  };

  // Change slide effect
  useEffect(() => {
    handleGenerateNarration(currentSlide);
    handleStopAudio();
  }, [currentSlide]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center relative p-8">
      {/* Orb Avatar */}
      <div className="absolute top-8 right-8 flex flex-col items-center gap-4">
        <div className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500
          ${avatarState === 'idle' ? 'bg-indigo-900/50 shadow-[0_0_20px_rgba(49,46,129,0.5)]' : ''}
          ${avatarState === 'loading' ? 'bg-indigo-600 animate-pulse shadow-[0_0_30px_rgba(79,70,229,0.8)]' : ''}
          ${avatarState === 'speaking' ? 'bg-blue-500 animate-bounce shadow-[0_0_40px_rgba(59,130,246,0.8)]' : ''}
        `}>
          {avatarState === 'loading' && <Mic className="animate-spin text-white/50" />}
          {avatarState === 'speaking' && <Volume2 className="animate-pulse text-white" />}
          {avatarState === 'idle' && <div className="w-4 h-4 bg-white/20 rounded-full" />}
        </div>
        <div className="text-xs font-mono text-indigo-300 bg-indigo-900/30 px-3 py-1 rounded-full border border-indigo-500/30">
          AI: {avatarState.toUpperCase()}
        </div>
      </div>

      <div className="w-full max-w-6xl card-glass p-12 flex flex-col gap-8 min-h-[70vh]">

        {/* Navigation */}
        <div className="flex justify-center gap-4 border-b border-white/10 pb-6">
          {(['Welcome', 'Student View', 'Institution View', 'Coordinator View'] as SlideState[]).map(slide => (
            <button
              key={slide}
              onClick={() => setCurrentSlide(slide)}
              className={`px-6 py-2 rounded-full font-semibold transition ${
                currentSlide === slide
                  ? 'bg-indigo-600 text-white shadow-lg'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300'
              }`}
            >
              {slide}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col lg:flex-row gap-8">

          {/* Main Visual Placeholder */}
          <div className="flex-1 bg-slate-950/50 border border-white/5 rounded-2xl p-8 flex flex-col items-center justify-center relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/10 to-transparent opacity-50 group-hover:opacity-100 transition-opacity duration-700" />
            <h2 className="text-4xl font-extrabold text-white/80 mb-4 text-center tracking-tight z-10">
              {currentSlide}
            </h2>
            <div className="w-3/4 h-64 bg-slate-800/50 rounded-xl border border-white/10 border-dashed flex items-center justify-center z-10">
               <span className="text-slate-500 font-mono">[UI Screenshot Placeholder]</span>
            </div>
          </div>

          {/* AI Narration Panel */}
          <div className="w-full lg:w-1/3 flex flex-col gap-4">
            <div className="bg-slate-800/80 rounded-2xl p-6 border border-indigo-500/20 flex-1 flex flex-col">
              <h3 className="text-indigo-400 font-semibold mb-4 flex items-center gap-2">
                <BotIcon />
                Data-Grounded Narration
              </h3>

              <div className="flex-1 text-slate-300 leading-relaxed font-medium min-h-[150px]">
                {avatarState === 'loading' ? (
                  <div className="animate-pulse flex space-x-4">
                    <div className="flex-1 space-y-4 py-1">
                      <div className="h-2 bg-slate-700 rounded w-3/4"></div>
                      <div className="h-2 bg-slate-700 rounded"></div>
                      <div className="h-2 bg-slate-700 rounded w-5/6"></div>
                    </div>
                  </div>
                ) : (
                  narration
                )}
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-white/5">
                {!isPlaying ? (
                  <button
                    onClick={handlePlayAudio}
                    disabled={!narration || avatarState === 'loading'}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition disabled:opacity-50"
                  >
                    <Play size={18} /> Play Audio
                  </button>
                ) : (
                  <button
                    onClick={handleStopAudio}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg transition border border-red-500/20"
                  >
                    <Square size={18} /> Stop
                  </button>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function BotIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>
    </svg>
  );
}
