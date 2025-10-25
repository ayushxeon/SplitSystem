import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  arrayUnion,
  arrayRemove,
  deleteField,  // ✅ ADD THIS
} from 'firebase/firestore';
import { db } from "../firebase/firebase";
import { cacheService } from "./storage";
import type {
  Diary,
  Invitation,
  Person,
  Expense,
  Event,
  Settlement,
  ModificationNotification,
  JoinRequest
} from "../types/types";

class FirebaseService {
  // ============= HELPER METHOD =============

  /**
   * Remove undefined values from object to prevent Firestore errors
   */
  private clean<T extends Record<string, any>>(obj: T): Partial<T> {
    const cleaned: any = {};
    Object.keys(obj).forEach((key) => {
      if (obj[key] !== undefined) {
        cleaned[key] = obj[key];
      }
    });
    return cleaned;
  }

  // ============= DIARY OPERATIONS =============

  async createDiary(
    diary: Diary,
    creator: { uid: string; email: string; displayName: string }
  ): Promise<void> {
    const diaryRef = doc(db, "diaries", diary.id);

    const creatorPerson: Person = {
      id: creator.uid,
      name: creator.displayName,
      email: creator.email.toLowerCase(),
      userId: creator.uid,
      status: "accepted",
      invitedBy: creator.uid,
      invitedAt: new Date().toISOString(),
    };

    const diaryWithCreator = {
      ...diary,
      people: { [creator.uid]: creatorPerson },
    };

    await setDoc(diaryRef, diaryWithCreator);
    cacheService.addDiary(diaryWithCreator);
  }

  async syncDiaries(userId: string): Promise<Diary[]> {
    const diariesQuery = query(
      collection(db, "diaries"),
      where("members", "array-contains", userId)
    );

    const snapshot = await getDocs(diariesQuery);
    const diaries = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Diary[];

    cacheService.setDiaries(diaries);
    cacheService.setLastSyncTime(Date.now());
    return diaries;
  }

  subscribeToUserDiaries(
    userId: string,
    callback: (diaries: Diary[]) => void
  ): () => void {
    const diariesQuery = query(
      collection(db, "diaries"),
      where("members", "array-contains", userId)
    );

    const unsubscribe = onSnapshot(
      diariesQuery,
      (snapshot) => {
        const diaries = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Diary[];

        callback(diaries);
        cacheService.setDiaries(diaries);
        cacheService.setLastSyncTime(Date.now());
      },
      (error) => {
        console.error("Error in diaries subscription:", error);
      }
    );

    return unsubscribe;
  }

 /**
 * Remove a person from diary completely
 */
async removePerson(diaryId: string, personId: string): Promise<void> {
  const diaryRef = doc(db, 'diaries', diaryId);
  const diarySnap = await getDoc(diaryRef);

  if (!diarySnap.exists()) {
    throw new Error('Diary not found');
  }

  const diary = diarySnap.data() as Diary;
  const person = diary.people[personId];

  if (!person) {
    throw new Error('Person not found');
  }

  // Remove from members if they were a member
  const updates: any = {
    [`people.${personId}`]: deleteField(),
    updatedAt: new Date().toISOString(),
  };

  if (person.userId && diary.members.includes(person.userId)) {
    updates.members = arrayRemove(person.userId);
  }

  await updateDoc(diaryRef, updates);
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
    const userRef = doc(db, "users", userData.uid);
    const normalizedEmail = userData.email.toLowerCase();

    // Check if user already exists
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      // User exists, just update lastLogin
      await updateDoc(userRef, {
        lastLogin: new Date().toISOString(),
      });
    } else {
      // New user, create document
      await setDoc(userRef, {
        uid: userData.uid,
        email: normalizedEmail,
        displayName: userData.displayName,
        photoURL: userData.photoURL,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
      });
      console.log("✅ New user registered:", normalizedEmail);
    }


  }

  // ============= PERSON OPERATIONS =============

  async checkUserExists(email: string): Promise<string | null> {
    const normalizedEmail = email.toLowerCase();
    const usersQuery = query(
      collection(db, "users"),
      where("email", "==", normalizedEmail)
    );
    const snapshot = await getDocs(usersQuery);
    return snapshot.empty ? null : snapshot.docs[0].id;
  }

  async addPersonToDiary(diaryId: string, person: Person): Promise<void> {
    const diaryRef = doc(db, "diaries", diaryId);
    const diarySnap = await getDoc(diaryRef);

    if (!diarySnap.exists()) throw new Error("Diary not found");

    const diary = diarySnap.data() as Diary;

    // Normalize email if present
    const normalizedPerson = person.email
      ? { ...person, email: person.email.toLowerCase() }
      : person;

    // ✅ FIX 1: CHECK if this person has a pending join request, auto-approve it
    const pendingRequest = diary.joinRequests?.find(
      (r) => r.userEmail.toLowerCase() === normalizedPerson.email?.toLowerCase() && r.status === 'pending'
    );

    // ✅ CRITICAL FIX: If auto-approving, set status to "accepted" and use their userId
    let finalPerson = normalizedPerson;
    if (pendingRequest) {
      finalPerson = {
        ...normalizedPerson,
        userId: pendingRequest.userId,  // Use the userId from the request
        status: 'accepted',  // ✅ SET TO ACCEPTED, NOT PENDING!
      };
    }

    const updates: any = {
      [`people.${person.id}`]: finalPerson,
      updatedAt: new Date().toISOString(),
    };

    // ✅ If there's a pending request, remove it and add them as member
    if (pendingRequest) {
      const updatedRequests = (diary.joinRequests || []).filter(
        (r) => r.id !== pendingRequest.id
      );
      updates.joinRequests = updatedRequests;
      updates.members = arrayUnion(pendingRequest.userId);
      
      console.log("✅ Auto-approved pending join request for:", person.email);
    }

    await updateDoc(diaryRef, this.clean(updates));

    // Create invitation if person has email (for both guests and registered users)
    // BUT skip if we just auto-approved their request (they're already being added)
    if (person.email && !pendingRequest) {
      const invitationId = `${diaryId}_${person.id}_${Date.now()}`;
      const invitation: Invitation = {
        id: invitationId,
        diaryId: diary.id,
        diaryName: diary.name,
        personId: person.id, // ✅ FIXED: person ID (for backward compatibility)
        personEmail: person.email.toLowerCase(), // ✅ FIXED: Added personEmail field
        personName: person.name,
        invitedBy: person.invitedBy,
        invitedByName: diary.people[person.invitedBy]?.name || "Unknown",
        status: "pending",
        createdAt: new Date().toISOString(),
      };

      console.log("📧 Creating invitation for:", person.email);
      await this.createInvitation(invitation);
    }
  }

  async updatePerson(
    diaryId: string,
    personId: string,
    updates: Partial<Person>
  ): Promise<void> {
    const diaryRef = doc(db, "diaries", diaryId);
    const diarySnap = await getDoc(diaryRef);

    if (!diarySnap.exists()) throw new Error("Diary not found");

    const diary = diarySnap.data() as Diary;
    const person = diary.people[personId];

    if (!person) throw new Error("Person not found");

    await updateDoc(
      diaryRef,
      this.clean({
        [`people.${personId}`]: { ...person, ...updates },
        updatedAt: new Date().toISOString(),
      })
    );
  }

  async deletePerson(diaryId: string, personId: string): Promise<void> {
    const diaryRef = doc(db, "diaries", diaryId);
    const diarySnap = await getDoc(diaryRef);

    if (!diarySnap.exists()) throw new Error("Diary not found");

    const diary = diarySnap.data() as Diary;

    const hasTransactions = diary.expenses.some(
      (exp) => exp.paidBy === personId || exp.participants.includes(personId)
    );

    if (hasTransactions) {
      throw new Error("Cannot delete person with transactions");
    }

    const newPeople = { ...diary.people };
    delete newPeople[personId];

    await updateDoc(
      diaryRef,
      this.clean({
        people: newPeople,
        updatedAt: new Date().toISOString(),
      })
    );
  }

  // ============= EXPENSE OPERATIONS =============

  async addExpense(diaryId: string, expense: Expense): Promise<void> {
    const diaryRef = doc(db, "diaries", diaryId);
    const diarySnap = await getDoc(diaryRef);

    if (!diarySnap.exists()) throw new Error("Diary not found");

    const diary = diarySnap.data() as Diary;

    // Clean the expense object before saving
    const cleanExpense = this.clean(expense);

    await updateDoc(
      diaryRef,
      this.clean({
        expenses: arrayUnion(cleanExpense),
        updatedAt: new Date().toISOString(),
      })
    );

    const participantsToNotify = expense.participants.filter((p) => {
      const person = diary.people[p];
      return person?.userId && person.userId !== expense.createdBy;
    });

    if (participantsToNotify.length > 0) {
      const notification: ModificationNotification = {
        id: `notif_${Date.now()}`,
        diaryId,
        diaryName: diary.name,
        expenseId: expense.id,
        expenseName: expense.description,
        type: "created",
        modifiedBy: expense.createdBy,
        modifiedByName:
          diary.people[
            Object.keys(diary.people).find(
              (id) => diary.people[id].userId === expense.createdBy
            )!
          ]?.name || "Unknown",
        timestamp: new Date().toISOString(), // ← ADD THIS LINE HERE
        participants: participantsToNotify.map((p) => diary.people[p].userId!),
        acknowledged: [],
        createdAt: new Date().toISOString(),
      };

      await setDoc(doc(db, "notifications", notification.id), notification);
    }
  }

  async updateExpense(
    diaryId: string,
    expenseId: string,
    updates: Partial<Expense>,
    userId: string
  ): Promise<void> {
    const diaryRef = doc(db, "diaries", diaryId);
    const diarySnap = await getDoc(diaryRef);

    if (!diarySnap.exists()) throw new Error("Diary not found");

    const diary = diarySnap.data() as Diary;
    const expenseIndex = diary.expenses.findIndex(
      (exp) => exp.id === expenseId
    );

    if (expenseIndex === -1) throw new Error("Expense not found");

    const oldExpense = diary.expenses[expenseIndex];

    // Find modifier's name
    const modifierName =
      diary.people[
        Object.keys(diary.people).find(
          (id) => diary.people[id].userId === userId
        )!
      ]?.name || "Unknown";

    const updatedExpense = this.clean({
      ...oldExpense,
      ...updates,
      modifiedBy: userId,
      modifiedByName: modifierName,
      modifiedAt: new Date().toISOString(),
      currentVersion: (oldExpense.currentVersion || 1) + 1,
      versions: [
        ...(oldExpense.versions || []),
        {
          versionNumber: oldExpense.currentVersion || 1,
          timestamp: new Date().toISOString(),
          modifiedBy: userId,
          modifiedByName: modifierName,
          data: {
            description: oldExpense.description,
            amount: oldExpense.amount,
            paidBy: oldExpense.paidBy,
            eventId: oldExpense.eventId,
            splitMode: oldExpense.splitMode,
            splits: oldExpense.splits,
            participants: oldExpense.participants,
          },
        },
      ],
    });

    const newExpenses = [...diary.expenses];
    newExpenses[expenseIndex] = updatedExpense as Expense;

    await updateDoc(
      diaryRef,
      this.clean({
        expenses: newExpenses,
        updatedAt: new Date().toISOString(),
      })
    );

    // ✅ FIX 3: Notify BOTH current participants AND removed participants
    const oldParticipants = oldExpense.participants || [];
    const newParticipants = updatedExpense.participants || [];
    
    // People who are still in the expense (current participants)
    const currentParticipantsToNotify = newParticipants.filter(
      (p: string) => {
        const person = diary.people[p];
        return person?.userId && person.userId !== userId;
      }
    );

    // ✅ People who were REMOVED from the expense (they need to know!)
    const removedParticipants = oldParticipants.filter(
      (p: string) => !newParticipants.includes(p)
    ).filter((p: string) => {
      const person = diary.people[p];
      return person?.userId && person.userId !== userId;
    });

    // Combine both groups for notification
    const allParticipantsToNotify = [
      ...new Set([...currentParticipantsToNotify, ...removedParticipants])
    ];

    if (allParticipantsToNotify.length > 0) {
      const notification: ModificationNotification = {
        id: `notif_${Date.now()}`,
        diaryId,
        diaryName: diary.name,
        expenseId: expenseId,
        expenseName: updatedExpense.description || "Unknown",
        type: "modified",
        modifiedBy: userId,
        modifiedByName: modifierName,
        timestamp: new Date().toISOString(),
        participants: allParticipantsToNotify.map(
          (p: string) => diary.people[p].userId!
        ),
        acknowledged: [],
        createdAt: new Date().toISOString(),
      };

      await setDoc(doc(db, "notifications", notification.id), notification);
    }
  }

  async deleteExpense(
    diaryId: string,
    expenseId: string,
    userId: string
  ): Promise<void> {
    const diaryRef = doc(db, "diaries", diaryId);
    const diarySnap = await getDoc(diaryRef);

    if (!diarySnap.exists()) throw new Error("Diary not found");

    const diary = diarySnap.data() as Diary;
    const expense = diary.expenses.find((exp) => exp.id === expenseId);

    if (!expense) throw new Error("Expense not found");

    // ✅ ENHANCEMENT: Store a snapshot of people involved in this expense
    // This allows proper restoration even if people leave the diary later
    const involvedPeople: Record<string, Person> = {};
    const allInvolvedPeople = [expense.paidBy, ...expense.participants];
    
    for (const personId of allInvolvedPeople) {
      if (diary.people[personId]) {
        involvedPeople[personId] = diary.people[personId];
      }
    }

    const deletedExpense = {
      ...expense,
      deletedBy: userId,
      deletedAt: new Date().toISOString(),
      peopleSnapshot: involvedPeople, // ✅ Store people data for restoration
    };

    const newExpenses = diary.expenses.filter((exp) => exp.id !== expenseId);

    await updateDoc(
      diaryRef,
      this.clean({
        expenses: newExpenses,
        deletedExpenses: arrayUnion(deletedExpense),
        updatedAt: new Date().toISOString(),
      })
    );

    const participantsToNotify = expense.participants.filter((p) => {
      const person = diary.people[p];
      return person?.userId && person.userId !== userId;
    });

    if (participantsToNotify.length > 0) {
      const notification: ModificationNotification = {
        id: `notif_${Date.now()}`,
        diaryId,
        diaryName: diary.name,
        expenseId: expenseId,
        expenseName: expense.description,
        type: "deleted",
        modifiedBy: userId,
        modifiedByName:
          diary.people[
            Object.keys(diary.people).find(
              (id) => diary.people[id].userId === userId
            )!
          ]?.name || "Unknown",
        timestamp: new Date().toISOString(),
        participants: participantsToNotify.map((p) => diary.people[p].userId!),
        acknowledged: [],
        createdAt: new Date().toISOString(),
      };

      await setDoc(doc(db, "notifications", notification.id), notification);
    }
  }

  async restoreExpense(diaryId: string, expenseId: string): Promise<void> {
    const diaryRef = doc(db, "diaries", diaryId);
    const diarySnap = await getDoc(diaryRef);

    if (!diarySnap.exists()) throw new Error("Diary not found");

    const diary = diarySnap.data() as Diary;
    const deletedExpense = diary.deletedExpenses?.find(
      (exp: any) => exp.id === expenseId
    );

    if (!deletedExpense) throw new Error("Deleted expense not found");

    // ✅ FIX: Check if all people involved in the expense still exist in the diary
    const allInvolvedPeople = [
      deletedExpense.paidBy,
      ...deletedExpense.participants
    ];
    
    const missingPeople: string[] = [];
    const peopleToReAdd: Record<string, Person> = {};

    for (const personId of allInvolvedPeople) {
      if (!diary.people[personId]) {
        missingPeople.push(personId);
        
        // ✅ Use the stored peopleSnapshot if available
        if (deletedExpense.peopleSnapshot && deletedExpense.peopleSnapshot[personId]) {
          const originalPerson = deletedExpense.peopleSnapshot[personId];
          peopleToReAdd[personId] = {
            ...originalPerson,
            status: 'pending', // ✅ Re-add as pending, not accepted
            invitedBy: diary.createdBy,
            invitedAt: new Date().toISOString(),
          };
        } else {
          // Fallback: create minimal person entry
          peopleToReAdd[personId] = {
            id: personId,
            name: `Person ${personId.slice(-6)}`, // Use last 6 chars of ID as placeholder
            status: 'pending',
            invitedBy: diary.createdBy,
            invitedAt: new Date().toISOString(),
          } as Person; // ✅ Type assertion since email and userId are optional
        }
      }
    }

    // ✅ If there are missing people, re-add them to the diary
    const updates: any = {
      expenses: arrayUnion(deletedExpense),
      deletedExpenses: diary.deletedExpenses?.filter((exp: any) => exp.id !== expenseId) || [],
      updatedAt: new Date().toISOString(),
    };

    // Re-add missing people as pending
    if (missingPeople.length > 0) {
      for (const personId of missingPeople) {
        updates[`people.${personId}`] = peopleToReAdd[personId];
      }
      
      console.log(`✅ Re-added ${missingPeople.length} missing person(s) as 'pending' during expense restoration`);
    }

    await updateDoc(diaryRef, this.clean(updates));
  }

  async permanentlyDeleteExpense(
    diaryId: string,
    expenseId: string
  ): Promise<void> {
    const diaryRef = doc(db, "diaries", diaryId);
    const diarySnap = await getDoc(diaryRef);

    if (!diarySnap.exists()) throw new Error("Diary not found");

    const diary = diarySnap.data() as Diary;
    const newDeletedExpenses =
      diary.deletedExpenses?.filter((exp: any) => exp.id !== expenseId) || [];

    await updateDoc(
      diaryRef,
      this.clean({
        deletedExpenses: newDeletedExpenses,
        updatedAt: new Date().toISOString(),
      })
    );
  }

  // ============= EVENT OPERATIONS =============

  async addEvent(diaryId: string, event: Event): Promise<void> {
    const diaryRef = doc(db, "diaries", diaryId);
    await updateDoc(
      diaryRef,
      this.clean({
        events: arrayUnion(event),
        updatedAt: new Date().toISOString(),
      })
    );
  }

  async deleteEvent(diaryId: string, eventId: string): Promise<void> {
    const diaryRef = doc(db, "diaries", diaryId);
    const diarySnap = await getDoc(diaryRef);

    if (!diarySnap.exists()) throw new Error("Diary not found");

    const diary = diarySnap.data() as Diary;
    const newEvents = diary.events.filter((e) => e.id !== eventId);

    const newExpenses = diary.expenses.map((exp) =>
      exp.eventId === eventId ? { ...exp, eventId: "general" } : exp
    );

    await updateDoc(
      diaryRef,
      this.clean({
        events: newEvents,
        expenses: newExpenses,
        updatedAt: new Date().toISOString(),
      })
    );
  }

  async reorderEvents(diaryId: string, events: Event[]): Promise<void> {
    const diaryRef = doc(db, "diaries", diaryId);
    await updateDoc(
      diaryRef,
      this.clean({
        events,
        updatedAt: new Date().toISOString(),
      })
    );
  }

  // ============= SETTLEMENT OPERATIONS =============

  async markSettlementAsPaid(
    diaryId: string,
    from: string,
    to: string,
    amount: number,
    userId: string
  ): Promise<void> {
    const diaryRef = doc(db, "diaries", diaryId);
    const diarySnap = await getDoc(diaryRef);

    if (!diarySnap.exists()) throw new Error("Diary not found");

    const diary = diarySnap.data() as Diary;

    const existingMarked = diary.settlements.find(
      (s) => s.from === from && s.to === to && s.status === "marked_paid"
    );

    if (existingMarked) {
      const updatedSettlements = diary.settlements.map((s) =>
        s.id === existingMarked.id
          ? {
              ...s,
              amount: s.amount + amount,
              markedPaidAt: new Date().toISOString(),
            }
          : s
      );

      await updateDoc(
        diaryRef,
        this.clean({
          settlements: updatedSettlements,
          updatedAt: new Date().toISOString(),
        })
      );
    } else {
      const newSettlement: Settlement = {
        id: `settlement_${Date.now()}`,
        from,
        to,
        amount,
        date: new Date().toISOString(),
        status: "marked_paid",
        markedPaidBy: userId,
        markedPaidAt: new Date().toISOString(),
      };

      await updateDoc(
        diaryRef,
        this.clean({
          settlements: arrayUnion(newSettlement),
          updatedAt: new Date().toISOString(),
        })
      );
    }
  }

  async confirmSettlement(
    diaryId: string,
    settlementId: string
  ): Promise<void> {
    const diaryRef = doc(db, "diaries", diaryId);
    const diarySnap = await getDoc(diaryRef);

    if (!diarySnap.exists()) throw new Error("Diary not found");

    const diary = diarySnap.data() as Diary;
    const settlements = diary.settlements.map((s) =>
      s.id === settlementId ? { ...s, status: "confirmed" as const } : s
    );

    await updateDoc(
      diaryRef,
      this.clean({
        settlements,
        updatedAt: new Date().toISOString(),
      })
    );
  }

  async addSettlement(diaryId: string, settlement: Settlement): Promise<void> {
    const diaryRef = doc(db, "diaries", diaryId);
    const settlementWithStatus: Settlement = {
      ...settlement,
      status: "confirmed",
    };

    await updateDoc(
      diaryRef,
      this.clean({
        settlements: arrayUnion(settlementWithStatus),
        updatedAt: new Date().toISOString(),
      })
    );
  }

  // ============= INVITATION OPERATIONS =============

  async createInvitation(invitation: Invitation): Promise<void> {
    const invitationRef = doc(db, "invitations", invitation.id);
    await setDoc(invitationRef, invitation);
  }

async loadInvitations(userEmail: string): Promise<Invitation[]> {
  const normalizedEmail = userEmail.toLowerCase();
  const emailQuery = query(
    collection(db, 'invitations'),
    where('personEmail', '==', normalizedEmail)  // ✅ CORRECT FIELD
  );

    const emailSnapshot = await getDocs(emailQuery);
    const invitations = emailSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Invitation[];

    cacheService.setInvitations(invitations);
    return invitations;
  }

  subscribeToInvitations(
    userEmail: string,
    callback: (invitations: Invitation[]) => void
  ): () => void {
    const normalizedEmail = userEmail.toLowerCase();
    const invitationsQuery = query(
      collection(db, "invitations"),
      where("personEmail", "==", normalizedEmail) // ✅ FIXED: Changed from 'personId' to 'personEmail'
    );

    return onSnapshot(invitationsQuery, (snapshot) => {
      console.log("📧 Invitation snapshot received:", snapshot.docs.length);
      const invitations = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Invitation[];

      console.log("📧 Invitations:", invitations);
      callback(invitations);
      cacheService.setInvitations(invitations);
    });
  }
  async acceptInvitation(
    invitation: Invitation,
    userId: string
  ): Promise<void> {
    const diaryRef = doc(db, "diaries", invitation.diaryId);
    const diarySnap = await getDoc(diaryRef);

    if (!diarySnap.exists()) throw new Error("Diary not found");

    const diary = diarySnap.data() as Diary;

    // Find person by email (personId in invitation stores email for querying)
    const personEntry = Object.entries(diary.people).find(
      ([_, p]) =>
        p.email &&
        p.email.toLowerCase() === invitation.personEmail.toLowerCase()
    );

    if (!personEntry) {
      throw new Error(
        "Person not found in diary. The invitation may be outdated."
      );
    }

    const [actualPersonId, _person] = personEntry;

    // Update person status and link to user
    await updateDoc(
      diaryRef,
      this.clean({
        [`people.${actualPersonId}.status`]: "accepted",
        [`people.${actualPersonId}.userId`]: userId,
        members: arrayUnion(userId),
        updatedAt: new Date().toISOString(),
      })
    );

    // Update invitation status
    await updateDoc(doc(db, "invitations", invitation.id), {
      status: "accepted",
    });
  }

  /**
   * ✅ NEW: Validate if invitation is still valid (diary exists)
   */
  async validateInvitation(diaryId: string): Promise<boolean> {
    try {
      const diaryRef = doc(db, "diaries", diaryId);
      const diarySnap = await getDoc(diaryRef);
      return diarySnap.exists();
    } catch (error) {
      return false;
    }
  }

  /**
   * ✅ NEW: Reject an invitation - marks person as "rejected" in diary
   */
  async rejectInvitation(
    invitationId: string,
    diaryId: string,
    personId: string
  ): Promise<void> {
    const diaryRef = doc(db, "diaries", diaryId);
    const diarySnap = await getDoc(diaryRef);

    if (diarySnap.exists()) {
      // Update person status to "rejected" in the diary
      await updateDoc(
        diaryRef,
        this.clean({
          [`people.${personId}.status`]: "rejected",
          updatedAt: new Date().toISOString(),
        })
      );
    }

    // Mark invitation as rejected
    const invitationRef = doc(db, "invitations", invitationId);
    await updateDoc(invitationRef, {
      status: "rejected",
    });
  }

  /**
   * ✅ NEW: Dismiss an invalid invitation (delete it)
   */
  async dismissInvitation(invitationId: string): Promise<void> {
    const invitationRef = doc(db, "invitations", invitationId);
    await deleteDoc(invitationRef);
  }

  /**
 * Request to join a diary (when user clicks invite link but isn't added)
 */
async requestToJoin(
  diaryId: string,
  user: { uid: string; email: string; displayName: string }
): Promise<void> {
  const diaryRef = doc(db, 'diaries', diaryId);
  const diarySnap = await getDoc(diaryRef);

  if (!diarySnap.exists()) throw new Error('Diary not found');

  const diary = diarySnap.data() as Diary;

  // Check if already a member
  if (diary.members.includes(user.uid)) {
    throw new Error('You are already a member of this diary');
  }

  // ✅ FIX: Check if user was already invited as guest
  const guestEntry = Object.entries(diary.people).find(
    ([_, person]) =>
      person.email?.toLowerCase() === user.email.toLowerCase() &&
      person.status === 'unregistered'
  );

  if (guestEntry) {
    // User was invited! Auto-create invitation instead of join request
    const [personId] = guestEntry;
    
    await this.createInvitationForGuest(
      diaryId,
      personId,
      user.email,
      diary.name
    );
    
    throw new Error('REDIRECT_TO_INVITATIONS'); // Special error to trigger redirect
  }

  // Check if already requested
  const existingRequest = diary.joinRequests?.find(
    (r) => r.userId === user.uid && r.status === 'pending'
  );

  if (existingRequest) {
    throw new Error('You have already requested to join this diary');
  }

  // Create join request
  const joinRequest: JoinRequest = {
    id: `req_${Date.now()}`,
    userId: user.uid,
    userName: user.displayName,
    userEmail: user.email.toLowerCase(),
    requestedAt: new Date().toISOString(),
    status: 'pending',
  };

  await updateDoc(diaryRef, {
    joinRequests: arrayUnion(joinRequest),
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Approve join request
 */
async approveJoinRequest(
  diaryId: string,
  requestId: string,
  approverId: string
): Promise<void> {
  const diaryRef = doc(db, 'diaries', diaryId);
  const diarySnap = await getDoc(diaryRef);

  if (!diarySnap.exists()) throw new Error('Diary not found');

  const diary = diarySnap.data() as Diary;

  if (!diary.members.includes(approverId)) {
    throw new Error('You are not authorized to approve requests');
  }

  const request = diary.joinRequests?.find((r) => r.id === requestId);
  if (!request) throw new Error('Request not found');

  // Create person entry
  const personId = request.userId;
  const newPerson: Person = {
    id: personId,
    name: request.userName,
    email: request.userEmail,
    userId: request.userId,
    status: 'accepted',
    invitedBy: approverId,
    invitedAt: new Date().toISOString(),
  };

  // ✅ FIX: REMOVE the request entirely instead of marking as approved
  const updatedRequests = (diary.joinRequests || []).filter(
    (r) => r.id !== requestId
  );

  await updateDoc(diaryRef, {
    [`people.${personId}`]: newPerson,
    members: arrayUnion(request.userId),
    joinRequests: updatedRequests,  // ✅ Removes the request
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Reject join request
 */
async rejectJoinRequest(diaryId: string, requestId: string): Promise<void> {
  const diaryRef = doc(db, 'diaries', diaryId);
  const diarySnap = await getDoc(diaryRef);

  if (!diarySnap.exists()) throw new Error('Diary not found');

  const diary = diarySnap.data() as Diary;

  // ✅ FIX: REMOVE the request entirely
  const updatedRequests = (diary.joinRequests || []).filter(
    (r) => r.id !== requestId
  );

  await updateDoc(diaryRef, {
    joinRequests: updatedRequests,
    updatedAt: new Date().toISOString(),
  });
}
  // ============= NOTIFICATION OPERATIONS =============

  subscribeToModifications(
    userId: string,
    callback: (notifications: ModificationNotification[]) => void
  ): () => void {
    const notificationsQuery = query(
      collection(db, "notifications"),
      where("participants", "array-contains", userId)
    );

    return onSnapshot(notificationsQuery, (snapshot) => {
      const notifications = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as ModificationNotification[];

      const unacknowledged = notifications.filter(
        (n) => !n.acknowledged.includes(userId)
      );

      callback(unacknowledged);
    });
  }

  async acknowledgeModification(
    notificationId: string,
    userId: string
  ): Promise<void> {
    const notificationRef = doc(db, "notifications", notificationId);
    await updateDoc(notificationRef, {
      acknowledged: arrayUnion(userId),
    });
  }

  async linkGuestToUser(
    diaryId: string,
    email: string,
    userId: string
  ): Promise<void> {
    const diaryRef = doc(db, "diaries", diaryId);
    const diarySnap = await getDoc(diaryRef);

    if (!diarySnap.exists()) throw new Error("Diary not found");

    const diary = this.normalizeDiary(diarySnap.data());

    // Find guest by email
    const guestEntry = Object.entries(diary.people).find(
      ([_, person]: [string, Person]) =>
        person.email?.toLowerCase() === email.toLowerCase() && !person.userId
    );

    if (guestEntry) {
      const [personId, person] = guestEntry as [string, Person];

      // Update guest to accepted user
      await updateDoc(
        diaryRef,
        this.clean({
          [`people.${personId}.userId`]: userId,
          [`people.${personId}.status`]: "accepted",
          members: arrayUnion(userId),
          updatedAt: new Date().toISOString(),
        })
      );

      console.log("✅ Linked guest to user:", email);
    }
  }

  /**
 * Leave a diary (removes user from members and people)
 */
async leaveDiary(diaryId: string, userId: string): Promise<void> {
  const diaryRef = doc(db, 'diaries', diaryId);
  const diarySnap = await getDoc(diaryRef);

  if (!diarySnap.exists()) {
    throw new Error('Diary not found');
  }

  const diary = diarySnap.data() as Diary;

  if (!diary.members.includes(userId)) {
    throw new Error('You are not a member of this diary');
  }

  // Find user's person entry
  const personEntry = Object.entries(diary.people).find(
    ([_, person]) => person.userId === userId
  );

  if (!personEntry) {
    throw new Error('User not found in diary');
  }

  const [personId] = personEntry;

  // ✅ FIX 2: ONLY check ACTIVE expenses (ignore deleted expenses - they can be permanently deleted)
  const hasActiveExpenses = diary.expenses.some(
    (exp) => exp.paidBy === personId || exp.participants.includes(personId)
  );

  // ✅ Check pending settlements (only "pending" status matters)
  const hasPendingSettlements = diary.settlements?.some(
    (settlement) => 
      settlement.status === 'pending' && 
      (settlement.from === personId || settlement.to === personId)
  );

  if (hasActiveExpenses || hasPendingSettlements) {
    throw new Error('Cannot leave diary - you have active expenses or pending settlements. Please settle all transactions first.');
  }

  // Remove from both members and people
  const updates: any = {
    members: arrayRemove(userId),
    updatedAt: new Date().toISOString(),
  };

  // Use deleteField to remove person entry
  updates[`people.${personId}`] = deleteField();

  await updateDoc(diaryRef, updates);
  cacheService.removeDiary(diaryId);
}

  /**
 * Create invitation for guest user who signs in via invite link
 */
async createInvitationForGuest(
  diaryId: string,
  personId: string,
  userEmail: string,
  diaryName: string
): Promise<void> {
  // Load diary first to get person info
  const diaryDoc = await getDoc(doc(db, 'diaries', diaryId));
  
  if (!diaryDoc.exists()) {
    throw new Error('Diary not found');
  }
  
  const diary = diaryDoc.data() as Diary;
  const invitationId = `invite_${Date.now()}`;
  
  const invitation: Invitation = {
    id: invitationId,
    diaryId,
    diaryName,
    personId,
    personEmail: userEmail.toLowerCase(),
    personName: diary.people[personId]?.name || 'Guest',
    status: 'pending',
    createdAt: new Date().toISOString(),
    invitedAt: new Date().toISOString(),
    invitedBy: diary.createdBy,
    invitedByName: Object.values(diary.people).find(p => p.userId === diary.createdBy)?.name || 'Diary Creator',
  };

  await setDoc(doc(db, 'invitations', invitationId), invitation);
}


  private normalizeDiary(data: any): Diary {
    return {
      ...data,
      expenses: Array.isArray(data.expenses)
        ? data.expenses.filter((e: any) => e)
        : [],
      deletedExpenses: Array.isArray(data.deletedExpenses)
        ? data.deletedExpenses.filter((e: any) => e)
        : [],
      settlements: Array.isArray(data.settlements)
        ? data.settlements.filter((s: any) => s)
        : [],
      events: Array.isArray(data.events)
        ? data.events.filter((e: any) => e)
        : [],
      members: Array.isArray(data.members)
        ? data.members.filter((m: any) => m)
        : [],
    } as Diary;
  }
}

export const firebaseService = new FirebaseService();