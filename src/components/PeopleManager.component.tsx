import React, { useState } from "react";
import { X, Edit2, Trash2, Mail, Link2, LogOut } from "lucide-react";
import { firebaseService } from "../services/firebaseService";
import type { Diary, Person } from "../types/types";

interface PeopleManagerProps {
  diary: Diary;
  currentUserId: string;
  onClose: () => void;
  onUpdate: () => void;
}

export function PeopleManager({
  diary,
  currentUserId,
  onClose,
  onUpdate,
}: PeopleManagerProps) {
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [newEmail, setNewEmail] = useState("");

  const generateInviteLink = (personId: string) => {
    return `${window.location.origin}/invite/${diary.id}`;
  };

  const copyToClipboard = (personId: string) => {
    const person = diary.people[personId];
    const link = generateInviteLink(personId);
    const message = `Join "${diary.name}" on SplitSync!\n\nYou've been added as: ${
      person.email || person.name
    }\n\nClick here to join: ${link}`;

    navigator.clipboard.writeText(message);
    alert("✓ Invite link copied to clipboard!");
  };

  const handleSendEmail = async (personId: string) => {
    const person = diary.people[personId];
    const email = person.email || prompt("Enter email address:");

    if (email) {
      alert(
        `Email invitation would be sent to ${email}\n\nLink: ${generateInviteLink(
          personId
        )}\n\n(Email service not configured yet)`
      );
    }
  };

  const handleUpdateEmail = async (personId: string) => {
    if (!newEmail.trim()) {
      alert("Please enter a valid email");
      return;
    }

    const normalizedEmail = newEmail.trim().toLowerCase();

    // ✅ Check if email already exists in diary
    const existingPerson = Object.values(diary.people).find(
      (p) => p.email?.toLowerCase() === normalizedEmail && p.id !== personId
    );

    if (existingPerson) {
      alert(`❌ Email ${normalizedEmail} is already used by ${existingPerson.name}`);
      return;
    }

    try {
      const person = diary.people[personId];

      // Update email
      await firebaseService.updatePerson(diary.id, personId, {
        email: normalizedEmail,
      });

      // If user is unregistered or pending, check if new email is registered
      if (person.status !== "accepted") {
        const targetUserId = await firebaseService.checkUserExists(normalizedEmail);

        if (targetUserId) {
          // Update person with userId and send invitation
          await firebaseService.updatePerson(diary.id, personId, {
            userId: targetUserId,
            status: "pending",
          });

          // Send new invitation
          const invitationId = `${diary.id}_${personId}_${Date.now()}`;
          await firebaseService.createInvitation({
            id: invitationId,
            diaryId: diary.id,
            diaryName: diary.name,
            personId: personId,
            personEmail: normalizedEmail,
            personName: person.name,
            invitedBy: currentUserId,
            invitedByName: diary.people[currentUserId]?.name || "Unknown",
            status: "pending",
            createdAt: new Date().toISOString(),
          });

          alert(`✓ Email updated and invitation sent to ${normalizedEmail}!`);
        } else {
          alert(
            `✓ Email updated to ${normalizedEmail}. User not registered - share invite link instead.`
          );
        }
      } else {
        alert("✓ Email updated successfully!");
      }

      setEditingPerson(null);
      setNewEmail("");
      onUpdate();
    } catch (error: any) {
      alert(error.message || "Failed to update email");
    }
  };

  const handleRemovePerson = async (personId: string, personName: string) => {
    const person = diary.people[personId];
    
    // Check if trying to remove yourself
    if (person.userId === currentUserId) {
      if (confirm("Are you sure you want to leave this diary?")) {
        try {
          await firebaseService.leaveDiary(diary.id, currentUserId);
          alert("✓ You have left the diary");
          onClose();
          onUpdate();
        } catch (error: any) {
          alert(error.message || "Failed to leave diary");
        }
      }
      return;
    }

    // Check if person has transactions
    const hasTransactions = diary.expenses.some(
      (exp) => exp.paidBy === personId || exp.participants.includes(personId)
    );

    if (hasTransactions) {
      alert(
        `❌ Cannot remove ${personName}. This person has transactions.\n\nYou can:\n• Edit their email address instead\n• Archive this diary and create a new one`
      );
      return;
    }

    if (confirm(`Remove ${personName} from this diary?`)) {
      try {
        await firebaseService.removePerson(diary.id, personId);
        alert(`✓ ${personName} removed successfully`);
        onUpdate();
      } catch (error: any) {
        alert(error.message || "Failed to remove person");
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full my-8 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4 sticky top-0 bg-white pb-4 border-b">
          <h2 className="text-2xl font-bold text-gray-800">Manage People</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>

        <div className="space-y-3 mb-4">
          {Object.values(diary.people).map((person) => {
            const hasTransactions = diary.expenses.some(
              (exp) =>
                exp.paidBy === person.id || exp.participants.includes(person.id)
            );
            
            const isCurrentUser = person.userId === currentUserId;

            return (
              <div 
                key={person.id} 
                className={`rounded-lg p-4 ${
                  isCurrentUser 
                    ? 'bg-indigo-50 border-2 border-indigo-200' 
                    : 'bg-gray-50 border border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-800">
                        {person.name}
                      </h3>
                      {isCurrentUser && (
                        <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                          You
                        </span>
                      )}
                    </div>

                    {editingPerson?.id === person.id ? (
                      <div className="mt-2">
                        <input
                          type="email"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          placeholder="Enter new email"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-2"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleUpdateEmail(person.id)}
                            className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setEditingPerson(null);
                              setNewEmail("");
                            }}
                            className="px-3 py-1.5 bg-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-400"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-gray-600 truncate mb-2">
                          {person.email || "No email"}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* ✅ FIXED: Added rejected status */}
                          <span
                            className={`text-xs px-2 py-1 rounded-full font-medium ${
                              person.status === "accepted"
                                ? "bg-green-100 text-green-700"
                                : person.status === "pending"
                                ? "bg-yellow-100 text-yellow-700"
                                : person.status === "rejected"
                                ? "bg-red-100 text-red-700"
                                : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {person.status === "accepted"
                              ? "✓ Joined"
                              : person.status === "pending"
                              ? "⏳ Pending"
                              : person.status === "rejected"
                              ? "❌ Rejected"
                              : "👤 Guest"}
                          </span>
                          {hasTransactions && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                              Has transactions
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {person.status === "unregistered" && (
                      <>
                        <button
                          onClick={() => copyToClipboard(person.id)}
                          className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition"
                          title="Copy invite link"
                        >
                          <Link2 size={18} />
                        </button>
                        <button
                          onClick={() => handleSendEmail(person.id)}
                          className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition"
                          title="Send email invite"
                        >
                          <Mail size={18} />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => {
                        setEditingPerson(person);
                        setNewEmail(person.email || "");
                      }}
                      className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition"
                      title="Edit email"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => handleRemovePerson(person.id, person.name)}
                      className={`p-2 rounded-lg transition ${
                        isCurrentUser
                          ? 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200'
                          : 'bg-red-100 text-red-600 hover:bg-red-200'
                      }`}
                      title={
                        isCurrentUser
                          ? "Leave diary"
                          : hasTransactions
                          ? "Cannot remove - has transactions"
                          : "Remove person"
                      }
                    >
                      {isCurrentUser ? <LogOut size={18} /> : <Trash2 size={18} />}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-800 mb-4">
          <strong>📌 Note:</strong> People with transactions cannot be removed. You can edit their email or leave the diary yourself.
        </div>

        <button
          onClick={onClose}
          className="w-full bg-indigo-600 text-white px-4 py-3 rounded-lg hover:bg-indigo-700 transition font-medium"
        >
          Close
        </button>
      </div>
    </div>
  );
}