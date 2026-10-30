import React, { useEffect, useState } from 'react';

interface AudioVUMeterProps {
  isPlaying: boolean;
}

export const AudioVUMeter: React.FC<AudioVUMeterProps> = ({ isPlaying }) => {
  const [levels, setLevels] = useState<{ left: number; right: number }>({ left: 0, right: 0 });

  useEffect(() => {
    if (!isPlaying) {
      setLevels({ left: 0, right: 0 });
      return;
    }

    const interval = setInterval(() => {
      // Simulate dynamic audio program level bounce
      const base = 0.55 + Math.random() * 0.35;
      const left = Math.min(1, Math.max(0, base + (Math.random() - 0.5) * 0.2));
      const right = Math.min(1, Math.max(0, base + (Math.random() - 0.5) * 0.2));
      setLevels({ left, right });
    }, 70);

    return () => clearInterval(interval);
  }, [isPlaying]);

  const renderSegments = (val: number) => {
    const totalSegments = 14;
    const activeSegments = Math.round(val * totalSegments);

    return (
      <div className="flex items-center gap-0.5">
        {Array.from({ length: totalSegments }).map((_, i) => {
          const isActive = i < activeSegments;
          // color tiers: green (0-8), yellow/amber (9-11), red (12-13)
          let colorClass = 'bg-emerald-500/80';
          if (i >= 9 && i < 12) colorClass = 'bg-amber-400';
          if (i >= 12) colorClass = 'bg-red-500';

          return (
            <div
              key={i}
              className={`w-1.5 h-3 rounded-xs transition-opacity duration-75 ${
                isActive ? `${colorClass} shadow-xs` : 'bg-zinc-800/60 opacity-30'
              }`}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800/80 px-2.5 py-1 rounded-lg">
      <div className="flex flex-col gap-0.5 font-mono text-[9px] text-zinc-500 select-none">
        <span>L</span>
        <span>R</span>
      </div>
      <div className="flex flex-col gap-0.5">
        {renderSegments(levels.left)}
        {renderSegments(levels.right)}
      </div>
    </div>
  );
};
