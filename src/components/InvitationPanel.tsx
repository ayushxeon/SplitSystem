import React from 'react';
import { Bell, X, Check } from 'lucide-react';
import { firebaseService } from '../services/firebaseService';
import type { User, Invitation } from '../types/types';

interface InvitationsPanelProps {
  user: User;
  invitations: Invitation[];
  onClose: () => void;
  onAccepted: () => void;
}

export function InvitationsPanel({ user, invitations, onClose, onAccepted }: InvitationsPanelProps) {
  const handleAccept = async (invitation: Invitation) => {
    try {
      await firebaseService.acceptInvitation(invitation, user.uid, user.email);
      alert('Invitation accepted!');
      onAccepted();
    } catch (error) {
      alert('Failed to accept invitation');
    }
  };

  const pendingInvitations = invitations.filter(inv => inv.status === 'pending');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Bell className="text-indigo-600" />
            Pending Invitations ({pendingInvitations.length})
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {pendingInvitations.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No pending invitations</p>
          ) : (
            <div className="space-y-4">
              {pendingInvitations.map(invitation => (
                <div key={invitation.id} className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-indigo-200">
                  <div className="mb-3">
                    <h3 className="font-semibold text-gray-800 mb-1">{invitation.diaryName}</h3>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">{invitation.invitedByName}</span> wants to add you as <span className="font-medium">{invitation.personName}</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(invitation.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAccept(invitation)}
                      className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition flex items-center justify-center gap-2"
                    >
                      <Check size={18} />
                      Accept
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
