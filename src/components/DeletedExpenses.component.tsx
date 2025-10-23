import React from 'react';
import { X, RotateCcw, Edit2, Trash2 } from 'lucide-react';
import type { Expense, Person, Event } from '../types/types';

interface DeletedExpensesProps {
  deletedExpenses: Expense[];
  people: Record<string, Person>;
  events: Event[];
  currentUserId: string;
  onRestore: (expense: Expense) => void;
  onEdit: (expense: Expense) => void;
  onPermanentDelete: (expenseId: string) => void;
  onClose: () => void;
}

export function DeletedExpenses({ 
  deletedExpenses, 
  people, 
  events,
  currentUserId,
  onRestore, 
  onEdit,
  onPermanentDelete,
  onClose 
}: DeletedExpensesProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full my-8 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6 sticky top-0 bg-white pb-4 border-b">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Trash2 className="text-red-600" />
            Deleted Expenses ({deletedExpenses.length})
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        {deletedExpenses.length === 0 ? (
          <p className="text-gray-500 text-center py-12">No deleted expenses</p>
        ) : (
          <div className="space-y-4">
            {deletedExpenses.map(expense => {
              const event = events.find(e => e.id === expense.eventId);
              
              return (
                <div key={expense.id} className="bg-red-50 border-2 border-red-200 p-4 rounded-lg">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-bold text-lg text-gray-800">{expense.description}</h3>
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                          {event?.name || 'Unknown Event'}
                        </span>
                      </div>
                      
                      <p className="text-sm text-gray-700 mb-2">
                        <span className="font-semibold">Amount:</span> ₹{expense.amount.toFixed(2)}
                      </p>
                      
                      <p className="text-sm text-gray-700 mb-2">
                        <span className="font-semibold">Paid by:</span> {people[expense.paidBy]?.name || 'Unknown'}
                        {expense.paidBy === currentUserId && (
                          <span className="ml-1 text-blue-600 font-medium">(You)</span>
                        )}
                      </p>
                      
                      <div className="text-sm text-gray-700 mb-2">
                        <span className="font-semibold">Split among:</span>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {expense.participants.map(p => (
                            <span key={p} className="bg-gray-100 px-2 py-1 rounded text-xs">
                              {people[p]?.name || 'Unknown'} 
                              {p === currentUserId && <span className="text-blue-600"> (You)</span>}
                              : {expense.splits[p]}%
                            </span>
                          ))}
                        </div>
                      </div>
                      
                      <div className="text-xs text-gray-500 mt-2">
                        <p>Created: {new Date(expense.date).toLocaleString()}</p>
                        {expense.lastModifiedAt && (
                          <p className="text-red-600">
                            Deleted by {people[expense.lastModifiedBy!]?.name || 'Unknown'} on{' '}
                            {new Date(expense.lastModifiedAt).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 pt-3 border-t border-red-200">
                    <button
                      onClick={() => onRestore(expense)}
                      className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition flex items-center justify-center gap-2"
                    >
                      <RotateCcw size={16} />
                      Restore
                    </button>
                    <button
                      onClick={() => onEdit(expense)}
                      className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2"
                    >
                      <Edit2 size={16} />
                      Edit & Restore
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Permanently delete this expense? This cannot be undone.')) {
                          onPermanentDelete(expense.id);
                        }
                      }}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                      title="Permanently delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}