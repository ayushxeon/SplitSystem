import React, { useState } from 'react';
import { firebaseService } from '../services/firebaseService';
import type { User, Person, Diary } from '../types/types';

interface AddPersonModalProps {
  diary: Diary;
  currentUser: User;
  onClose: () => void;
  onAdded: () => void;
}

export function AddPersonModal({ diary, currentUser, onClose, onAdded }: AddPersonModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    if (!name.trim()) {
      alert('Please enter a name');
      return;
    }

    // Check for duplicate name
    const duplicateName = Object.values(diary.people).find(
      p => p.name.toLowerCase() === name.trim().toLowerCase()
    );
    if (duplicateName) {
      alert('A person with this name already exists!');
      return;
    }

    setLoading(true);
    try {
      const personId = Date.now().toString();
      let targetUserId = null;

      if (email.trim()) {
        // FIX: Normalize email to lowercase for consistent matching
        const normalizedEmail = email.trim().toLowerCase();
        
        // Check for duplicate email in this diary
        const duplicateEmail = Object.values(diary.people).find(
          p => p.email && p.email.toLowerCase() === normalizedEmail
        );
        if (duplicateEmail) {
          alert('A user with this email already exists in this diary!');
          setLoading(false);
          return;
        }

        // FIX: Pass normalized email to checkUserExists
        targetUserId = await firebaseService.checkUserExists(normalizedEmail);
        
        if (targetUserId) {
          const existing = Object.values(diary.people).find(p => p.userId === targetUserId);
          if (existing) {
            alert('This user is already in the diary!');
            setLoading(false);
            return;
          }
        }
      }

      const newPerson: Person = {
        id: personId,
        name: name.trim(),
        email: email.trim() ? email.trim().toLowerCase() : null, // FIX: Normalize to lowercase
        userId: targetUserId || null,
        status: targetUserId ? 'pending' : 'unregistered',
        invitedBy: currentUser.uid,
        invitedAt: new Date().toISOString()
      };

      // This will now automatically create invitation
      await firebaseService.addPersonToDiary(diary.id, newPerson);

      if (targetUserId) {
        alert(`Invitation sent to ${email}! They will see it in their notifications.`);
      } else if (email.trim()) {
        alert(`${name} added as guest! They'll receive an invitation when they register with ${email}.`);
      } else {
        alert(`${name} added as guest! You can send them an invite link from Manage People.`);
      }

      onAdded();
      onClose();
    } catch (error: any) {
      console.error('Error adding person:', error);
      alert(error.message || 'Failed to add person');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800">Add Person</h2>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter name"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email (optional)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter email for invitation"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              If registered, they'll get an invitation notification. If not registered yet, they'll get the invitation automatically when they sign up with this email.
            </p>
          </div>

          <div className="flex gap-2 pt-4">
            <button
              onClick={handleAdd}
              disabled={loading}
              className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add Person'}
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}