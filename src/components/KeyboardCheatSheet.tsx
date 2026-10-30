import React, { useState } from 'react';
import { Keyboard, ChevronDown, ChevronUp, Zap } from 'lucide-react';

interface KeyboardCheatSheetProps {
  activeKeys: Set<string>;
}

export const KeyboardCheatSheet: React.FC<KeyboardCheatSheetProps> = ({ activeKeys }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const shortcuts = [
    { keyDisplay: 'Space', keyMatch: ' ', label: 'Play / Pause' },
    { keyDisplay: '←', keyMatch: 'ArrowLeft', label: 'Jump -2s' },
    { keyDisplay: '→', keyMatch: 'ArrowRight', label: 'Jump +2s' },
    { keyDisplay: '[', keyMatch: '[', label: 'Set Point A' },
    { keyDisplay: ']', keyMatch: ']', label: 'Set Point B' },
    { keyDisplay: 'L', keyMatch: 'l', label: 'Toggle Loop' },
    { keyDisplay: '-', keyMatch: '-', label: 'Speed -5%' },
    { keyDisplay: '+', keyMatch: '=', label: 'Speed +5%' },
    { keyDisplay: 'Esc', keyMatch: 'Escape', label: 'Clear Loop' },
    { keyDisplay: 'A', keyMatch: 'a', label: 'Seek to A' },
    { keyDisplay: 'B', keyMatch: 'b', label: 'Seek to B' },
    { keyDisplay: 'S', keyMatch: 's', label: 'Save Phrase' },
  ];

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-lg transition-all">
      {/* Top Header toggle */}
      <div className="px-4 py-2.5 bg-zinc-900/80 border-b border-zinc-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Keyboard className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-bold text-zinc-200 tracking-tight">
            Hands-Free Guitarist Keystroke HUD
          </span>
          <span className="text-[10px] font-mono text-zinc-500 hidden sm:inline">
            (Active keypresses light up in real-time)
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-zinc-500 hover:text-zinc-300 p-1 rounded transition cursor-pointer"
        >
          {isCollapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Keystrokes Grid */}
      {!isCollapsed && (
        <div className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {shortcuts.map((sc) => {
            const isPressed =
              activeKeys.has(sc.keyMatch) ||
              activeKeys.has(sc.keyMatch.toLowerCase()) ||
              (sc.keyMatch === '=' && activeKeys.has('+'));

            return (
              <div
                key={sc.keyDisplay}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs font-mono transition-all duration-150 ${
                  isPressed
                    ? 'bg-amber-500 text-zinc-950 border-amber-300 shadow-md shadow-amber-500/30 scale-105'
                    : 'bg-zinc-900/60 border-zinc-800/80 text-zinc-300'
                }`}
              >
                <kbd
                  className={`px-1.5 py-0.5 rounded font-bold text-[11px] border ${
                    isPressed
                      ? 'bg-zinc-950 text-amber-400 border-zinc-900 shadow-inner'
                      : 'bg-zinc-950 text-zinc-300 border-zinc-700/80'
                  }`}
                >
                  {sc.keyDisplay}
                </kbd>
                <span className={`text-[11px] truncate ml-2 ${isPressed ? 'font-bold' : 'text-zinc-400'}`}>
                  {sc.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
