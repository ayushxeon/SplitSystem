import React, { useState, useEffect } from 'react';
import { Trash2, Edit2, Plus, Users, DollarSign, TrendingUp, Download, Upload, Save, Lock, Unlock, CheckCircle } from 'lucide-react';

// Storage helper
const STORAGE_KEY = 'expenseSplitterData';

const saveToStorage = (data) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

const loadFromStorage = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error('Error loading data:', e);
    return null;
  }
};

// People Management Component
function PeopleManager({ people, setPeople }) {
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');

  const addPerson = () => {
    if (newPersonName.trim()) {
      // Check for duplicate names
      const existingPerson = Object.values(people).find(
        p => p.name.toLowerCase() === newPersonName.trim().toLowerCase()
      );
      
      if (existingPerson) {
        alert('A person with this name already exists!');
        return;
      }
      
      const id = Date.now();
      setPeople({
        ...people,
        [id]: { id, name: newPersonName.trim() }
      });
      setNewPersonName('');
      setShowAddPerson(false);
    }
  };

  const removePerson = (id) => {
    if (confirm('Remove this person? Their expenses will also be deleted.')) {
      const newPeople = { ...people };
      delete newPeople[id];
      setPeople(newPeople);
    }
  };

  const peopleArray = Object.values(people);

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-700 flex items-center gap-2">
          <Users className="text-indigo-600" size={20} />
          People in this Diary
        </h2>
        <button
          onClick={() => setShowAddPerson(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition flex items-center gap-2"
        >
          <Plus size={18} />
          Add Person
        </button>
      </div>

      {showAddPerson && (
        <div className="bg-indigo-50 p-4 rounded-lg mb-4">
          <input
            type="text"
            value={newPersonName}
            onChange={(e) => setNewPersonName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addPerson()}
            placeholder="Enter name"
            className="w-full px-4 py-2 border border-indigo-200 rounded-lg mb-2"
          />
          <div className="flex gap-2">
            <button onClick={addPerson} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition">
              Add
            </button>
            <button onClick={() => setShowAddPerson(false)} className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {peopleArray.map(person => (
          <div key={person.id} className="bg-gray-50 p-3 rounded-lg flex items-center justify-between">
            <span className="font-medium text-gray-700">{person.name}</span>
            <button onClick={() => removePerson(person.id)} className="text-red-500 hover:text-red-700">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      {peopleArray.length === 0 && (
        <p className="text-gray-500 text-center py-4">Add people to start splitting expenses</p>
      )}
    </div>
  );
}

// Split Bar Component
function SplitBar({ participants, splits, frozenSplits, people, onDividerDrag }) {
  let cumulative = 0;
  
  return (
    <div id="split-bar-container" className="relative h-20 bg-gray-200 rounded-lg overflow-hidden mb-4 shadow-inner select-none">
      {participants.map((personId, index) => {
        // Ensure personId is treated as number for lookup
        const numericId = typeof personId === 'string' ? parseInt(personId) : personId;
        const person = people[numericId];
        const percentage = parseInt(splits[personId] || 0);
        const isFrozen = frozenSplits.includes(personId);
        const startPos = cumulative;
        cumulative += percentage;
        
        if (!person) {
          console.warn('Person not found for ID:', personId, 'Available people:', Object.keys(people));
        }
        
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

// Expense Form Component
function ExpenseForm({ 
  expenseForm, 
  setExpenseForm, 
  people,
  events,
  editingExpense,
  onSubmit,
  onCancel
}) {
  const peopleArray = Object.values(people);

  const toggleParticipant = (personId) => {
    const currentParticipants = expenseForm.participants;
    let newParticipants;
    
    // Ensure we're working with numeric IDs
    const numericId = typeof personId === 'string' ? parseInt(personId) : personId;
    
    if (currentParticipants.includes(numericId)) {
      newParticipants = currentParticipants.filter(id => id !== numericId);
    } else {
      newParticipants = [...currentParticipants, numericId];
    }

    const splits = {};
    if (newParticipants.length > 0) {
      const equalSplit = Math.floor(100 / newParticipants.length);
      const remainder = 100 - (equalSplit * newParticipants.length);
      newParticipants.forEach((id, idx) => {
        splits[id] = idx === 0 ? equalSplit + remainder : equalSplit;
      });
    }

    setExpenseForm({
      ...expenseForm,
      participants: newParticipants,
      splits,
      frozenSplits: []
    });
  };

  const handleDividerDrag = (dividerIndex, event) => {
    event.preventDefault();
    const container = document.getElementById('split-bar-container');
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const frozenSplits = expenseForm.frozenSplits || [];
    const participants = expenseForm.participants;
    
    const leftParticipants = participants.slice(0, dividerIndex + 1);
    const rightParticipants = participants.slice(dividerIndex + 1);
    
    const leftUnfrozen = leftParticipants.filter(id => !frozenSplits.includes(id));
    const rightUnfrozen = rightParticipants.filter(id => !frozenSplits.includes(id));
    
    const totalFrozen = participants
      .filter(id => frozenSplits.includes(id))
      .reduce((sum, id) => sum + parseInt(expenseForm.splits[id] || 0), 0);
    
    const availablePercentage = 100 - totalFrozen;
    
    const updateDivider = (e) => {
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const mousePercentage = Math.round((x / rect.width) * 100);
      
      const leftFrozen = leftParticipants
        .filter(id => frozenSplits.includes(id))
        .reduce((sum, id) => sum + parseInt(expenseForm.splits[id] || 0), 0);
      
      const rightFrozen = rightParticipants
        .filter(id => frozenSplits.includes(id))
        .reduce((sum, id) => sum + parseInt(expenseForm.splits[id] || 0), 0);
      
      let leftAvailable = Math.max(0, mousePercentage - leftFrozen);
      let rightAvailable = Math.max(0, 100 - mousePercentage - rightFrozen);
      
      const totalAvailable = leftAvailable + rightAvailable;
      if (totalAvailable > availablePercentage) {
        return;
      }
      
      const newSplits = { ...expenseForm.splits };
      
      if (leftUnfrozen.length > 0) {
        const perPerson = Math.floor(leftAvailable / leftUnfrozen.length);
        const remainder = leftAvailable - (perPerson * leftUnfrozen.length);
        leftUnfrozen.forEach((id, idx) => {
          newSplits[id] = idx === 0 ? perPerson + remainder : perPerson;
        });
      }
      
      if (rightUnfrozen.length > 0) {
        const perPerson = Math.floor(rightAvailable / rightUnfrozen.length);
        const remainder = rightAvailable - (perPerson * rightUnfrozen.length);
        rightUnfrozen.forEach((id, idx) => {
          newSplits[id] = idx === 0 ? perPerson + remainder : perPerson;
        });
      }
      
      const total = participants.reduce((sum, id) => sum + parseInt(newSplits[id] || 0), 0);
      if (total === 100) {
        setExpenseForm({ ...expenseForm, splits: newSplits });
      }
    };

    const stopDrag = () => {
      document.removeEventListener('mousemove', updateDivider);
      document.removeEventListener('mouseup', stopDrag);
    };

    document.addEventListener('mousemove', updateDivider);
    document.addEventListener('mouseup', stopDrag);
  };

  const toggleFreeze = (personId) => {
    const frozen = expenseForm.frozenSplits || [];
    const newFrozen = frozen.includes(personId)
      ? frozen.filter(id => id !== personId)
      : [...frozen, personId];
    
    setExpenseForm({ ...expenseForm, frozenSplits: newFrozen });
  };

  const handleSplitChange = (personId, value) => {
    const newValue = parseInt(value) || 0;
    const frozenSplits = expenseForm.frozenSplits || [];
    
    if (frozenSplits.includes(personId)) {
      return;
    }
    
    const newSplits = { ...expenseForm.splits };
    newSplits[personId] = newValue;
    
    const frozenTotal = expenseForm.participants
      .filter(id => frozenSplits.includes(id) || id === personId)
      .reduce((sum, id) => sum + parseInt(newSplits[id] || 0), 0);
    
    const remaining = 100 - frozenTotal;
    const unfrozenOthers = expenseForm.participants.filter(
      id => !frozenSplits.includes(id) && id !== personId
    );
    
    if (unfrozenOthers.length > 0 && remaining >= 0) {
      const perPerson = Math.floor(remaining / unfrozenOthers.length);
      const remainder = remaining - (perPerson * unfrozenOthers.length);
      unfrozenOthers.forEach((id, idx) => {
        newSplits[id] = idx === 0 ? perPerson + remainder : perPerson;
      });
    }
    
    setExpenseForm({ ...expenseForm, splits: newSplits });
  };

  const getTotalSplitPercentage = () => {
    return expenseForm.participants.reduce((sum, id) => 
      sum + parseInt(expenseForm.splits[id] || 0), 0);
  };

  return (
    <div className="bg-green-50 p-4 rounded-lg mb-4">
      <input
        type="text"
        value={expenseForm.description}
        onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
        placeholder="Description (e.g., Dinner, Groceries)"
        className="w-full px-4 py-2 border border-green-200 rounded-lg mb-3"
      />
      
      <input
        type="number"
        value={expenseForm.amount}
        onChange={(e) => {
          const value = e.target.value;
          if (value === '' || (parseFloat(value) >= 0)) {
            setExpenseForm({ ...expenseForm, amount: value });
          }
        }}
        onKeyDown={(e) => {
          if (e.key === '-' || e.key === 'e' || e.key === 'E') {
            e.preventDefault();
          }
        }}
        placeholder="Amount (₹)"
        step="0.01"
        min="0"
        className="w-full px-4 py-2 border border-green-200 rounded-lg mb-3"
      />

      <select
        value={expenseForm.paidBy}
        onChange={(e) => setExpenseForm({ ...expenseForm, paidBy: e.target.value })}
        className="w-full px-4 py-2 border border-green-200 rounded-lg mb-3"
      >
        <option value="">Who paid?</option>
        {peopleArray.map(p => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>

      <select
        value={expenseForm.eventId}
        onChange={(e) => setExpenseForm({ ...expenseForm, eventId: e.target.value })}
        className="w-full px-4 py-2 border border-green-200 rounded-lg mb-3 font-medium"
      >
        <option value="">Select Event</option>
        {events.map(event => (
          <option key={event.id} value={event.id}>{event.name}</option>
        ))}
      </select>

      <div className="mb-3">
        <label className="block text-sm font-medium text-gray-700 mb-2">Who's participating?</label>
        <div className="flex flex-wrap gap-2">
          {peopleArray.map(person => (
            <button
              key={person.id}
              onClick={() => toggleParticipant(person.id)}
              className={`px-3 py-1 rounded-full text-sm transition ${
                expenseForm.participants.includes(person.id)
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
        <label className="block text-sm font-medium text-gray-700 mb-2">Split Mode</label>
        <div className="flex gap-2">
          <button
            onClick={() => {
              const equalSplit = Math.floor(100 / expenseForm.participants.length);
              const remainder = 100 - (equalSplit * expenseForm.participants.length);
              const splits = {};
              expenseForm.participants.forEach((id, idx) => {
                splits[id] = idx === 0 ? equalSplit + remainder : equalSplit;
              });
              setExpenseForm({ ...expenseForm, splitMode: 'equal', splits, frozenSplits: [] });
            }}
            className={`px-4 py-2 rounded-lg transition ${expenseForm.splitMode === 'equal' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            Equal Split
          </button>
          <button
            onClick={() => setExpenseForm({ ...expenseForm, splitMode: 'custom' })}
            className={`px-4 py-2 rounded-lg transition ${expenseForm.splitMode === 'custom' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            Custom %
          </button>
        </div>
      </div>

      {expenseForm.splitMode === 'custom' && expenseForm.participants.length > 0 && (
        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Drag dividers to adjust • Lock values to keep them fixed • Total must be 100%
          </label>
          
          <SplitBar 
            participants={expenseForm.participants}
            splits={expenseForm.splits}
            frozenSplits={expenseForm.frozenSplits || []}
            people={people}
            onDividerDrag={handleDividerDrag}
          />

          <div className="space-y-2">
            {expenseForm.participants.map((personId, index) => {
              const person = people[personId];
              const percentage = parseInt(expenseForm.splits[personId] || 0);
              const isFrozen = (expenseForm.frozenSplits || []).includes(personId);
              
              return (
                <div key={personId} className="flex items-center gap-2">
                  <div 
                    className="w-4 h-4 rounded flex-shrink-0"
                    style={{ backgroundColor: `hsl(${(index * 360) / expenseForm.participants.length}, 70%, 55%)` }}
                  />
                  <span className="w-28 text-sm font-medium text-gray-700">{person?.name || 'Unknown'}</span>
                  <input
                    type="number"
                    value={expenseForm.splits[personId] || ''}
                    onChange={(e) => handleSplitChange(personId, e.target.value)}
                    disabled={isFrozen}
                    step="1"
                    min="0"
                    max="100"
                    className={`w-20 px-2 py-1 border rounded text-sm text-right ${isFrozen ? 'bg-gray-100 cursor-not-allowed' : 'border-gray-300'}`}
                  />
                  <span className="text-sm text-gray-600">%</span>
                  <button
                    onClick={() => toggleFreeze(personId)}
                    className={`p-1 rounded transition ${isFrozen ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-400 hover:text-gray-600'}`}
                    title={isFrozen ? 'Unlock to allow changes' : 'Lock to prevent changes'}
                  >
                    {isFrozen ? <Lock size={16} /> : <Unlock size={16} />}
                  </button>
                </div>
              );
            })}
          </div>
          
          <div className="text-sm font-medium text-right mt-3 p-2 rounded" style={{
            backgroundColor: getTotalSplitPercentage() === 100 ? '#dcfce7' : '#fee2e2',
            color: getTotalSplitPercentage() === 100 ? '#166534' : '#991b1b'
          }}>
            {getTotalSplitPercentage() === 100 ? '✓ Ready to add' : `Total: ${getTotalSplitPercentage()}% (must be 100%)`}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={onSubmit} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition">
          {editingExpense ? 'Update' : 'Add'} Expense
        </button>
        <button onClick={onCancel} className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition">
          Cancel
        </button>
      </div>
    </div>
  );
}

// Settlements Component
function Settlements({ settlements, people, onSettle, settledTransactions = [] }) {
  const getPersonName = (id) => {
    return people[id]?.name || 'Unknown';
  };

  if (settlements.length === 0 && settledTransactions.length === 0) {
    return <p className="text-green-600 font-medium text-center py-4">✓ All settled up!</p>;
  }

  return (
    <div>
      {settlements.length > 0 && (
        <div className="space-y-3 mb-6">
          <h3 className="text-sm font-semibold text-gray-600 uppercase">Pending</h3>
          {settlements.map((settlement, idx) => (
            <div key={idx} className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-lg border-l-4 border-purple-500">
              <div className="flex items-center justify-between">
                <p className="text-gray-800">
                  <span className="font-semibold">{getPersonName(settlement.from)}</span> owes{' '}
                  <span className="font-semibold">{getPersonName(settlement.to)}</span>{' '}
                  <span className="font-bold text-purple-600">₹{settlement.amount.toFixed(2)}</span>
                </p>
                <button
                  onClick={() => onSettle(settlement)}
                  className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-lg text-sm flex items-center gap-1 transition"
                  title="Mark as settled"
                >
                  <CheckCircle size={16} />
                  Settle
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {settledTransactions.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-600 uppercase">Settled Transactions</h3>
          {settledTransactions.map((transaction) => (
            <div key={transaction.id} className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border-l-4 border-green-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-800">
                    <span className="font-semibold">{getPersonName(transaction.from)}</span> paid{' '}
                    <span className="font-semibold">{getPersonName(transaction.to)}</span>{' '}
                    <span className="font-bold text-green-600">₹{transaction.amount.toFixed(2)}</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(transaction.date).toLocaleString()}
                  </p>
                </div>
                <CheckCircle size={20} className="text-green-600" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Main Component
export default function ExpenseSplitter() {
  const [diaries, setDiaries] = useState({});
  const [currentDiaryId, setCurrentDiaryId] = useState(null);
  const [showAddDiary, setShowAddDiary] = useState(false);
  const [newDiaryName, setNewDiaryName] = useState('');
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  
  const [expenseForm, setExpenseForm] = useState({
    description: '',
    amount: '',
    paidBy: '',
    eventId: 'general',
    splitMode: 'equal',
    splits: {},
    participants: [],
    frozenSplits: []
  });

  // Get current diary data
  const getCurrentDiary = () => {
    if (!currentDiaryId || !diaries[currentDiaryId]) return null;
    return diaries[currentDiaryId];
  };

  const people = getCurrentDiary()?.people || {};
  const expenses = getCurrentDiary()?.expenses || [];
  const settlements = getCurrentDiary()?.settlements || [];
  const events = getCurrentDiary()?.events || [{ id: 'general', name: 'General Expenses', order: 0 }];

  // Load data on mount
  useEffect(() => {
    const savedData = loadFromStorage();
    if (savedData) {
      if (savedData.diaries) {
        // Ensure all diaries have events array with General Expenses
        const updatedDiaries = {};
        Object.entries(savedData.diaries).forEach(([id, diary]) => {
          updatedDiaries[id] = {
            ...diary,
            events: diary.events || [{ id: 'general', name: 'General Expenses', order: 0 }]
          };
        });
        setDiaries(updatedDiaries);
        const diaryIds = Object.keys(updatedDiaries);
        if (diaryIds.length > 0 && !savedData.currentDiaryId) {
          setCurrentDiaryId(parseInt(diaryIds[0]));
        } else if (savedData.currentDiaryId) {
          setCurrentDiaryId(savedData.currentDiaryId);
        }
      }
    }
    setDataLoaded(true);
  }, []);

  // Save data whenever it changes - but only after initial load
  useEffect(() => {
    if (dataLoaded) {
      saveToStorage({ diaries, currentDiaryId });
    }
  }, [diaries, currentDiaryId, dataLoaded]);

  const addDiary = () => {
    if (newDiaryName.trim()) {
      // Check for duplicate diary names
      const existingDiary = Object.values(diaries).find(
        d => d.name.toLowerCase() === newDiaryName.trim().toLowerCase()
      );
      
      if (existingDiary) {
        alert('A diary with this name already exists!');
        return;
      }
      
      const id = Date.now();
      const newDiary = {
        id,
        name: newDiaryName.trim(),
        people: {},
        expenses: [],
        settlements: [],
        events: [{ id: 'general', name: 'General Expenses', order: 0 }],
        createdAt: new Date().toISOString()
      };
      setDiaries({ ...diaries, [id]: newDiary });
      setCurrentDiaryId(id);
      setNewDiaryName('');
      setShowAddDiary(false);
    }
  };

  const deleteDiary = (id) => {
    if (confirm('Delete this expense diary? All data in it will be deleted.')) {
      const newDiaries = { ...diaries };
      delete newDiaries[id];
      setDiaries(newDiaries);
      
      const remainingIds = Object.keys(newDiaries);
      if (remainingIds.length > 0) {
        setCurrentDiaryId(parseInt(remainingIds[0]));
      } else {
        setCurrentDiaryId(null);
      }
    }
  };

  const updateDiaryPeople = (newPeople) => {
    if (!currentDiaryId) return;
    setDiaries({
      ...diaries,
      [currentDiaryId]: {
        ...diaries[currentDiaryId],
        people: newPeople
      }
    });
  };

  const updateDiaryExpenses = (newExpenses) => {
    if (!currentDiaryId) return;
    setDiaries({
      ...diaries,
      [currentDiaryId]: {
        ...diaries[currentDiaryId],
        expenses: newExpenses
      }
    });
  };

  const updateDiaryEvents = (newEvents) => {
    if (!currentDiaryId) return;
    setDiaries({
      ...diaries,
      [currentDiaryId]: {
        ...diaries[currentDiaryId],
        events: newEvents
      }
    });
  };

  const addEvent = (eventName) => {
    if (!eventName.trim()) return;
    
    // Check for duplicate event names
    const existingEvent = events.find(
      e => e.name.toLowerCase() === eventName.trim().toLowerCase()
    );
    
    if (existingEvent) {
      alert('An event with this name already exists!');
      return;
    }
    
    const newEvent = {
      id: Date.now().toString(),
      name: eventName.trim(),
      order: events.length
    };
    updateDiaryEvents([...events, newEvent]);
  };

  const deleteEvent = (eventId) => {
    if (eventId === 'general') {
      alert('Cannot delete General Expenses');
      return;
    }
    if (confirm('Delete this event? Expenses in this event will be moved to General Expenses.')) {
      // Move expenses to general
      const updatedExpenses = expenses.map(exp => 
        exp.eventId === eventId ? { ...exp, eventId: 'general' } : exp
      );
      updateDiaryExpenses(updatedExpenses);
      updateDiaryEvents(events.filter(e => e.id !== eventId));
    }
  };

  const reorderEvents = (dragIndex, hoverIndex) => {
    const dragEvent = events[dragIndex];
    const newEvents = [...events];
    newEvents.splice(dragIndex, 1);
    newEvents.splice(hoverIndex, 0, dragEvent);
    
    // Update order property
    const reorderedEvents = newEvents.map((event, index) => ({
      ...event,
      order: index
    }));
    
    updateDiaryEvents(reorderedEvents);
  };

  const updateDiarySettlements = (newSettlements) => {
    if (!currentDiaryId) return;
    setDiaries({
      ...diaries,
      [currentDiaryId]: {
        ...diaries[currentDiaryId],
        settlements: newSettlements
      }
    });
  };

  const initializeExpenseForm = () => {
    const participantIds = Object.keys(people).map(id => parseInt(id));
    
    if (participantIds.length === 0) {
      alert('Please add people first!');
      return;
    }
    
    const equalSplit = Math.floor(100 / participantIds.length);
    const remainder = 100 - (equalSplit * participantIds.length);
    const splits = {};
    participantIds.forEach((id, idx) => {
      splits[id] = idx === 0 ? equalSplit + remainder : equalSplit;
    });
    
    setExpenseForm({
      description: '',
      amount: '',
      paidBy: participantIds[0].toString(),
      eventId: 'general',
      splitMode: 'equal',
      splits,
      participants: participantIds,
      frozenSplits: []
    });
    setShowAddExpense(true);
  };

  const addOrUpdateExpense = () => {
    if (!expenseForm.description || !expenseForm.amount || !expenseForm.paidBy) {
      alert('Please fill in all required fields');
      return;
    }

    if (expenseForm.participants.length === 0) {
      alert('Please select at least one participant');
      return;
    }

    if (expenseForm.splitMode === 'custom') {
      const total = expenseForm.participants.reduce((sum, id) => 
        sum + parseInt(expenseForm.splits[id] || 0), 0);
      
      if (total !== 100) {
        alert(`Split percentages must add up to 100%. Current total: ${total}%`);
        return;
      }
    }

    const expense = {
      id: editingExpense?.id || Date.now(),
      description: expenseForm.description,
      amount: parseFloat(expenseForm.amount),
      paidBy: parseInt(expenseForm.paidBy),
      eventId: expenseForm.eventId || 'general',
      splitMode: expenseForm.splitMode,
      splits: { ...expenseForm.splits },
      participants: [...expenseForm.participants],
      frozenSplits: [...(expenseForm.frozenSplits || [])],
      date: editingExpense?.date || new Date().toISOString()
    };

    if (editingExpense) {
      const updatedExpenses = expenses.map(e => e.id === expense.id ? expense : e);
      updateDiaryExpenses(updatedExpenses);
      setEditingExpense(null);
    } else {
      updateDiaryExpenses([...expenses, expense]);
    }

    setShowAddExpense(false);
    setExpenseForm({
      description: '',
      amount: '',
      paidBy: '',
      eventId: 'general',
      splitMode: 'equal',
      splits: {},
      participants: [],
      frozenSplits: []
    });
  };

  const editExpense = (expense) => {
    setExpenseForm({
      description: expense.description,
      amount: expense.amount.toString(),
      paidBy: expense.paidBy.toString(),
      eventId: expense.eventId || 'general',
      splitMode: expense.splitMode,
      splits: { ...expense.splits },
      participants: expense.participants || Object.keys(expense.splits).map(id => parseInt(id)),
      frozenSplits: expense.frozenSplits || []
    });
    setEditingExpense(expense);
    setShowAddExpense(true);
  };

  const deleteExpense = (id) => {
    if (confirm('Delete this expense?')) {
      updateDiaryExpenses(expenses.filter(e => e.id !== id));
    }
  };

  const calculateBalances = () => {
    const balances = {};
    Object.keys(people).forEach(id => {
      balances[parseInt(id)] = 0;
    });

    expenses.forEach(expense => {
      balances[expense.paidBy] = (balances[expense.paidBy] || 0) + expense.amount;
      
      expense.participants.forEach(personId => {
        const share = (expense.amount * parseInt(expense.splits[personId] || 0)) / 100;
        balances[personId] = (balances[personId] || 0) - share;
      });
    });

    settlements.forEach(settlement => {
      balances[settlement.from] = (balances[settlement.from] || 0) + settlement.amount;
      balances[settlement.to] = (balances[settlement.to] || 0) - settlement.amount;
    });

    return balances;
  };

  const simplifyDebts = () => {
    const balances = calculateBalances();
    const creditors = [];
    const debtors = [];

    Object.entries(balances).forEach(([personId, balance]) => {
      if (balance > 0.01) {
        creditors.push({ id: parseInt(personId), amount: balance });
      } else if (balance < -0.01) {
        debtors.push({ id: parseInt(personId), amount: -balance });
      }
    });

    creditors.sort((a, b) => b.amount - a.amount);
    debtors.sort((a, b) => b.amount - a.amount);

    const result = [];
    let i = 0, j = 0;

    while (i < creditors.length && j < debtors.length) {
      const creditor = creditors[i];
      const debtor = debtors[j];
      const amount = Math.min(creditor.amount, debtor.amount);

      if (amount > 0.01) {
        result.push({
          from: debtor.id,
          to: creditor.id,
          amount: amount
        });
      }

      creditor.amount -= amount;
      debtor.amount -= amount;

      if (creditor.amount < 0.01) i++;
      if (debtor.amount < 0.01) j++;
    }

    return result;
  };

  const handleSettle = (settlement) => {
    const newSettlement = {
      id: Date.now(),
      from: settlement.from,
      to: settlement.to,
      amount: settlement.amount,
      date: new Date().toISOString()
    };
    updateDiarySettlements([...settlements, newSettlement]);
  };

  const getPersonName = (id) => {
    return people[id]?.name || 'Unknown';
  };

  const downloadDiaryAsJSON = () => {
    if (!currentDiaryId) return;
    const diary = diaries[currentDiaryId];
    const data = { diary, exportDate: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${diary.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadDiaryAsCSV = () => {
    if (!currentDiaryId) return;
    const peopleArray = Object.values(people);
    let csv = 'Date,Description,Amount,Paid By,';
    csv += peopleArray.map(p => p.name).join(',') + '\n';

    expenses.forEach(expense => {
      const date = new Date(expense.date).toLocaleDateString();
      const row = [
        date,
        expense.description,
        expense.amount.toFixed(2),
        getPersonName(expense.paidBy)
      ];
      
      peopleArray.forEach(person => {
        if (expense.participants.includes(person.id)) {
          const share = (expense.amount * parseInt(expense.splits[person.id] || 0)) / 100;
          row.push(share.toFixed(2));
        } else {
          row.push('0.00');
        }
      });
      
      csv += row.join(',') + '\n';
    });

    const diary = diaries[currentDiaryId];
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${diary.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const uploadDiaryFiles = (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    let successCount = 0;
    let errorCount = 0;
    const newDiaries = { ...diaries };
    let lastImportedId = null;

    const processFile = (file, index) => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = JSON.parse(e.target.result);
            
            // Handle both old format (with diary wrapper) and new format (direct diary object)
            let diaryData = null;
            
            if (data.diary) {
              // New format: { diary: {...} }
              diaryData = data.diary;
            } else if (data.name && data.people) {
              // Old format or direct diary object
              diaryData = data;
            }
            
            if (diaryData) {
              const newId = Date.now() + index;
              
              // Ensure the diary has all required fields
              newDiaries[newId] = {
                id: newId,
                name: diaryData.name || 'Imported Diary',
                people: diaryData.people || {},
                expenses: diaryData.expenses || [],
                settlements: diaryData.settlements || [],
                events: diaryData.events || [{ id: 'general', name: 'General Expenses', order: 0 }],
                createdAt: diaryData.createdAt || new Date().toISOString(),
                importedAt: new Date().toISOString()
              };
              
              lastImportedId = newId;
              successCount++;
            } else {
              console.error('Invalid diary format:', data);
              errorCount++;
            }
          } catch (error) {
            console.error('Error parsing file:', error);
            errorCount++;
          }
          resolve();
        };
        
        reader.onerror = () => {
          errorCount++;
          resolve();
        };
        
        reader.readAsText(file);
      });
    };

    // Process all files
    const promises = Array.from(files).map((file, index) => processFile(file, index));
    
    Promise.all(promises).then(() => {
      if (successCount > 0) {
        setDiaries(newDiaries);
        if (lastImportedId) {
          setCurrentDiaryId(lastImportedId);
        }
        alert(`✓ Successfully imported ${successCount} diary/diaries!${errorCount > 0 ? `\n✗ ${errorCount} file(s) failed.` : ''}`);
      } else {
        alert('✗ No valid diary files found. Please check the file format.');
      }
    });

    event.target.value = '';
  };

  const currentSettlements = simplifyDebts();
  const peopleArray = Object.values(people);
  const diariesArray = Object.values(diaries);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
              <DollarSign className="text-indigo-600" />
              Expense Splitter
            </h1>
            
            {currentDiaryId && (
              <div className="flex gap-2">
                <button
                  onClick={downloadDiaryAsJSON}
                  className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2 text-sm"
                  title="Download current diary as JSON"
                >
                  <Download size={16} />
                  JSON
                </button>
                <button
                  onClick={downloadDiaryAsCSV}
                  className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 transition flex items-center gap-2 text-sm"
                  title="Download current diary as CSV"
                >
                  <Download size={16} />
                  CSV
                </button>
              </div>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6 text-sm text-blue-800">
            <div className="flex items-start gap-2">
              <Save size={16} className="mt-0.5 flex-shrink-0" />
              <div>
                <strong>Auto-saved!</strong> Your data is automatically saved in your browser and persists on refresh.
              </div>
            </div>
          </div>

          {/* Expense Diaries Section */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-700 flex items-center gap-2">
                📔 Expense Diaries
              </h2>
              <div className="flex gap-2">
                <label className="bg-purple-600 text-white px-3 py-2 rounded-lg hover:bg-purple-700 transition flex items-center gap-2 text-sm cursor-pointer">
                  <Upload size={16} />
                  Import
                  <input
                    type="file"
                    accept=".json"
                    multiple
                    onChange={uploadDiaryFiles}
                    className="hidden"
                  />
                </label>
                <button
                  onClick={() => setShowAddDiary(true)}
                  className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition flex items-center gap-2"
                >
                  <Plus size={18} />
                  New Diary
                </button>
              </div>
            </div>

            {showAddDiary && (
              <div className="bg-orange-50 p-4 rounded-lg mb-4">
                <input
                  type="text"
                  value={newDiaryName}
                  onChange={(e) => setNewDiaryName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addDiary()}
                  placeholder="Diary name (e.g., Trip to Goa, Office Lunch)"
                  className="w-full px-4 py-2 border border-orange-200 rounded-lg mb-2"
                />
                <div className="flex gap-2">
                  <button onClick={addDiary} className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition">
                    Create
                  </button>
                  <button onClick={() => setShowAddDiary(false)} className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {diariesArray.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {diariesArray.map(diary => (
                  <div 
                    key={diary.id} 
                    className={`p-4 rounded-lg border-2 transition cursor-pointer ${
                      currentDiaryId === diary.id 
                        ? 'bg-orange-50 border-orange-500' 
                        : 'bg-gray-50 border-gray-200 hover:border-orange-300'
                    }`}
                    onClick={() => setCurrentDiaryId(diary.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-800">{diary.name}</h3>
                        <p className="text-xs text-gray-500 mt-1">
                          {Object.keys(diary.people || {}).length} people • {diary.expenses?.length || 0} expenses
                        </p>
                        <p className="text-xs text-gray-400">
                          Created {new Date(diary.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteDiary(diary.id);
                        }} 
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">Create a diary to start tracking expenses</p>
            )}
          </div>

          {currentDiaryId && (
            <>
              <PeopleManager people={people} setPeople={updateDiaryPeople} />

              {peopleArray.length > 0 && (
                <div className="mb-8">
                  {/* Events Management */}
                  <div className="mb-6 bg-purple-50 p-4 rounded-lg border border-purple-200">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
                        📅 Events
                        <span className="text-xs text-gray-500 font-normal">(Drag ⋮⋮ to reorder)</span>
                      </h3>
                      <button
                        onClick={() => {
                          const eventName = prompt('Enter event name (e.g., Day 1, Breakfast, Sightseeing):');
                          if (eventName) addEvent(eventName);
                        }}
                        className="bg-purple-600 text-white px-3 py-2 rounded-lg hover:bg-purple-700 transition text-sm flex items-center gap-1"
                      >
                        <Plus size={16} />
                        Add Event
                      </button>
                    </div>
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
                              reorderEvents(dragIndex, index);
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
                              onClick={() => deleteEvent(event.id)}
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

                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-gray-700 flex items-center gap-2">
                      <TrendingUp className="text-indigo-600" size={20} />
                      Expenses in "{getCurrentDiary()?.name}"
                    </h2>
                    <button
                      onClick={initializeExpenseForm}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition flex items-center gap-2"
                    >
                      <Plus size={18} />
                      Add Expense
                    </button>
                  </div>

                  {showAddExpense && (
                    <ExpenseForm
                      expenseForm={expenseForm}
                      setExpenseForm={setExpenseForm}
                      people={people}
                      events={events}
                      editingExpense={editingExpense}
                      onSubmit={addOrUpdateExpense}
                      onCancel={() => {
                        setShowAddExpense(false);
                        setEditingExpense(null);
                      }}
                    />
                  )}

                  {/* Expenses grouped by event */}
                  <div className="space-y-6">
                    {events.map(event => {
                      const eventExpenses = expenses.filter(exp => (exp.eventId || 'general') === event.id);
                      if (eventExpenses.length === 0) return null;
                      
                      return (
                        <div key={event.id} className="border-l-4 border-purple-400 pl-4">
                          <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                            {event.name}
                            <span className="text-xs text-gray-500">({eventExpenses.length} expenses)</span>
                          </h3>
                          <div className="space-y-3">
                            {eventExpenses.map(expense => (
                              <div key={expense.id} className="bg-gray-50 p-4 rounded-lg">
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex-1">
                                    <h3 className="font-semibold text-gray-800">{expense.description}</h3>
                                    <p className="text-sm text-gray-600">
                                      ₹{expense.amount.toFixed(2)} paid by {getPersonName(expense.paidBy)}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">
                                      Split among: {expense.participants.map(id => getPersonName(id)).join(', ')}
                                    </p>
                                  </div>
                                  <div className="flex gap-2">
                                    <button onClick={() => editExpense(expense)} className="text-blue-500 hover:text-blue-700">
                                      <Edit2 size={18} />
                                    </button>
                                    <button onClick={() => deleteExpense(expense.id)} className="text-red-500 hover:text-red-700">
                                      <Trash2 size={18} />
                                    </button>
                                  </div>
                                </div>
                                <div className="text-xs text-gray-500 space-y-1">
                                  {expense.participants.map(personId => (
                                    <div key={personId}>
                                      {getPersonName(personId)}: {expense.splits[personId]}% (₹{((expense.amount * parseInt(expense.splits[personId] || 0)) / 100).toFixed(2)})
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {expenses.length === 0 && (
                    <p className="text-gray-500 text-center py-4">No expenses added yet</p>
                  )}
                </div>
              )}

              {expenses.length > 0 && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-700 mb-4">💰 Who Owes Whom</h2>
                  <Settlements 
                    settlements={currentSettlements} 
                    people={people}
                    onSettle={handleSettle}
                    settledTransactions={settlements}
                  />
                </div>
              )}
            </>
          )}

          {!currentDiaryId && diariesArray.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">Welcome! Create your first expense diary to get started.</p>
              <button
                onClick={() => setShowAddDiary(true)}
                className="bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 transition inline-flex items-center gap-2"
              >
                <Plus size={20} />
                Create First Diary
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}