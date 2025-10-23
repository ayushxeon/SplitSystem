import React from 'react';
import { Bell, X, Edit2, Trash2, ExternalLink, Plus } from 'lucide-react';
import type { ModificationNotification } from '../types/types';

interface ModificationNotificationsProps {
  notifications: ModificationNotification[];
  onAcknowledge: (notificationId: string) => void;
  onNavigate: (diaryId: string, expenseId: string) => void;
  onClose: () => void;
}

export function ModificationNotifications({ 
  notifications, 
  onAcknowledge,
  onNavigate,
  onClose 
}: ModificationNotificationsProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Bell className="text-orange-600" />
            Notifications ({notifications.length})
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {notifications.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No new notifications</p>
          ) : (
            <div className="space-y-4">
              {notifications.map(notification => (
                <div 
                  key={notification.id} 
                  className={`p-4 rounded-lg border ${
                    notification.type === 'deleted' 
                      ? 'bg-gradient-to-r from-red-50 to-pink-50 border-red-200'
                      : notification.type === 'created'
                      ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200'
                      : 'bg-gradient-to-r from-orange-50 to-yellow-50 border-orange-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {notification.type === 'deleted' ? (
                          <Trash2 size={18} className="text-red-600" />
                        ) : notification.type === 'created' ? (
                          <Plus size={18} className="text-green-600" />
                        ) : (
                          <Edit2 size={18} className="text-orange-600" />
                        )}
                        <h3 className="font-semibold text-gray-800">
                          {notification.type === 'deleted' ? 'Expense Deleted' : 
                           notification.type === 'created' ? 'New Expense Added' :
                           'Expense Modified'}
                        </h3>
                      </div>
                      
                      <p className="text-sm text-gray-700 mb-1">
                        <span className="font-medium">{notification.modifiedByName}</span> 
                        {notification.type === 'deleted' ? ' deleted ' : 
                         notification.type === 'created' ? ' added ' :
                         ' modified '}
                        <span className="font-medium">"{notification.expenseName}"</span>
                        {notification.amount && notification.type === 'created' && (
                          <span className="font-bold text-green-700"> (₹{notification.amount.toFixed(2)})</span>
                        )}
                      </p>
                      
                      <p className="text-sm text-gray-600 mb-1">
                        in <span className="font-medium">{notification.diaryName}</span>
                      </p>
                      
                      <p className="text-xs text-gray-500">
                        {new Date(notification.timestamp).toLocaleString()}
                      </p>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      {notification.type !== 'deleted' && (
                        <button
                          onClick={() => {
                            onNavigate(notification.diaryId, notification.expenseId);
                            onClose();
                          }}
                          className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm flex items-center gap-1"
                          title="View expense"
                        >
                          <ExternalLink size={14} />
                          View
                        </button>
                      )}
                      <button
                        onClick={() => onAcknowledge(notification.id)}
                        className="px-3 py-1 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition text-sm"
                      >
                        Dismiss
                      </button>
                    </div>
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