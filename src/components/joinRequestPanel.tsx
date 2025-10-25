import React from 'react';
import { Check, X, UserPlus } from 'lucide-react';
import type { JoinRequest } from '../types/types';

interface JoinRequestsPanelProps {
  requests: JoinRequest[];
  onApprove: (requestId: string) => void;
  onReject: (requestId: string) => void;
}

export function JoinRequestsPanel({ requests, onApprove, onReject }: JoinRequestsPanelProps) {
  const pendingRequests = requests.filter((r) => r.status === 'pending');

  if (pendingRequests.length === 0) return null;

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <UserPlus size={18} className="text-yellow-600" />
        <h3 className="font-semibold text-yellow-800">
          Join Requests ({pendingRequests.length})
        </h3>
      </div>

      <div className="space-y-2">
        {pendingRequests.map((request) => (
          <div
            key={request.id}
            className="bg-white rounded-lg p-3 flex items-center justify-between"
          >
            <div>
              <p className="font-medium text-gray-800">{request.userName}</p>
              <p className="text-xs text-gray-500">{request.userEmail}</p>
              <p className="text-xs text-gray-400">
                {new Date(request.requestedAt).toLocaleDateString()}
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => onApprove(request.id)}
                className="bg-green-500 text-white p-2 rounded-lg hover:bg-green-600 transition"
                title="Approve"
              >
                <Check size={16} />
              </button>
              <button
                onClick={() => onReject(request.id)}
                className="bg-red-500 text-white p-2 rounded-lg hover:bg-red-600 transition"
                title="Reject"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}