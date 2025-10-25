// User type
export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string | null;
}

// Person in a diary
export interface Person {
  id: string;
  name: string;
  email?: string;
  userId?: string;
  status: 'unregistered' | 'pending' | 'accepted' | 'rejected'; // ✅ Added 'rejected'
  invitedBy: string;
  invitedAt: string;
}

// Expense
export interface Expense {
  id: string;
  description: string;
  amount: number;
  paidBy: string;
  participants: string[];
  splits: Record<string, number>;
  date: string;
  eventId: string;
  splitMode: 'equal' | 'percentage' | 'custom';
  createdBy: string;
  
  // Modification tracking
  modifiedBy?: string;
  modifiedByName?: string;
  modifiedAt?: string;
  lastModifiedBy?: string;
  lastModifiedAt?: string;
  
  // Versioning
  currentVersion?: number;
  versions?: ExpenseVersion[];
  
  // ✅ NEW: Deletion tracking
  deletedBy?: string;
  deletedAt?: string;
  
  // ✅ NEW: People snapshot for restoration
  peopleSnapshot?: Record<string, Person>;
  
  // ✅ NEW: Frozen splits for custom split mode
  frozenSplits?: string[];
}

// Expense version for history
export interface ExpenseVersion {
  versionNumber: number;
  timestamp: string;
  modifiedBy: string;
  modifiedByName: string;
  data: {
    description: string;
    amount: number;
    paidBy: string;
    eventId: string;
    splitMode: 'equal' | 'percentage' | 'custom';
    splits: Record<string, number>;
    participants: string[];
  };
}

// Event
export interface Event {
  id: string;
  name: string;
  order: number;
}

// Settlement
export interface Settlement {
  id: string;
  from: string;
  to: string;
  amount: number;
  date: string;
  status: 'pending' | 'confirmed' | 'marked_paid';
  markedPaidBy?: string;
  markedPaidAt?: string;
}

// Join Request
export interface JoinRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
}

// Diary
export interface Diary {
  id: string;
  name: string;
  createdBy: string;
  members: string[];
  people: Record<string, Person>;
  expenses: Expense[];
  deletedExpenses?: Expense[]; // ✅ For soft delete
  settlements: Settlement[];
  events: Event[];
  joinRequests?: JoinRequest[];
  createdAt: string;
  updatedAt: string;
}

// Invitation
export interface Invitation {
  id: string;
  diaryId: string;
  diaryName: string;
  personId: string;
  personEmail: string;
  personName: string;
  invitedBy: string;
  invitedByName: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
  invitedAt?: string;
}

// Modification Notification
export interface ModificationNotification {
  id: string;
  diaryId: string;
  diaryName: string;
  expenseId: string;
  expenseName: string;
  type: 'created' | 'modified' | 'deleted';
  modifiedBy: string;
  modifiedByName: string;
  timestamp: string;
  participants: string[];
  acknowledged: string[];
  createdAt: string;
  amount?: number; // ✅ Optional amount for created notifications
}