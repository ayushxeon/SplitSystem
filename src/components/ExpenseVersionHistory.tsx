import React from 'react';
import { X, Clock } from 'lucide-react';
import type { Expense, Person } from '../types/types';

interface ExpenseVersionHistoryProps {
  expense: Expense;
  people: Record<string, Person>;
  onClose: () => void;
}

export function ExpenseVersionHistory({ expense, people, onClose }: ExpenseVersionHistoryProps) {
  const versions = expense.versions || [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-800">Expense History</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>
        
        <div className="space-y-3">
          {/* Current Version */}
          <div className="bg-green-50 p-4 rounded-lg border-2 border-green-300">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <Clock size={16} />
                Current Version (v{expense.currentVersion})
              </h3>
              <span className="text-xs bg-green-200 text-green-800 px-2 py-1 rounded font-medium">
                Active
              </span>
            </div>
            <div className="space-y-1 text-sm">
              <p className="text-gray-700">
                <strong>Description:</strong> {expense.description}
              </p>
              <p className="text-gray-700">
                <strong>Amount:</strong> ₹{expense.amount.toFixed(2)}
              </p>
              <p className="text-gray-700">
                <strong>Paid by:</strong> {people[expense.paidBy]?.name || 'Unknown'}
              </p>
              <p className="text-gray-700">
                <strong>Split:</strong> {expense.splitMode === 'equal' ? 'Equal' : 'Custom'}
              </p>
              <p className="text-gray-700">
                <strong>Participants:</strong> {expense.participants.map(p => people[p]?.name || 'Unknown').join(', ')}
              </p>
            </div>
            {expense.lastModifiedBy && (
              <p className="text-xs text-gray-500 mt-3 border-t border-green-200 pt-2">
                Last modified by: {people[expense.lastModifiedBy]?.name || 'Unknown'}
                {expense.lastModifiedAt && ` on ${new Date(expense.lastModifiedAt).toLocaleString()}`}
              </p>
            )}
          </div>

          {/* Previous Versions */}
          {versions.length > 0 ? (
            <>
              <h4 className="text-sm font-semibold text-gray-600 uppercase pt-2">Previous Versions</h4>
              {versions.slice().reverse().map((version, index) => (
                <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-300">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                      <Clock size={16} />
                      Version {version.versionNumber}
                    </h3>
                    <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">
                      Previous
                    </span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <p className="text-gray-600">
                      <strong>Description:</strong> {version.data.description}
                    </p>
                    <p className="text-gray-600">
                      <strong>Amount:</strong> ₹{version.data.amount?.toFixed(2)}
                    </p>
                    <p className="text-gray-600">
                      <strong>Paid by:</strong> {people[version.data.paidBy]?.name || 'Unknown'}
                    </p>
                    <p className="text-gray-600">
                      <strong>Split:</strong> {version.data.splitMode === 'equal' ? 'Equal' : 'Custom'}
                    </p>
                    <p className="text-gray-600">
                      <strong>Participants:</strong> {version.data.participants.map(p => people[p]?.name || 'Unknown').join(', ')}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 mt-3 border-t border-gray-200 pt-2">
                    Modified by: {version.modifiedByName || people[version.modifiedBy]?.name || 'Unknown'} on {new Date(version.timestamp).toLocaleString()}
                  </p>
                </div>
              ))}
            </>
          ) : (
            <div className="text-center py-4 text-gray-500 text-sm">
              No previous versions
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className="w-full mt-4 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
        >
          Close
        </button>
      </div>
    </div>
  );
}