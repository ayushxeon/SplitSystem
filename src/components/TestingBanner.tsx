import React, { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

export function TestingBanner() {
  const [open, setOpen] = useState(false);

  const upcomingFeatures = [
    'Bug:Copy Diary link',
    'Issue: Split bar slider improvement for phone users',
    'Export / share settlements CSV',
    'Dark mode and muliple other themes',
    'Enhanced security & production release',
    'Notifications for expense changes in phone',
    'Approval/Dissaproval System for expenses',
    'Mobile app version',
    'Notifications for settlements',
    'Multi-currency support',
    'Logo',
    'Easy find friends to share diaries with',
    'chat system within diaries',
    'photo attachments for expenses'
  ];

  const renderTag = (tag?: string) => {
    if (!tag) return null;
    const t = tag.toLowerCase();
    const base = 'text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full';
    if (t === 'bug') return <span className={`${base} bg-red-100 text-red-800`}>Bug</span>;
    if (t === 'issue') return <span className={`${base} bg-yellow-100 text-yellow-800`}>Issue</span>;
    return <span className={`${base} bg-indigo-100 text-indigo-800`}>{tag}</span>;
  };

  return (
    <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-3 shadow-lg">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start gap-3">
        <AlertTriangle className="flex-shrink-0 mt-0.5" size={20} />
        <div className="flex-1">
          <p className="font-semibold text-sm sm:text-base">
            Beta Testing Version - For Exploration Only
          </p>
          <p className="text-xs sm:text-sm mt-1 opacity-95">
            This is a preview release for testing and exploring features. Please do not add real financial data yet. 
            The production-ready version with enhanced security and features will launch in a few weeks. 
          </p>

          {/* Upcoming features toggle */}
          <div className="mt-3">
            <button
              aria-expanded={open}
              onClick={() => setOpen((s) => !s)}
              className="inline-flex items-center gap-3 bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-md text-sm font-medium focus:outline-none ring-1 ring-white/20"
            >
              <span>Upcoming features</span>
              <span className="inline-block bg-white/90 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                {upcomingFeatures.length}
              </span>
              {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            <div
              className={`mt-2 overflow-hidden transition-[max-height,opacity] duration-200 ${
                open ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
              }`}
              aria-hidden={!open}
            >
              {/* brighter panel with shadow to improve visibility */}
              <div className="mt-2 bg-white rounded-md shadow-lg text-gray-900 p-2">
                <ul className="space-y-2 max-h-72 overflow-y-auto pr-2">
                  {upcomingFeatures.map((f, i) => {
                    const [maybeTag, ...rest] = f.split(':');
                    const hasTag = rest.length > 0;
                    const text = hasTag ? rest.join(':').trim() : f;
                    const tag = hasTag ? maybeTag.trim() : undefined;
                    return (
                      <li
                        key={i}
                        className="flex items-center justify-between gap-3 bg-white/5 hover:bg-white/10 rounded-md p-2 transition"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-0.5">{renderTag(tag)}</div>
                          <div className="text-sm leading-tight">{text}</div>
                        </div>
                        <div className="text-xs text-gray-500">Planned</div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}