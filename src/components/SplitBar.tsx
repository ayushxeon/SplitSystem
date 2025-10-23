import React from 'react';
import { Lock } from 'lucide-react';
import type { Person } from '../types/types';

interface SplitBarProps {
  participants: string[];
  splits: Record<string, number>;
  frozenSplits: string[];
  people: Record<string, Person>;
  onDividerDrag: (index: number, event: React.MouseEvent) => void;
}

export function SplitBar({ participants, splits, frozenSplits, people, onDividerDrag }: SplitBarProps) {
  let cumulative = 0;
  
  return (
    <div id="split-bar-container" className="relative h-20 bg-gray-200 rounded-lg overflow-hidden mb-4 shadow-inner select-none">
      {participants.map((personId, index) => {
        const person = people[personId];
        const percentage = parseInt(splits[personId]?.toString() || '0');
        const isFrozen = frozenSplits.includes(personId);
        const startPos = cumulative;
        cumulative += percentage;
        
        return (
          <React.Fragment key={personId}>
            <div
              className="absolute top-0 h-full flex flex-col items-center justify-center text-white font-semibold text-sm px-2 overflow-hidden transition-all"
              style={{
                left: `${startPos}%`,
                width: `${percentage}%`,
                backgroundColor: `hsl(${(index * 360) / participants.length}, 70%, 55%)`,
                borderRight: index < participants.length - 1 ? '2px solid white' : 'none'
              }}
            >
              <div className="truncate text-xs">{person?.name || `ID:${personId}`}</div>
              <div className="font-bold">{percentage}%</div>
              {isFrozen && <Lock size={12} className="mt-1" />}
            </div>
            
            {index < participants.length - 1 && (
              <div
                className="absolute top-0 h-full w-2 bg-white shadow-lg cursor-ew-resize hover:w-3 hover:bg-indigo-300 transition-all z-10"
                style={{ left: `calc(${cumulative}% - 1px)` }}
                onMouseDown={(e) => onDividerDrag(index, e)}
                title="Drag to adjust split"
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}