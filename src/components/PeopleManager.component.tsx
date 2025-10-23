import React, { useState } from "react";
import { X, Edit2, Trash2, Mail, Link2 } from "lucide-react";
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
    const person = diary.people[personId];
    return `${window.location.origin}/join/${
      diary.id
    }?person=${personId}&email=${encodeURIComponent(person.email || "")}`;
  };

  const copyToClipboard = (personId: string) => {
    const person = diary.people[personId];
    const link = generateInviteLink(personId);
    const message = `Join ${diary.name}\n\nYou've been added as: ${
      person.email || person.name
    }\n\nClick here to join: ${link}`;

    navigator.clipboard.writeText(message);
    alert("Invite link copied to clipboard!");
  };

  const handleSendEmail = async (personId: string) => {
    const person = diary.people[personId];
    const email = person.email || prompt("Enter email address:");

    if (email) {
      // In real implementation, this would call an email service
      alert(
        `Email invitation will be sent to ${email}\n\nLink: ${generateInviteLink(
          personId
        )}`
      );
    }
  };

  const handleUpdateEmail = async (personId: string) => {
    if (!newEmail.trim()) {
      alert("Please enter a valid email");
      return;
    }

    try {
      const person = diary.people[personId];
      const oldEmail = person.email;

      // Update email
      await firebaseService.updatePerson(diary.id, personId, {
        email: newEmail.trim(),
      });

      // If user is unregistered or pending, check if new email is registered
      if (person.status !== "accepted") {
        const targetUserId = await firebaseService.checkUserExists(
          newEmail.trim()
        );

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
            personId: personId, // ✅ FIXED: Actual person ID
            personEmail: newEmail.trim().toLowerCase(), // ✅ FIXED: Added personEmail field (normalized)
            personName: person.name,
            invitedBy: currentUserId,
            invitedByName: diary.people[currentUserId]?.name || "Unknown",
            status: "pending",
            createdAt: new Date().toISOString(),
          });

          alert(`Email updated and invitation sent to ${newEmail.trim()}!`);
        } else {
          alert(
            `Email updated to ${newEmail.trim()}. User not registered - share invite link instead.`
          );
        }
      } else {
        alert("Email updated successfully!");
      }

      setEditingPerson(null);
      setNewEmail("");
      onUpdate();
    } catch (error: any) {
      alert(error.message || "Failed to update email");
    }
  };

  const handleDeletePerson = async (personId: string, personName: string) => {
    const hasTransactions = diary.expenses.some(
      (exp) => exp.paidBy === personId || exp.participants.includes(personId)
    );

    if (hasTransactions) {
      alert(
        `Cannot delete ${personName}. This person has transactions.\n\nYou can:\n• Edit their email address instead\n• Have any member replace them with another user`
      );
      return;
    }

    if (confirm(`Delete ${personName} from this diary?`)) {
      try {
        await firebaseService.deletePerson(diary.id, personId);
        onUpdate();
        alert(`${personName} removed successfully`);
      } catch (error: any) {
        alert(error.message || "Failed to delete person");
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full my-8 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-800">Manage People</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>

        <div className="space-y-3 max-h-96 overflow-y-auto mb-4">
          {Object.values(diary.people).map((person) => {
            const hasTransactions = diary.expenses.some(
              (exp) =>
                exp.paidBy === person.id || exp.participants.includes(person.id)
            );

            return (
              <div key={person.id} className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-800">
                      {person.name}
                    </h3>

                    {editingPerson?.id === person.id ? (
                      <div className="mt-2">
                        <input
                          type="email"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          placeholder="Enter new email"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-2"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleUpdateEmail(person.id)}
                            className="px-3 py-1 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setEditingPerson(null);
                              setNewEmail("");
                            }}
                            className="px-3 py-1 bg-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-400"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-gray-600 truncate">
                          {person.email || "No email"}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span
                            className={`text-xs px-2 py-1 rounded-full ${
                              person.status === "accepted"
                                ? "bg-green-100 text-green-700"
                                : person.status === "pending"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {person.status === "accepted"
                              ? "✓ Joined"
                              : person.status === "pending"
                              ? "⏳ Pending"
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
                          title="Copy invite link with email info"
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
                    {person.id !== currentUserId && (
                      <button
                        onClick={() =>
                          handleDeletePerson(person.id, person.name)
                        }
                        className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition"
                        title={
                          hasTransactions
                            ? "Cannot delete - has transactions"
                            : "Delete person"
                        }
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-800 mb-4">
          <strong>Note:</strong> All members have equal rights. People with
          transactions cannot be deleted - only their email can be updated. You
          cannot remove yourself using this interface.
        </div>

        <button
          onClick={onClose}
          className="w-full bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
        >
          Close
        </button>
      </div>
    </div>
  );
}
