import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { Event, Expense } from '../types/types';

interface EventManagementProps {
  events: Event[];
  expenses: Expense[];
  onAddEvent: (name: string) => void;
  onDeleteEvent: (eventId: string) => void;
  onReorderEvents: (dragIndex: number, hoverIndex: number) => void;
}

export function EventManagement({ 
  events, 
  expenses, 
  onAddEvent, 
  onDeleteEvent, 
  onReorderEvents
}: EventManagementProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [newEventName, setNewEventName] = useState('');

  const handleAdd = () => {
    if (newEventName.trim()) {
      onAddEvent(newEventName.trim());
      setNewEventName('');
      setShowAdd(false);
    }
  };

  return (
    <div className="mb-6 bg-purple-50 p-4 rounded-lg border border-purple-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
          📅 Events
          <span className="text-xs text-gray-500 font-normal">(Drag ⋮⋮ to reorder)</span>
        </h3>
        <button
          onClick={() => setShowAdd(true)}
          className="bg-purple-600 text-white px-3 py-2 rounded-lg hover:bg-purple-700 transition text-sm flex items-center gap-1"
        >
          <Plus size={16} />
          Add Event
        </button>
      </div>

      {showAdd && (
        <div className="mb-4 bg-white p-3 rounded-lg">
          <input
            type="text"
            value={newEventName}
            onChange={(e) => setNewEventName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="Event name (e.g., Day 1, Breakfast)"
            className="w-full px-3 py-2 border border-purple-300 rounded-lg mb-2"
          />
          <div className="flex gap-2">
            <button onClick={handleAdd} className="bg-purple-600 text-white px-4 py-1 rounded-lg hover:bg-purple-700 transition text-sm">
              Add
            </button>
            <button onClick={() => setShowAdd(false)} className="bg-gray-300 text-gray-700 px-4 py-1 rounded-lg hover:bg-gray-400 transition text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {events.map((event, index) => (
          <div
            key={event.id}
            draggable={event.id !== 'general'}
            onDragStart={(e) => {
              if (event.id !== 'general') {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', index.toString());
              }
            }}
            onDragOver={(e) => {
              if (event.id !== 'general') {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              const dragIndex = parseInt(e.dataTransfer.getData('text/plain'));
              if (dragIndex !== index && event.id !== 'general') {
                onReorderEvents(dragIndex, index);
              }
            }}
            className={`flex items-center justify-between p-3 rounded-lg border transition ${
              event.id === 'general' 
                ? 'bg-blue-50 border-blue-300' 
                : 'bg-white border-gray-300 cursor-move hover:border-purple-400 hover:shadow-sm'
            }`}
          >
            <div className="flex items-center gap-3">
              {event.id !== 'general' && (
                <span className="text-gray-400 text-lg select-none">⋮⋮</span>
              )}
              <span className="font-medium text-gray-800">{event.name}</span>
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                {expenses.filter(exp => (exp.eventId || 'general') === event.id).length} expenses
              </span>
            </div>
            {event.id !== 'general' && (
              <button
                onClick={() => onDeleteEvent(event.id)}
                className="text-red-500 hover:text-red-700 p-1"
                title="Delete event"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}