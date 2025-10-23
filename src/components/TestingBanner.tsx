import React from 'react';
import { AlertTriangle } from 'lucide-react';

export function TestingBanner() {
  return (
    <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-3 shadow-lg">
      <div className="max-w-6xl mx-auto flex items-start gap-3">
        <AlertTriangle className="flex-shrink-0 mt-0.5" size={20} />
        <div className="flex-1">
          <p className="font-semibold text-sm sm:text-base">
            Beta Testing Version - For Exploration Only
          </p>
          <p className="text-xs sm:text-sm mt-1 opacity-95">
            This is a preview release for testing and exploring features. Please do not add real financial data yet. 
            The production-ready version with enhanced security and features will launch in a few weeks. 
          </p>
        </div>
      </div>
    </div>
  );
}