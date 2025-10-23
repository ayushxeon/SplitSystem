export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
}

export interface Person {
  id: string;
  name: string;
  email: string | null;
  userId: string | null;
  status: 'pending' | 'accepted' | 'unregistered'; // Keep as is
  invitedBy: string;
  invitedAt: string;
}

export interface Event {
  id: string;
  name: string;
  order: number;
}

export interface ExpenseVersion {
  versionNumber: number;
  timestamp: string;
  modifiedBy: string;
  modifiedByName?: string; // ADDED: Store name at modification time
  data: {
    description: string;
    amount: number;
    paidBy: string;
    eventId: string;
    splitMode: 'equal' | 'custom';
    splits: Record<string, number>;
    participants: string[];
  };
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  paidBy: string;
  eventId: string; // This should NEVER be undefined
  splitMode: 'equal' | 'custom';
  splits: Record<string, number>;
  participants: string[];
  frozenSplits?: string[];
  date: string;
  createdBy: string;
  lastModifiedBy?: string;
  lastModifiedAt?: string;
  lastModifiedByName?: string; // ADDED: Store name at modification time
  versions?: ExpenseVersion[];
  currentVersion: number;
}

export interface Settlement {
  id: string;
  from: string;
  to: string;
  amount: number;
  date: string;
  status: 'pending' | 'marked_paid' | 'confirmed';
  markedPaidBy?: string;
  markedPaidAt?: string;
}

export interface Diary {
  id: string;
  name: string;
  createdBy: string;
  members: string[];
  people: Record<string, Person>;
  expenses: Expense[];
  deletedExpenses?: Expense[];
  settlements: Settlement[];
  events: Event[];
  createdAt: string;
  updatedAt: string;
  inviteLink?: string;
}

export interface Invitation {
  id: string;
  diaryId: string;
  diaryName: string;
  personId: string; // Keep for backward compatibility
  personEmail: string; // IMPORTANT: This is what we query by (normalized lowercase)
  personName: string;
  invitedBy: string;
  invitedByName: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

export interface ModificationNotification {
  id: string;
  diaryId: string;
  diaryName: string;
  expenseId: string;
  expenseName: string;
  modifiedBy: string;
  modifiedByName: string;
  timestamp: string;
  type: 'created' | 'modified' | 'deleted';
  amount?: number;
  participants: string[];
  acknowledged: string[];
}