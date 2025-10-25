import React, { useState, useMemo } from 'react';
import { X, Mail, UserPlus, Users } from 'lucide-react';
import { firebaseService } from '../services/firebaseService';
import type { Diary, User, Person } from '../types/types';

interface AddPersonModalProps {
  diary: Diary;
  currentUser: User;
  allDiaries: Diary[];  // ✅ ADD THIS - pass all user's diaries
  onClose: () => void;
  onAdded: () => void;
}

export function AddPersonModal({ diary, currentUser, allDiaries, onClose, onAdded }: AddPersonModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [showExisting, setShowExisting] = useState(true);

  // Get all unique people from other diaries
 const existingContacts = useMemo(() => {
  const contactsMap = new Map<string, Person>();

  allDiaries.forEach((d) => {
    if (d.id === diary.id) return;

    Object.values(d.people).forEach((person) => {
      if (person.userId && person.email && person.userId !== currentUser.uid) {
        // ✅ CHECK: Not already in current diary
        const alreadyInDiary = Object.values(diary.people).some(
          (p) => p.email?.toLowerCase() === person.email?.toLowerCase()
        );

        if (!alreadyInDiary) {
          contactsMap.set(person.email.toLowerCase(), person);
        }
      }
    });
  });

  return Array.from(contactsMap.values());
}, [allDiaries, diary, currentUser]);

  const handleAddExisting = async (person: Person) => {
    setAdding(true);
    try {
      const newPerson: Person = {
        id: person.userId!,
        name: person.name,
        email: person.email,
        userId: person.userId,
        status: 'pending',
        invitedBy: currentUser.uid,
        invitedAt: new Date().toISOString(),
      };

      await firebaseService.addPersonToDiary(diary.id, newPerson);
      alert(`✓ Invited ${person.name}!`);
      onAdded();
      onClose();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setAdding(false);
    }
  };

  const handleAddNew = async () => {
  if (!name.trim()) {
    alert('Please enter a name');
    return;
  }

  const normalizedEmail = email.trim().toLowerCase() || null;

  // ✅ CHECK: Am I trying to add myself?
  if (normalizedEmail === currentUser.email.toLowerCase()) {
    alert('❌ You cannot invite yourself!');
    return;
  }

  // ✅ CHECK: Is this email already in the diary?
  if (normalizedEmail) {
    const existingPerson = Object.values(diary.people).find(
      (p) => p.email?.toLowerCase() === normalizedEmail
    );

    if (existingPerson) {
      alert(`❌ ${existingPerson.name} (${normalizedEmail}) is already in this diary!`);
      return;
    }
  }

  setAdding(true);
  try {
    let targetUserId: string | null = null;

    if (normalizedEmail) {
      targetUserId = await firebaseService.checkUserExists(normalizedEmail);
    }

    const personId = targetUserId || `guest_${Date.now()}`;

    const newPerson: Person = {
      id: personId,
      name: name.trim(),
      email: normalizedEmail,
      userId: targetUserId,
      status: targetUserId ? 'pending' : 'unregistered',
      invitedBy: currentUser.uid,
      invitedAt: new Date().toISOString(),
    };

    await firebaseService.addPersonToDiary(diary.id, newPerson);
    alert(`✓ Added ${name}!`);
    onAdded();
    onClose();
  } catch (error: any) {
    alert(error.message);
  } finally {
    setAdding(false);
  }
};

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-800">Add Person</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Tab buttons */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setShowExisting(true)}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition ${
                showExisting
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              <Users size={18} className="inline mr-2" />
              Your Contacts ({existingContacts.length})
            </button>
            <button
              onClick={() => setShowExisting(false)}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition ${
                !showExisting
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              <UserPlus size={18} className="inline mr-2" />
              Add New
            </button>
          </div>

          {showExisting ? (
            /* Existing contacts */
            existingContacts.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm text-gray-600 mb-3">
                  People you've shared expenses with before:
                </p>
                {existingContacts.map((person) => (
                  <div
                    key={person.email}
                    className="bg-gray-50 p-4 rounded-lg flex items-center justify-between hover:bg-gray-100 transition"
                  >
                    <div>
                      <p className="font-medium text-gray-800">{person.name}</p>
                      <p className="text-sm text-gray-500">{person.email}</p>
                    </div>
                    <button
                      onClick={() => handleAddExisting(person)}
                      disabled={adding}
                      className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
                    >
                      {adding ? 'Adding...' : 'Add'}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Users size={48} className="mx-auto mb-3 opacity-30" />
                <p>No existing contacts found</p>
                <p className="text-sm mt-2">Add someone new to get started!</p>
              </div>
            )
          ) : (
            /* Add new person form */
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter name"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  <Mail size={12} className="inline mr-1" />
                  If they have an account, they'll receive an invitation
                </p>
              </div>

              <button
                onClick={handleAddNew}
                disabled={adding || !name.trim()}
                className="w-full bg-indigo-600 text-white px-4 py-3 rounded-lg hover:bg-indigo-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {adding ? 'Adding...' : 'Add Person'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}