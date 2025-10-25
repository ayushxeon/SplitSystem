import React, { useState, useEffect } from 'react';
import { Lock, Unlock } from 'lucide-react';
import { SplitBar } from './SplitBar';
import type { Person, Event, Expense, User } from '../types/types';

interface ExpenseFormProps {
  people: Record<string, Person>;
  events: Event[];
  currentUser: User;
  editingExpense: Expense | null;
  onSubmit: (expense: Omit<Expense, 'id' | 'date'>) => void;
  onCancel: () => void;
}

export function ExpenseForm({ people, events, currentUser, editingExpense, onSubmit, onCancel }: ExpenseFormProps) {
  const peopleArray = Object.values(people);
  const participantIds = peopleArray.map(p => p.id);

  const normalizePaidBy = (value?: string) => {
    if (!value) return participantIds[0] || '';
    // if it's already a person id
    if (people[value]) return value;
    // treat value as userId and find matching person
    const byUser = peopleArray.find(p => p.userId === value);
    if (byUser) return byUser.id;
    return participantIds[0] || '';
  };

  const [description, setDescription] = useState(editingExpense?.description || '');
  const [amount, setAmount] = useState(editingExpense?.amount.toString() || '');
  const [paidBy, setPaidBy] = useState(() => normalizePaidBy(editingExpense?.paidBy));
  
  // FIX: Ensure eventId is NEVER undefined
  const [eventId, setEventId] = useState(
    editingExpense?.eventId || (events.length > 0 ? events[0].id : 'general')
  );
  
  const [splitMode, setSplitMode] = useState<'equal' | 'custom'>(() => {
  if (editingExpense?.splitMode === 'percentage') return 'custom';
  return editingExpense?.splitMode === 'custom' ? 'custom' : 'equal';
});
  const [participants, setParticipants] = useState<string[]>(
    editingExpense?.participants || participantIds
  );
  const [splits, setSplits] = useState<Record<string, number>>(() => {
    if (editingExpense?.splits) return editingExpense.splits;
    const equalSplit = Math.floor(100 / participantIds.length);
    const remainder = 100 - (equalSplit * participantIds.length);
    const initialSplits: Record<string, number> = {};
    participantIds.forEach((id, idx) => {
      initialSplits[id] = idx === 0 ? equalSplit + remainder : equalSplit;
    });
    return initialSplits;
  });
  const [frozenSplits, setFrozenSplits] = useState<string[]>(editingExpense?.frozenSplits || []);

  const toggleParticipant = (personId: string) => {
    let newParticipants: string[];
    
    if (participants.includes(personId)) {
      newParticipants = participants.filter(id => id !== personId);
    } else {
      newParticipants = [...participants, personId];
    }

    const newSplits: Record<string, number> = {};
    if (newParticipants.length > 0) {
      const equalSplit = Math.floor(100 / newParticipants.length);
      const remainder = 100 - (equalSplit * newParticipants.length);
      newParticipants.forEach((id, idx) => {
        newSplits[id] = idx === 0 ? equalSplit + remainder : equalSplit;
      });
    }

    setParticipants(newParticipants);
    setSplits(newSplits);
    setFrozenSplits([]);
  };

  const handleDividerDrag = (dividerIndex: number, startEvent: React.PointerEvent) => {
  // Prevent if too many splits are frozen
  if (frozenSplits.length >= participants.length - 1) return;
  
  startEvent.preventDefault();
  startEvent.stopPropagation();
  
  const container = document.getElementById('split-bar-container');
  if (!container) return;
  
  const containerRect = container.getBoundingClientRect();
  const startX = startEvent.clientX;
  
  const leftPerson = participants[dividerIndex];
  const rightPerson = participants[dividerIndex + 1];
  
  if (frozenSplits.includes(leftPerson) || frozenSplits.includes(rightPerson)) return;
  
  const initialLeft = parseInt(splits[leftPerson]?.toString() || '0');
  const initialRight = parseInt(splits[rightPerson]?.toString() || '0');
  const total = initialLeft + initialRight;
  
  // Set pointer capture for smooth dragging
  (startEvent.target as HTMLElement).setPointerCapture(startEvent.pointerId);
  
  const handleMove = (e: PointerEvent) => {
    const deltaX = e.clientX - startX;
    const deltaPercent = (deltaX / containerRect.width) * 100;
    
    let newLeft = initialLeft + deltaPercent;
    let newRight = total - newLeft;
    
    // Clamp to min 5%
    newLeft = Math.max(5, Math.min(total - 5, newLeft));
    newRight = total - newLeft;
    
    // Round
    newLeft = Math.round(newLeft);
    newRight = Math.round(newRight);
    
    // Fix rounding errors
    const sum = newLeft + newRight;
    if (sum !== total) {
      if (newLeft > newRight) {
        newLeft += (total - sum);
      } else {
        newRight += (total - sum);
      }
    }
    
    setSplits(prev => ({
      ...prev,
      [leftPerson]: newLeft,
      [rightPerson]: newRight
    }));
  };
  
  const handleEnd = (e: PointerEvent) => {
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    document.removeEventListener('pointermove', handleMove);
    document.removeEventListener('pointerup', handleEnd);
    document.removeEventListener('pointercancel', handleEnd);
  };
  
  document.addEventListener('pointermove', handleMove);
  document.addEventListener('pointerup', handleEnd);
  document.addEventListener('pointercancel', handleEnd);
};

  const handleSplitChange = (personId: string, value: string) => {
    const newValue = parseInt(value) || 0;
    if (frozenSplits.includes(personId)) return;
    
    const newSplits = { ...splits };
    newSplits[personId] = newValue;
    
    const frozenTotal = participants
      .filter(id => frozenSplits.includes(id) || id === personId)
      .reduce((sum, id) => sum + parseInt(newSplits[id]?.toString() || '0'), 0);
    
    const remaining = 100 - frozenTotal;
    const unfrozenOthers = participants.filter(id => !frozenSplits.includes(id) && id !== personId);
    
    if (unfrozenOthers.length > 0 && remaining >= 0) {
      const perPerson = Math.floor(remaining / unfrozenOthers.length);
      const remainder = remaining - (perPerson * unfrozenOthers.length);
      unfrozenOthers.forEach((id, idx) => {
        newSplits[id] = idx === 0 ? perPerson + remainder : perPerson;
      });
    }
    
    setSplits(newSplits);
  };

  const getTotalSplit = () => {
    return participants.reduce((sum, id) => sum + parseInt(splits[id]?.toString() || '0'), 0);
  };

  const handleSubmit = () => {
    const total = getTotalSplit();
    if (total !== 100) {
      alert(`Split percentages must add up to 100%. Current total: ${total}%`);
      return;
    }
    if (!description.trim()) {
      alert('Please enter a description');
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    if (!paidBy) {
      alert('Please select who paid');
      return;
    }
    if (participants.length === 0) {
      alert('Please select at least one participant');
      return;
    }

    const paidById = normalizePaidBy(paidBy);
    const amountNum = parseFloat(amount);
    
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    // FIX: Create clean payload ensuring NO undefined values
    const payload = {
      description: description.trim(),
      amount: amountNum,
      paidBy: paidById,
      eventId: eventId || 'general', // Fallback to 'general' if somehow undefined
      splitMode,
      splits,
      participants,
      frozenSplits: frozenSplits || [], // Ensure it's always an array
      createdBy: currentUser.uid,
      currentVersion: editingExpense?.currentVersion || 1
    };

    console.debug('✅ Submitting clean expense payload:', payload);
    onSubmit(payload as any);
  };

  // Keep paidBy normalized when editingExpense or people change
  useEffect(() => {
    setPaidBy(normalizePaidBy(editingExpense?.paidBy));
  }, [editingExpense?.paidBy, Object.keys(people).join(',')]);

  return (
    <div className="bg-green-50 p-4 rounded-lg mb-4 border border-green-200">
      <h3 className="font-semibold text-gray-800 mb-3">
        {editingExpense ? 'Edit Expense' : 'Add Expense'}
      </h3>

      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description"
        className="w-full px-4 py-2 border border-green-300 rounded-lg mb-3"
      />
      
      <input
        type="number"
        value={amount}
        onChange={(e) => {
          const value = e.target.value;
          if (value === '' || parseFloat(value) >= 0) setAmount(value);
        }}
        onKeyDown={(e) => {
          if (e.key === '-' || e.key === 'e' || e.key === 'E') e.preventDefault();
        }}
        placeholder="Amount (₹)"
        step="0.01"
        min="0"
        className="w-full px-4 py-2 border border-green-300 rounded-lg mb-3"
      />

      <select
        value={paidBy}
        onChange={(e) => setPaidBy(e.target.value)}
        className="w-full px-4 py-2 border border-green-300 rounded-lg mb-3"
      >
        <option value="">Who paid?</option>
        {peopleArray.map(p => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>

      <select
        value={eventId}
        onChange={(e) => setEventId(e.target.value)}
        className="w-full px-4 py-2 border border-green-300 rounded-lg mb-3 font-medium"
      >
        {events.map(event => (
          <option key={event.id} value={event.id}>{event.name}</option>
        ))}
      </select>

      <div className="mb-3">
        <label className="block text-sm font-medium text-gray-700 mb-2">Participants</label>
        <div className="flex flex-wrap gap-2">
          {peopleArray.map(person => (
            <button
              key={person.id}
              onClick={() => toggleParticipant(person.id)}
              className={`px-3 py-1 rounded-full text-sm transition ${
                participants.includes(person.id)
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}
            >
              {person.name}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3">
        <div className="flex gap-2">
          <button
            onClick={() => {
              const equalSplit = Math.floor(100 / participants.length);
              const remainder = 100 - (equalSplit * participants.length);
              const newSplits: Record<string, number> = {};
              participants.forEach((id, idx) => {
                newSplits[id] = idx === 0 ? equalSplit + remainder : equalSplit;
              });
              setSplitMode('equal');
              setSplits(newSplits);
              setFrozenSplits([]);
            }}
            className={`px-4 py-2 rounded-lg transition ${splitMode === 'equal' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            Equal
          </button>
          <button
            onClick={() => setSplitMode('custom')}
            className={`px-4 py-2 rounded-lg transition ${splitMode === 'custom' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            Custom
          </button>
        </div>
      </div>

      {splitMode === 'custom' && participants.length > 0 && (
        <div className="mb-3">
          <SplitBar 
            participants={participants}
            splits={splits}
            frozenSplits={frozenSplits}
            people={people}
            onDividerDrag={handleDividerDrag}
          />

          <div className="space-y-2">
            {participants.map((personId, index) => {
              const person = people[personId];
              const isFrozen = frozenSplits.includes(personId);
              
              return (
                <div key={personId} className="flex items-center gap-2">
                  <div 
                    className="w-4 h-4 rounded flex-shrink-0"
                    style={{ backgroundColor: `hsl(${(index * 360) / participants.length}, 70%, 55%)` }}
                  />
                  <span className="w-28 text-sm font-medium text-gray-700">{person?.name}</span>
                  <input
                    type="number"
                    value={splits[personId] || ''}
                    onChange={(e) => handleSplitChange(personId, e.target.value)}
                    disabled={isFrozen}
                    step="1"
                    min="0"
                    max="100"
                    className={`w-20 px-2 py-1 border rounded text-sm text-right ${isFrozen ? 'bg-gray-100 cursor-not-allowed' : 'border-gray-300'}`}
                  />
                  <span className="text-sm text-gray-600">%</span>
                  <button
                    onClick={() => {
                      if (isFrozen) {
                        setFrozenSplits(frozenSplits.filter(id => id !== personId));
                      } else {
                        setFrozenSplits([...frozenSplits, personId]);
                      }
                    }}
                    className={`p-1 rounded transition ${isFrozen ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-400 hover:text-gray-600'}`}
                  >
                    {isFrozen ? <Lock size={16} /> : <Unlock size={16} />}
                  </button>
                </div>
              );
            })}
          </div>
          
          <div className="text-sm font-medium text-right mt-3 p-2 rounded" style={{
            backgroundColor: getTotalSplit() === 100 ? '#dcfce7' : '#fee2e2',
            color: getTotalSplit() === 100 ? '#166534' : '#991b1b'
          }}>
            {getTotalSplit() === 100 ? '✓ Total: 100%' : `⚠️ Total: ${getTotalSplit()}%`}
          </div>
        </div>
      )}

      <div className="flex gap-2 mt-4">
        <button 
          onClick={handleSubmit}
          className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
        >
          {editingExpense ? 'Update' : 'Add'}
        </button>
        <button 
          onClick={onCancel}
          className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}