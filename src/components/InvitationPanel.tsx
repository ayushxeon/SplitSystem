import React, { useState, useEffect } from 'react';
import { Bell, X, Check, Trash2 } from 'lucide-react';
import { firebaseService } from '../services/firebaseService';
import type { User, Invitation } from '../types/types';

interface InvitationsPanelProps {
  user: User;
  invitations: Invitation[];
  onClose: () => void;
  onAccepted: () => void;
}

export function InvitationsPanel({ user, invitations, onClose, onAccepted }: InvitationsPanelProps) {
  const [validatingInvites, setValidatingInvites] = useState<Record<string, boolean>>({});
  const [invalidInvites, setInvalidInvites] = useState<Record<string, string>>({});

  // ✅ Validate each invitation on mount
  useEffect(() => {
    const validateInvitations = async () => {
      const validationResults: Record<string, string> = {};
      
      for (const invitation of invitations.filter(inv => inv.status === 'pending')) {
        try {
          const isValid = await firebaseService.validateInvitation(invitation.diaryId);
          if (!isValid) {
            validationResults[invitation.id] = 'This diary no longer exists or has been deleted.';
          }
        } catch (error: any) {
          validationResults[invitation.id] = error.message || 'Unable to validate invitation';
        }
      }
      
      setInvalidInvites(validationResults);
    };

    validateInvitations();
  }, [invitations]);

  const handleAccept = async (invitation: Invitation) => {
    // Check if invitation is invalid
    if (invalidInvites[invitation.id]) {
      alert(`Cannot accept: ${invalidInvites[invitation.id]}`);
      return;
    }

    setValidatingInvites(prev => ({ ...prev, [invitation.id]: true }));
    
    try {
      await firebaseService.acceptInvitation(invitation, user.uid);
      alert('✓ Invitation accepted!');
      onAccepted();
    } catch (error: any) {
      alert(error.message || 'Failed to accept invitation');
    } finally {
      setValidatingInvites(prev => ({ ...prev, [invitation.id]: false }));
    }
  };

  const handleReject = async (invitation: Invitation) => {
    if (!confirm('Reject this invitation? The person who invited you will see you rejected it.')) {
      return;
    }

    try {
      await firebaseService.rejectInvitation(invitation.id, invitation.diaryId, invitation.personId);
      alert('✓ Invitation rejected');
      onAccepted(); // Refresh
    } catch (error: any) {
      alert(error.message || 'Failed to reject invitation');
    }
  };

  const handleDismiss = async (invitation: Invitation) => {
    try {
      await firebaseService.dismissInvitation(invitation.id);
      alert('✓ Invitation dismissed');
      onAccepted(); // Refresh
    } catch (error: any) {
      alert(error.message || 'Failed to dismiss invitation');
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
              {pendingInvitations.map(invitation => {
                const isInvalid = !!invalidInvites[invitation.id];
                const isValidating = validatingInvites[invitation.id];
                
                return (
                  <div 
                    key={invitation.id} 
                    className={`p-4 rounded-lg border ${
                      isInvalid 
                        ? 'bg-gradient-to-r from-red-50 to-pink-50 border-red-200' 
                        : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-indigo-200'
                    }`}
                  >
                    <div className="mb-3">
                      <h3 className="font-semibold text-gray-800 mb-1">{invitation.diaryName}</h3>
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">{invitation.invitedByName}</span> wants to add you as <span className="font-medium">{invitation.personName}</span>
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(invitation.createdAt).toLocaleDateString()}
                      </p>
                      
                      {/* ✅ Show error message if invalid */}
                      {isInvalid && (
                        <div className="mt-2 p-2 bg-red-100 border border-red-300 rounded text-xs text-red-700">
                          ⚠️ {invalidInvites[invitation.id]}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      {!isInvalid ? (
                        <>
                          <button
                            onClick={() => handleAccept(invitation)}
                            disabled={isValidating}
                            className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                            <Check size={18} />
                            {isValidating ? 'Accepting...' : 'Accept'}
                          </button>
                          <button
                            onClick={() => handleReject(invitation)}
                            className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition flex items-center justify-center gap-2"
                          >
                            <X size={18} />
                            Reject
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleDismiss(invitation)}
                          className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition flex items-center justify-center gap-2"
                        >
                          <Trash2 size={18} />
                          Dismiss
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}