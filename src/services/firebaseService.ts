// firebaseService.ts - FIXED VERSION with all corrections

import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  query, 
  where, 
  arrayUnion, 
  arrayRemove,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { cacheService } from './storage';
import type { 
  Diary, 
  Invitation, 
  Person, 
  Expense, 
  Event, 
  Settlement,
  ExpenseVersion,
  ModificationNotification 
} from '../types/types';

class FirebaseService {
  
  // ============= HELPER METHOD =============
  
  /**
   * Remove undefined values from object to prevent Firestore errors
   */
  private clean<T extends Record<string, any>>(obj: T): Partial<T> {
    const cleaned: any = {};
    Object.keys(obj).forEach(key => {
      if (obj[key] !== undefined) {
        cleaned[key] = obj[key];
      }
    });
    return cleaned;
  }

  // ============= DIARY OPERATIONS =============
  
  async createDiary(diary: Diary, creator: { uid: string; email: string; displayName: string }): Promise<void> {
    const diaryRef = doc(db, 'diaries', diary.id);
    
    const creatorPerson: Person = {
      id: creator.uid,
      name: creator.displayName,
      email: creator.email.toLowerCase(),
      userId: creator.uid,
      status: 'accepted',
      invitedBy: creator.uid,
      invitedAt: new Date().toISOString()
    };

    const diaryWithCreator = {
      ...diary,
      people: { [creator.uid]: creatorPerson }
    };

    await setDoc(diaryRef, diaryWithCreator);
    cacheService.addDiary(diaryWithCreator);
  }

  async syncDiaries(userId: string): Promise<Diary[]> {
    const diariesQuery = query(
      collection(db, 'diaries'),
      where('members', 'array-contains', userId)
    );
    
    const snapshot = await getDocs(diariesQuery);
    const diaries = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Diary[];

    cacheService.setDiaries(diaries);
    cacheService.setLastSyncTime(Date.now());
    return diaries;
  }

  subscribeToUserDiaries(userId: string, callback: (diaries: Diary[]) => void): () => void {
    const diariesQuery = query(
      collection(db, 'diaries'),
      where('members', 'array-contains', userId)
    );

    const unsubscribe = onSnapshot(
      diariesQuery, 
      (snapshot) => {
        const diaries = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Diary[];
        
        callback(diaries);
        cacheService.setDiaries(diaries);
        cacheService.setLastSyncTime(Date.now());
      },
      (error) => {
        console.error('Error in diaries subscription:', error);
      }
    );

    return unsubscribe;
  }

  async leaveDiary(diaryId: string, userId: string): Promise<void> {
    const diaryRef = doc(db, 'diaries', diaryId);
    const diarySnap = await getDoc(diaryRef);
    
    if (!diarySnap.exists()) throw new Error('Diary not found');

    const diary = diarySnap.data() as Diary;

    const hasExpenses = diary.expenses.some(exp => 
      exp.paidBy === userId || exp.participants.includes(userId)
    );
    
    const hasSettlements = diary.settlements.some(set => 
      set.from === userId || set.to === userId
    );

    if (hasExpenses || hasSettlements) {
      throw new Error('Cannot leave diary with pending transactions.');
    }

    const personEntry = Object.entries(diary.people).find(
      ([_, person]) => person.userId === userId
    );

    if (!personEntry) throw new Error('User not found in diary');

    const [personId, person] = personEntry;

    const updates: any = {
      members: arrayRemove(userId),
      updatedAt: new Date().toISOString()
    };
    
    updates[`people.${personId}`] = {
      ...person,
      status: 'guest',
      userId: undefined
    };

    await updateDoc(diaryRef, this.clean(updates));
    cacheService.removeDiary(diaryId);
  }

  /**
   * Register a new user or update existing user's last login
   * Also links any guest accounts with matching email
   */
  async registerUser(userData: {
    uid: string;
    email: string;
    displayName: string;
    photoURL?: string;
  }): Promise<void> {
    const userRef = doc(db, 'users', userData.uid);
    const normalizedEmail = userData.email.toLowerCase();
    
    // Check if user already exists
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      // User exists, just update lastLogin
      await updateDoc(userRef, {
        lastLogin: new Date().toISOString()
      });
    } else {
      // New user, create document
      await setDoc(userRef, {
        uid: userData.uid,
        email: normalizedEmail,
        displayName: userData.displayName,
        photoURL: userData.photoURL,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString()
      });
      console.log('✅ New user registered:', normalizedEmail);
    }
    
    // Link any guest accounts with matching email
    await this.linkGuestAccountsOnRegistration(userData.uid, normalizedEmail, userData.displayName);
  }

  /**
   * Find and link guest accounts to newly registered user
   */
  private async linkGuestAccountsOnRegistration(userId: string, email: string, displayName: string): Promise<void> {
    try {
      // Query all diaries
      const diariesSnap = await getDocs(collection(db, 'diaries'));
      
      for (const diaryDoc of diariesSnap.docs) {
        const diary = diaryDoc.data() as Diary;
        
        // Find any guest (unregistered) person with matching email
        const guestEntry = Object.entries(diary.people).find(
          ([_, person]) => 
            person.email?.toLowerCase() === email.toLowerCase() && 
            person.status === 'guest' &&
            !person.userId
        );
        
        if (guestEntry) {
          const [personId, person] = guestEntry as [string, Person];
          
          console.log('🔗 Linking guest account to user:', email, 'in diary:', diary.name);
          
          // Update person to be linked to this user and change status to pending
          await updateDoc(doc(db, 'diaries', diaryDoc.id), this.clean({
            [`people.${personId}.userId`]: userId,
            [`people.${personId}.status`]: 'pending',
            [`people.${personId}.name`]: displayName,
            members: arrayUnion(userId),
            updatedAt: new Date().toISOString()
          }));
          
          // Create an invitation for them
          const invitationId = `${diaryDoc.id}_${personId}_${Date.now()}`;
          const invitation: Invitation = {
            id: invitationId,
            diaryId: diary.id,
            diaryName: diary.name,
            personId: email.toLowerCase(),
            personName: displayName,
            invitedBy: person.invitedBy,
            invitedByName: diary.people[person.invitedBy]?.name || 'Unknown',
            status: 'pending',
            createdAt: new Date().toISOString()
          };
          
          await this.createInvitation(invitation);
          console.log('📧 Created invitation for newly registered user:', email);
        }
      }
    } catch (error) {
      console.error('Error linking guest accounts:', error);
    }
  }

  // ============= PERSON OPERATIONS =============

  async checkUserExists(email: string): Promise<string | null> {
    const normalizedEmail = email.toLowerCase();
    const usersQuery = query(
      collection(db, 'users'),
      where('email', '==', normalizedEmail)
    );
    const snapshot = await getDocs(usersQuery);
    return snapshot.empty ? null : snapshot.docs[0].id;
  }

  async addPersonToDiary(diaryId: string, person: Person): Promise<void> {
    const diaryRef = doc(db, 'diaries', diaryId);
    const diarySnap = await getDoc(diaryRef);
    
    if (!diarySnap.exists()) throw new Error('Diary not found');
    
    const diary = diarySnap.data() as Diary;
    
    // Normalize email if present
    const normalizedPerson = person.email 
      ? { ...person, email: person.email.toLowerCase() }
      : person;
    
    await updateDoc(diaryRef, this.clean({
      [`people.${person.id}`]: normalizedPerson,
      updatedAt: new Date().toISOString()
    }));
    
    // Create invitation if person has email (for both guests and registered users)
    if (person.email) {
  const invitationId = `${diaryId}_${person.id}_${Date.now()}`;
  const invitation: Invitation = {
    id: invitationId,
    diaryId: diary.id,
    diaryName: diary.name,
    personId: person.id,  // ✅ FIXED: person ID (for backward compatibility)
    personEmail: person.email.toLowerCase(),  // ✅ FIXED: Added personEmail field
    personName: person.name,
    invitedBy: person.invitedBy,
    invitedByName: diary.people[person.invitedBy]?.name || 'Unknown',
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  
  console.log('📧 Creating invitation for:', person.email);
  await this.createInvitation(invitation);
}
  }

  async updatePerson(diaryId: string, personId: string, updates: Partial<Person>): Promise<void> {
    const diaryRef = doc(db, 'diaries', diaryId);
    const diarySnap = await getDoc(diaryRef);
    
    if (!diarySnap.exists()) throw new Error('Diary not found');
    
    const diary = diarySnap.data() as Diary;
    const person = diary.people[personId];
    
    if (!person) throw new Error('Person not found');

    await updateDoc(diaryRef, this.clean({
      [`people.${personId}`]: { ...person, ...updates },
      updatedAt: new Date().toISOString()
    }));
  }

  async deletePerson(diaryId: string, personId: string): Promise<void> {
    const diaryRef = doc(db, 'diaries', diaryId);
    const diarySnap = await getDoc(diaryRef);
    
    if (!diarySnap.exists()) throw new Error('Diary not found');
    
    const diary = diarySnap.data() as Diary;
    
    const hasTransactions = diary.expenses.some(exp => 
      exp.paidBy === personId || exp.participants.includes(personId)
    );

    if (hasTransactions) {
      throw new Error('Cannot delete person with transactions');
    }

    const newPeople = { ...diary.people };
    delete newPeople[personId];

    await updateDoc(diaryRef, this.clean({
      people: newPeople,
      updatedAt: new Date().toISOString()
    }));
  }

  // ============= EXPENSE OPERATIONS =============

  async addExpense(diaryId: string, expense: Expense): Promise<void> {
    const diaryRef = doc(db, 'diaries', diaryId);
    const diarySnap = await getDoc(diaryRef);
    
    if (!diarySnap.exists()) throw new Error('Diary not found');
    
    const diary = diarySnap.data() as Diary;
    
    // Clean the expense object before saving
    const cleanExpense = this.clean(expense);
    
    await updateDoc(diaryRef, this.clean({
      expenses: arrayUnion(cleanExpense),
      updatedAt: new Date().toISOString()
    }));

    const participantsToNotify = expense.participants
      .filter(p => {
        const person = diary.people[p];
        return person?.userId && person.userId !== expense.createdBy;
      });

    if (participantsToNotify.length > 0) {
      const notification: ModificationNotification = {
        id: `notif_${Date.now()}`,
        diaryId,
        diaryName: diary.name,
        expenseId: expense.id,
        expenseDescription: expense.description,
        type: 'created',
        modifiedBy: expense.createdBy,
        modifiedByName: diary.people[Object.keys(diary.people).find(id => diary.people[id].userId === expense.createdBy)!]?.name || 'Unknown',
        participants: participantsToNotify.map(p => diary.people[p].userId!),
        acknowledged: [],
        createdAt: new Date().toISOString()
      };
      
      await setDoc(doc(db, 'notifications', notification.id), notification);
    }
  }

  async updateExpense(diaryId: string, expenseId: string, updates: Partial<Expense>, currentUserId: string): Promise<void> {
    const diaryRef = doc(db, 'diaries', diaryId);
    const diarySnap = await getDoc(diaryRef);
    
    if (!diarySnap.exists()) throw new Error('Diary not found');
    
    const diary = diarySnap.data() as Diary;
    const expenseIndex = diary.expenses.findIndex(exp => exp.id === expenseId);
    
    if (expenseIndex === -1) throw new Error('Expense not found');

    const oldExpense = diary.expenses[expenseIndex];
    
    // Find modifier's name
    const modifierName = diary.people[Object.keys(diary.people).find(id => 
      diary.people[id].userId === currentUserId
    )!]?.name || 'Unknown';
    
    const updatedExpense = this.clean({
      ...oldExpense,
      ...updates,
      modifiedBy: currentUserId,
      modifiedByName: modifierName,
      modifiedAt: new Date().toISOString(),
      currentVersion: (oldExpense.currentVersion || 1) + 1,
      previousVersions: [
        ...(oldExpense.previousVersions || []),
        {
          version: oldExpense.currentVersion || 1,
          modifiedBy: currentUserId,
          modifiedByName: modifierName,
          modifiedAt: new Date().toISOString(),
          data: oldExpense
        }
      ]
    });

    const newExpenses = [...diary.expenses];
    newExpenses[expenseIndex] = updatedExpense as Expense;
    
    await updateDoc(diaryRef, this.clean({
      expenses: newExpenses,
      updatedAt: new Date().toISOString()
    }));

    const participantsToNotify = updatedExpense.participants
      .filter((p: string) => {
        const person = diary.people[p];
        return person?.userId && person.userId !== currentUserId;
      });

    if (participantsToNotify.length > 0) {
      const notification: ModificationNotification = {
        id: `notif_${Date.now()}`,
        diaryId,
        diaryName: diary.name,
        expenseId: expenseId,
        expenseDescription: updatedExpense.description,
        type: 'modified',
        modifiedBy: currentUserId,
        modifiedByName: modifierName,
        participants: participantsToNotify.map((p: string) => diary.people[p].userId!),
        acknowledged: [],
        createdAt: new Date().toISOString()
      };
      
      await setDoc(doc(db, 'notifications', notification.id), notification);
    }
  }

  async deleteExpense(diaryId: string, expenseId: string, currentUserId: string): Promise<void> {
    const diaryRef = doc(db, 'diaries', diaryId);
    const diarySnap = await getDoc(diaryRef);
    
    if (!diarySnap.exists()) throw new Error('Diary not found');
    
    const diary = diarySnap.data() as Diary;
    const expense = diary.expenses.find(exp => exp.id === expenseId);
    
    if (!expense) throw new Error('Expense not found');

    const deletedExpense = {
      ...expense,
      deletedBy: currentUserId,
      deletedAt: new Date().toISOString()
    };

    const newExpenses = diary.expenses.filter(exp => exp.id !== expenseId);
    
    await updateDoc(diaryRef, this.clean({
      expenses: newExpenses,
      deletedExpenses: arrayUnion(deletedExpense),
      updatedAt: new Date().toISOString()
    }));

    const participantsToNotify = expense.participants
      .filter(p => {
        const person = diary.people[p];
        return person?.userId && person.userId !== currentUserId;
      });

    if (participantsToNotify.length > 0) {
      const notification: ModificationNotification = {
        id: `notif_${Date.now()}`,
        diaryId,
        diaryName: diary.name,
        expenseId: expenseId,
        expenseDescription: expense.description,
        type: 'deleted',
        modifiedBy: currentUserId,
        modifiedByName: diary.people[Object.keys(diary.people).find(id => diary.people[id].userId === currentUserId)!]?.name || 'Unknown',
        participants: participantsToNotify.map(p => diary.people[p].userId!),
        acknowledged: [],
        createdAt: new Date().toISOString()
      };
      
      await setDoc(doc(db, 'notifications', notification.id), notification);
    }
  }

  async restoreExpense(diaryId: string, expenseId: string): Promise<void> {
    const diaryRef = doc(db, 'diaries', diaryId);
    const diarySnap = await getDoc(diaryRef);
    
    if (!diarySnap.exists()) throw new Error('Diary not found');
    
    const diary = diarySnap.data() as Diary;
    const deletedExpense = diary.deletedExpenses?.find((exp: any) => exp.id === expenseId);
    
    if (!deletedExpense) throw new Error('Deleted expense not found');

    const { deletedBy, deletedAt, ...restoredExpense } = deletedExpense;
    
    const newDeletedExpenses = diary.deletedExpenses?.filter((exp: any) => exp.id !== expenseId) || [];
    
    await updateDoc(diaryRef, this.clean({
      expenses: arrayUnion(restoredExpense),
      deletedExpenses: newDeletedExpenses,
      updatedAt: new Date().toISOString()
    }));
  }

  async permanentlyDeleteExpense(diaryId: string, expenseId: string): Promise<void> {
    const diaryRef = doc(db, 'diaries', diaryId);
    const diarySnap = await getDoc(diaryRef);
    
    if (!diarySnap.exists()) throw new Error('Diary not found');
    
    const diary = diarySnap.data() as Diary;
    const newDeletedExpenses = diary.deletedExpenses?.filter((exp: any) => exp.id !== expenseId) || [];
    
    await updateDoc(diaryRef, this.clean({
      deletedExpenses: newDeletedExpenses,
      updatedAt: new Date().toISOString()
    }));
  }

  // ============= EVENT OPERATIONS =============

  async addEvent(diaryId: string, event: Event): Promise<void> {
    const diaryRef = doc(db, 'diaries', diaryId);
    await updateDoc(diaryRef, this.clean({
      events: arrayUnion(event),
      updatedAt: new Date().toISOString()
    }));
  }

  async deleteEvent(diaryId: string, eventId: string): Promise<void> {
    const diaryRef = doc(db, 'diaries', diaryId);
    const diarySnap = await getDoc(diaryRef);
    
    if (!diarySnap.exists()) throw new Error('Diary not found');
    
    const diary = diarySnap.data() as Diary;
    const newEvents = diary.events.filter(e => e.id !== eventId);
    
    const newExpenses = diary.expenses.map(exp => 
      exp.eventId === eventId ? { ...exp, eventId: 'general' } : exp
    );

    await updateDoc(diaryRef, this.clean({
      events: newEvents,
      expenses: newExpenses,
      updatedAt: new Date().toISOString()
    }));
  }

  async reorderEvents(diaryId: string, events: Event[]): Promise<void> {
    const diaryRef = doc(db, 'diaries', diaryId);
    await updateDoc(diaryRef, this.clean({
      events,
      updatedAt: new Date().toISOString()
    }));
  }

  // ============= SETTLEMENT OPERATIONS =============

  async markSettlementAsPaid(
    diaryId: string, 
    from: string, 
    to: string, 
    amount: number, 
    userId: string
  ): Promise<void> {
    const diaryRef = doc(db, 'diaries', diaryId);
    const diarySnap = await getDoc(diaryRef);
    
    if (!diarySnap.exists()) throw new Error('Diary not found');
    
    const diary = diarySnap.data() as Diary;
    
    const existingMarked = diary.settlements.find(
      s => s.from === from && s.to === to && s.status === 'marked_paid'
    );
    
    if (existingMarked) {
      const updatedSettlements = diary.settlements.map(s => 
        s.id === existingMarked.id 
          ? { 
              ...s, 
              amount: s.amount + amount, 
              markedPaidAt: new Date().toISOString() 
            }
          : s
      );
      
      await updateDoc(diaryRef, this.clean({
        settlements: updatedSettlements,
        updatedAt: new Date().toISOString()
      }));
    } else {
      const newSettlement: Settlement = {
        id: `settlement_${Date.now()}`,
        from,
        to,
        amount,
        date: new Date().toISOString(),
        status: 'marked_paid',
        markedPaidBy: userId,
        markedPaidAt: new Date().toISOString()
      };
      
      await updateDoc(diaryRef, this.clean({
        settlements: arrayUnion(newSettlement),
        updatedAt: new Date().toISOString()
      }));
    }
  }

  async confirmSettlement(diaryId: string, settlementId: string): Promise<void> {
    const diaryRef = doc(db, 'diaries', diaryId);
    const diarySnap = await getDoc(diaryRef);
    
    if (!diarySnap.exists()) throw new Error('Diary not found');
    
    const diary = diarySnap.data() as Diary;
    const settlements = diary.settlements.map(s => 
      s.id === settlementId ? { ...s, status: 'confirmed' as const } : s
    );
    
    await updateDoc(diaryRef, this.clean({
      settlements,
      updatedAt: new Date().toISOString()
    }));
  }

  async addSettlement(diaryId: string, settlement: Settlement): Promise<void> {
    const diaryRef = doc(db, 'diaries', diaryId);
    const settlementWithStatus: Settlement = {
      ...settlement,
      status: 'confirmed'
    };
    
    await updateDoc(diaryRef, this.clean({
      settlements: arrayUnion(settlementWithStatus),
      updatedAt: new Date().toISOString()
    }));
  }

  // ============= INVITATION OPERATIONS =============

  async createInvitation(invitation: Invitation): Promise<void> {
    const invitationRef = doc(db, 'invitations', invitation.id);
    await setDoc(invitationRef, invitation);
  }

  async loadInvitations(userEmail: string): Promise<Invitation[]> {
    const normalizedEmail = userEmail.toLowerCase();
    const emailQuery = query(
      collection(db, 'invitations'),
      where('personId', '==', normalizedEmail)
    );
    
    const emailSnapshot = await getDocs(emailQuery);
    const invitations = emailSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Invitation[];

    cacheService.setInvitations(invitations);
    return invitations;
  }

  subscribeToInvitations(userEmail: string, callback: (invitations: Invitation[]) => void): () => void {
  const normalizedEmail = userEmail.toLowerCase();
  const invitationsQuery = query(
    collection(db, 'invitations'),
    where('personEmail', '==', normalizedEmail)  // ✅ FIXED: Changed from 'personId' to 'personEmail'
  );

  return onSnapshot(invitationsQuery, (snapshot) => {
    console.log('📧 Invitation snapshot received:', snapshot.docs.length);
    const invitations = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Invitation[];
    
    console.log('📧 Invitations:', invitations);
    callback(invitations);
    cacheService.setInvitations(invitations);
  });
}
  async acceptInvitation(invitation: Invitation, userId: string, userEmail: string): Promise<void> {
    const diaryRef = doc(db, 'diaries', invitation.diaryId);
    const diarySnap = await getDoc(diaryRef);
    
    if (!diarySnap.exists()) throw new Error('Diary not found');
    
    const diary = diarySnap.data() as Diary;

    
    // Find person by email (personId in invitation stores email for querying)
    const personEntry = Object.entries(diary.people).find(
      ([_, p]) => p.email && p.email.toLowerCase() === invitation.personEmail.toLowerCase()
    );
    
    if (!personEntry) {
      throw new Error('Person not found in diary. The invitation may be outdated.');
    }

    const [actualPersonId, person] = personEntry;

    // Update person status and link to user
    await updateDoc(diaryRef, this.clean({
      [`people.${actualPersonId}.status`]: 'accepted',
      [`people.${actualPersonId}.userId`]: userId,
      members: arrayUnion(userId),
      updatedAt: new Date().toISOString()
    }));

    // Update invitation status
    await updateDoc(doc(db, 'invitations', invitation.id), {
      status: 'accepted'
    });
  }

  // ============= NOTIFICATION OPERATIONS =============

  subscribeToModifications(userId: string, callback: (notifications: ModificationNotification[]) => void): () => void {
    const notificationsQuery = query(
      collection(db, 'notifications'),
      where('participants', 'array-contains', userId)
    );

    return onSnapshot(notificationsQuery, (snapshot) => {
      const notifications = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as ModificationNotification[];
      
      const unacknowledged = notifications.filter(
        n => !n.acknowledged.includes(userId)
      );
      
      callback(unacknowledged);
    });
  }

  async acknowledgeModification(notificationId: string, userId: string): Promise<void> {
    const notificationRef = doc(db, 'notifications', notificationId);
    await updateDoc(notificationRef, {
      acknowledged: arrayUnion(userId)
    });
  }

  async linkGuestToUser(diaryId: string, email: string, userId: string): Promise<void> {
    const diaryRef = doc(db, 'diaries', diaryId);
    const diarySnap = await getDoc(diaryRef);
    
    if (!diarySnap.exists()) throw new Error('Diary not found');
    
    const diary = this.normalizeDiary(diarySnap.data());
    
    // Find guest by email
    const guestEntry = Object.entries(diary.people).find(
      ([_, person]: [string, Person]) =>
        person.email?.toLowerCase() === email.toLowerCase() && !person.userId
    );
    
    if (guestEntry) {
      const [personId, person] = guestEntry as [string, Person];
      
      // Update guest to accepted user
      await updateDoc(diaryRef, this.clean({
        [`people.${personId}.userId`]: userId,
        [`people.${personId}.status`]: 'accepted',
        members: arrayUnion(userId),
        updatedAt: new Date().toISOString()
      }));
      
      console.log('✅ Linked guest to user:', email);
    }
  }

  private normalizeDiary(data: any): Diary {
    return {
      ...data,
      expenses: Array.isArray(data.expenses) ? data.expenses.filter((e: any) => e) : [],
      deletedExpenses: Array.isArray(data.deletedExpenses) ? data.deletedExpenses.filter((e: any) => e) : [],
      settlements: Array.isArray(data.settlements) ? data.settlements.filter((s: any) => s) : [],
      events: Array.isArray(data.events) ? data.events.filter((e: any) => e) : [],
      members: Array.isArray(data.members) ? data.members.filter((m: any) => m) : [],
    } as Diary;
  }
}

export const firebaseService = new FirebaseService();