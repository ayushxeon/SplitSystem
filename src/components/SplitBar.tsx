import React from 'react';
import { Lock, GripVertical } from 'lucide-react';
import type { Person } from '../types/types';

interface SplitBarProps {
  participants: string[];
  splits: Record<string, number>;
  frozenSplits: string[];
  people: Record<string, Person>;
  onDividerDrag: (index: number, event: React.PointerEvent) => void;
}

export function SplitBar({ participants, splits, frozenSplits, people, onDividerDrag }: SplitBarProps) {
  let cumulative = 0;
  
  const handleDragStart = (index: number, event: React.PointerEvent) => {
    event.preventDefault();
    onDividerDrag(index, event);
  };
  
  return (
    <div className="mb-6">
      {/* Instructions for mobile users */}
      <div className="flex items-center gap-2 mb-2 text-xs text-gray-600">
        <GripVertical size={14} className="text-indigo-500" />
        <span>Drag the handles to adjust split percentages</span>
      </div>
      
      <div 
        id="split-bar-container" 
        className="relative h-24 sm:h-20 bg-gradient-to-r from-gray-100 to-gray-200 rounded-xl overflow-hidden shadow-inner select-none border-2 border-gray-300"
      >
        {participants.map((personId, index) => {
          const person = people[personId];
          const percentage = parseInt(splits[personId]?.toString() || '0');
          const isFrozen = frozenSplits.includes(personId);
          const startPos = cumulative;
          cumulative += percentage;
          
          return (
            <React.Fragment key={personId}>
              {/* Person segment */}
              <div
                className="absolute top-0 h-full flex flex-col items-center justify-center text-white font-semibold px-2 overflow-hidden transition-all duration-150"
                style={{
                  left: `${startPos}%`,
                  width: `${percentage}%`,
                  backgroundColor: `hsl(${(index * 360) / participants.length}, 70%, 55%)`,
                }}
              >
                <div className="truncate text-xs sm:text-sm">{person?.name || `ID:${personId}`}</div>
                <div className="font-bold text-lg sm:text-xl">{percentage}%</div>
                {isFrozen && (
                  <div className="flex items-center gap-1 text-xs mt-1 bg-black/20 px-2 py-0.5 rounded-full">
                    <Lock size={10} />
                    <span>Locked</span>
                  </div>
                )}
              </div>
              
              {/* Draggable divider with handle */}
              {index < participants.length - 1 && (
                <div
                  className="absolute top-0 h-full flex items-center justify-center z-20 group cursor-ew-resize touch-none"
                  style={{ 
                    left: `${cumulative}%`,
                    transform: 'translateX(-50%)',
                    width: '44px', // Large touch target (recommended 44x44 for mobile)
                  }}
                  onPointerDown={(e) => handleDragStart(index, e)}
                  title="Drag to adjust split"
                >
                  {/* Visual handle */}
                  <div className="relative flex flex-col items-center">
                    {/* Vertical line */}
                    <div className="absolute inset-y-0 w-1 bg-white shadow-lg group-active:bg-indigo-400 transition-colors" />
                    
                    {/* Grip handle - visible always on mobile, on hover on desktop */}
                    <div className="relative z-10 bg-white group-hover:bg-indigo-500 group-active:bg-indigo-600 shadow-xl rounded-lg border-2 border-gray-300 group-hover:border-indigo-400 group-active:border-indigo-600 transition-all duration-150 sm:opacity-0 sm:group-hover:opacity-100 opacity-100 group-active:scale-110">
                      <div className="p-2 sm:p-1.5">
                        <GripVertical 
                          size={20} 
                          className="text-gray-600 group-hover:text-white group-active:text-white transition-colors" 
                        />
                      </div>
                    </div>
                    
                   
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
      
      {/* Legend showing frozen status */}
      {frozenSplits.length > 0 && (
        <div className="mt-2 text-xs text-gray-600 flex items-center gap-1">
          <Lock size={12} className="text-gray-500" />
          <span>{frozenSplits.length} split(s) locked</span>
        </div>
      )}
    </div>
  );
}