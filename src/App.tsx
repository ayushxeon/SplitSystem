import React, { useState, useEffect } from "react";
import {
  LogOut,
  Bell,
  Plus,
  Users,
  UserPlus,
  Link2,
  Share2,
  Edit2,
  Trash2,
  History,
  Archive,
} from "lucide-react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth,db } from "./firebase/firebase";
import { cacheService } from "./services/storage";
import { firebaseService } from "./services/firebaseService";
import { AuthScreen } from "./components/AuthScreen";
import { InvitationsPanel } from "./components/InvitationPanel";
import { JoinRequestsPanel } from "./components/joinRequestPanel";
import { AddPersonModal } from "./components/AddPersonModal";
import { ExpenseForm } from "./components/ExpenseForm";
import { EventManagement } from "./components/EventManagement";
import { PeopleManager } from "./components/PeopleManager.component";
import { ExpenseVersionHistory } from "./components/ExpenseVersionHistory";
import { ModificationNotifications } from "./components/ModificationNotification.component";
import { DeletedExpenses } from "./components/DeletedExpenses.component";
import { InputDialog } from "./components/InputDialog.component";
import type {
  User,
  Diary,
  Invitation,
  Expense,
  Event,
  Settlement,
  ModificationNotification,
} from "./types/types";
import { TestingBanner } from "./components/TestingBanner";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { doc, getDoc, onSnapshot } from "firebase/firestore";

export default function ExpenseSplitter() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [diaries, setDiaries] = useState<Diary[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [modifications, setModifications] = useState<
    ModificationNotification[]
  >([]);
  const [showInvitations, setShowInvitations] = useState(false);
  const [showModifications, setShowModifications] = useState(false);
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [currentDiaryId, setCurrentDiaryId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [showPeopleManager, setShowPeopleManager] = useState(false);
  const [showExpenseVersions, setShowExpenseVersions] = useState<string | null>(
    null
  );
  const [showDeletedExpenses, setShowDeletedExpenses] = useState(false);
  const [inputDialog, setInputDialog] = useState<{
    show: boolean;
    title: string;
    label: string;
    placeholder: string;
    type?: "text" | "number";
    maxValue?: number;
    onConfirm: (value: string) => void;
  } | null>(null);
  const [showAllDiaries, setShowAllDiaries] = useState(false); // ✅ NEW: Track if showing all diaries

  const displayName = (
    personId: string,
    diary: Diary,
    fallback: string = "Unknown"
  ) => {
    const person = diary.people[personId];
    if (!person) return fallback;
    if (person.userId === user?.uid) return "You";
    return person.name;
  };

  useEffect(() => {
    // Reset expense form when switching diaries
    setEditingExpenseId(null);
    setShowAddExpense(false);
  }, [currentDiaryId]);

  useEffect(() => {
    let unsubInvites: (() => void) | undefined;
    let unsubModifications: (() => void) | undefined;
    let unsubDiaries: (() => void) | undefined;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          await firebaseService.registerUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email?.toLowerCase() || "",
            displayName: firebaseUser.displayName || "Unknown User",
            photoURL: firebaseUser.photoURL || undefined,
          });
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email!,
            displayName: firebaseUser.displayName!,
            photoURL: firebaseUser.photoURL,
          } as User);

          setDiaries(cacheService.getDiaries());
          setInvitations(cacheService.getInvitations());

          const lastSync = cacheService.getLastSyncTime();
          const now = Date.now();
          const SYNC_INTERVAL = 5 * 60 * 1000;

          if (now - lastSync > SYNC_INTERVAL) {
            setSyncing(true);
            const syncedDiaries = await firebaseService.syncDiaries(
              firebaseUser.uid
            );
            const syncedInvitations = await firebaseService.loadInvitations(
              firebaseUser.email!
            );
            setDiaries(syncedDiaries);
            setInvitations(syncedInvitations);
            setSyncing(false);
          }

          unsubDiaries = firebaseService.subscribeToUserDiaries(
            firebaseUser.uid,
            (updatedDiaries) => {
              setDiaries(updatedDiaries);
              cacheService.setDiaries(updatedDiaries);
            }
          );

          unsubInvites = firebaseService.subscribeToInvitations(
            firebaseUser.email!,
            (newInvitations) => {
              setInvitations(newInvitations);
              cacheService.setInvitations(newInvitations);
            }
          );

          unsubModifications = firebaseService.subscribeToModifications(
            firebaseUser.uid,
            (notifications) => {
              setModifications(notifications);
            }
          );
        } catch (error) {
          console.error("Error loading user:", error);
        }
      } else {
        setUser(null);
        cacheService.clearAll();
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
      if (unsubInvites) unsubInvites();
      if (unsubModifications) unsubModifications();
      if (unsubDiaries) unsubDiaries();
    };
  }, []);

  const handleSignOut = async () => {
    await signOut(auth);
  };

  const handleCreateDiary = async () => {
    const name = prompt("Enter diary name:");
    if (!name || !user) return;

    const diaryId = `diary_${Date.now()}`;
    const newDiary: Diary = {
      id: diaryId,
      name: name.trim(),
      createdBy: user.uid,
      members: [user.uid],
      people: {},
      expenses: [],
      deletedExpenses: [],
      settlements: [],
      events: [{ id: "general", name: "General Expenses", order: 0 }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await firebaseService.createDiary(newDiary, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
      });
      await handleRefreshData();
      setCurrentDiaryId(diaryId);
    } catch (error: any) {
      console.error("Failed to create diary:", error.message);
    }
  };

  const handleRefreshData = async () => {
  if (!user) return;

  setSyncing(true);
  try {
    const [syncedDiaries, syncedInvitations] = await Promise.all([
      firebaseService.syncDiaries(user.uid),
      firebaseService.loadInvitations(user.email)
    ]);
    
    setDiaries(syncedDiaries);
    setInvitations(syncedInvitations);
    
    // ✅ If current diary is not in synced diaries, clear it
    if (currentDiaryId && !syncedDiaries.find(d => d.id === currentDiaryId)) {
      setCurrentDiaryId(null);
    }
  } catch (error) {
    console.error('Error refreshing data:', error);
  } finally {
    setSyncing(false);
  }
};

  const handleLeaveDiary = async () => {
    if (!currentDiaryId || !user || !currentDiary) return;

    const hasExpenses = currentDiary.expenses.some(
      (exp) => exp.paidBy === user.uid || exp.participants.includes(user.uid)
    );

    const hasSettlements = currentDiary.settlements.some(
      (set) => set.from === user.uid || set.to === user.uid
    );

    const settlements = calculateSettlements(currentDiary);
    const hasPendingBalance = settlements.some(
      (s) => s.from === user.uid || s.to === user.uid
    );

    if (hasExpenses || hasSettlements || hasPendingBalance) {
      let message = "You cannot leave this diary because:\n\n";
      if (hasPendingBalance) {
        const userSettlements = settlements.filter(
          (s) => s.from === user.uid || s.to === user.uid
        );
        message += "• You have pending settlements:\n";
        userSettlements.forEach((s) => {
          if (s.from === user.uid) {
            message += `  - You owe ${
              currentDiary.people[s.to]?.name
            } ₹${s.amount.toFixed(2)}\n`;
          } else {
            message += `  - ${
              currentDiary.people[s.from]?.name
            } owes you ₹${s.amount.toFixed(2)}\n`;
          }
        });
      }
      if (hasExpenses) {
        message += "• You are part of active expenses\n";
      }
      if (hasSettlements) {
        message += "• You have settlement records\n";
      }
      message += "\nTo leave:\n";
      message += "1. Settle all pending amounts\n";
      message += "2. Have another member remove you from all expenses";

      alert(message);
      return;
    }

    if (!confirm("Are you sure you want to leave this diary?")) return;

    try {
      await firebaseService.leaveDiary(currentDiaryId, user.uid);
      setCurrentDiaryId(null);
      alert("You have successfully left the diary");
    } catch (error: any) {
      alert(error.message);
    }
  };

  const calculateSettlements = (diary: Diary) => {
    const balances: Record<string, number> = {};
    Object.keys(diary.people).forEach((id) => {
      balances[id] = 0;
    });

    const expenses: Expense[] = Array.isArray(diary.expenses)
      ? diary.expenses
      : [];
    const settlements: Settlement[] = Array.isArray(diary.settlements)
      ? diary.settlements
      : [];

    // ✅ Filter out undefined/null values
    const validExpenses = expenses.filter(
      (e) => e && e.paidBy && e.participants
    );
    const validSettlements = settlements.filter((s) => s && s.from && s.to);

    // Add expense balances
    validExpenses.forEach((expense) => {
      balances[expense.paidBy] =
        (balances[expense.paidBy] || 0) + expense.amount;

      // ✅ Add safety check for participants
      if (expense.participants && Array.isArray(expense.participants)) {
        expense.participants.forEach((personId: string) => {
          const share =
            (expense.amount *
              parseInt(expense.splits[personId]?.toString() || "0")) /
            100;
          balances[personId] = (balances[personId] || 0) - share;
        });
      }
    });

    // Subtract ALL settlements
    validSettlements.forEach((settlement) => {
      balances[settlement.from] =
        (balances[settlement.from] || 0) + settlement.amount;
      balances[settlement.to] =
        (balances[settlement.to] || 0) - settlement.amount;
    });

    const creditors: Array<{ id: string; amount: number }> = [];
    const debtors: Array<{ id: string; amount: number }> = [];

    Object.entries(balances).forEach(([personId, balance]) => {
      if (balance > 0.01) creditors.push({ id: personId, amount: balance });
      else if (balance < -0.01)
        debtors.push({ id: personId, amount: -balance });
    });

    creditors.sort((a, b) => b.amount - a.amount);
    debtors.sort((a, b) => b.amount - a.amount);

    const result: Array<{ from: string; to: string; amount: number }> = [];
    let i = 0,
      j = 0;

    while (i < creditors.length && j < debtors.length) {
      const creditor = creditors[i];
      const debtor = debtors[j];
      const amount = Math.min(creditor.amount, debtor.amount);

      if (amount > 0.01) {
        result.push({ from: debtor.id, to: creditor.id, amount });
      }

      creditor.amount -= amount;
      debtor.amount -= amount;

      if (creditor.amount < 0.01) i++;
      if (debtor.amount < 0.01) j++;
    }

    return result;
  };

  const handleExpenseSubmit = async (expenseData: any) => {
    if (!currentDiaryId || !user) return;

    try {
      if (editingExpenseId) {
        await firebaseService.updateExpense(
          currentDiaryId,
          editingExpenseId,
          expenseData,
          user.uid
        );
        setEditingExpenseId(null);
      } else {
        const newExpense: Expense = {
          ...expenseData,
          id: Date.now().toString(),
          date: new Date().toISOString(),
        };
        await firebaseService.addExpense(currentDiaryId, newExpense);
        setShowAddExpense(false);
      }
    } catch (error: any) {
      alert(error.message || "Failed to save expense");
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (
      !currentDiaryId ||
      !user ||
      !confirm(
        "Delete this expense? (You can restore it later from Deleted Expenses)"
      )
    )
      return;

    try {
      await firebaseService.deleteExpense(currentDiaryId, expenseId, user.uid);
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleRestoreExpense = async (expense: Expense) => {
    if (!currentDiaryId) return;
    try {
      await firebaseService.restoreExpense(currentDiaryId, expense.id);
      alert("Expense restored successfully!");
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleEditAndRestoreExpense = async (expense: Expense) => {
    if (!currentDiaryId) return;
    try {
      await firebaseService.restoreExpense(currentDiaryId, expense.id);
      setShowDeletedExpenses(false);
      setEditingExpenseId(expense.id);
      setTimeout(() => {
        const expenseElement = document.getElementById(`expense-${expense.id}`);
        if (expenseElement) {
          expenseElement.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }
      }, 300);
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handlePermanentDelete = async (expenseId: string) => {
    if (!currentDiaryId) return;
    try {
      await firebaseService.permanentlyDeleteExpense(currentDiaryId, expenseId);
      alert("Expense permanently deleted");
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleAcknowledgeModification = async (notificationId: string) => {
    if (!user) return;
    try {
      await firebaseService.acknowledgeModification(notificationId, user.uid);
      setModifications((prev) => prev.filter((n) => n.id !== notificationId));
    } catch (error) {
      console.error("Error acknowledging modification:", error);
    }
  };

  const handleNavigateToExpense = (diaryId: string, expenseId: string) => {
    setCurrentDiaryId(diaryId);
    setTimeout(() => {
      const expenseElement = document.getElementById(`expense-${expenseId}`);
      if (expenseElement) {
        expenseElement.scrollIntoView({ behavior: "smooth", block: "center" });
        expenseElement.classList.add("ring-4", "ring-blue-400");
        setTimeout(() => {
          expenseElement.classList.remove("ring-4", "ring-blue-400");
        }, 2000);
      }
    }, 300);
  };

    const [currentDiary, setCurrentDiary] = useState<Diary | null>(null);

// Force load current diary from Firebase
useEffect(() => {
  if (!currentDiaryId || !user) {
    setCurrentDiary(null);
    return;
  }

  const loadCurrentDiary = async () => {
    try {
      const diaryDoc = await getDoc(doc(db, 'diaries', currentDiaryId));
      
      if (!diaryDoc.exists()) {
        alert('This diary no longer exists');
        setCurrentDiaryId(null);
        return;
      }

      const diary = diaryDoc.data() as Diary;

      // ✅ CHECK: Am I still a member?
      if (!diary.members.includes(user.uid)) {
        alert('You have been removed from this diary');
        setCurrentDiaryId(null);
        await handleRefreshData();
        return;
      }

      setCurrentDiary(diary);
    } catch (error) {
      console.error('Error loading diary:', error);
      setCurrentDiaryId(null);
    }
  };

  loadCurrentDiary();

  // ✅ Real-time listener for current diary
  const unsubscribe = onSnapshot(
    doc(db, 'diaries', currentDiaryId),
    (snapshot: any) => {
      if (!snapshot.exists()) {
        alert('This diary has been deleted');
        setCurrentDiaryId(null);
        return;
      }

      const diary = snapshot.data() as Diary;

      // Check if still a member
      if (!diary.members.includes(user.uid)) {
        alert('You have been removed from this diary');
        setCurrentDiaryId(null);
        return;
      }

      setCurrentDiary(diary);
    },
    (error: any) => {
      console.error('Error listening to diary:', error);
    }
  );

  return () => unsubscribe();
}, [currentDiaryId, user]);
  const pendingInvitations = invitations.filter(
    (i) => i.status === "pending"
  ).length;

  const globalTotals = diaries.reduce(
    (acc, diary) => {
      if (!diary || !diary.people) return acc;

      const settlements = calculateSettlements(diary);
      settlements.forEach((s) => {
        if (diary.people[s.to]?.userId === user?.uid) {
          acc.toReceive += s.amount;
        }
        if (diary.people[s.from]?.userId === user?.uid) {
          acc.toPay += s.amount;
        }
      });
      return acc;
    },
    { toReceive: 0, toPay: 0 }
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    <TestingBanner />;
    return <AuthScreen onSignIn={(user) => setUser(user as User)} />;
  }

  return (
    <>
      {" "}
      <TestingBanner />
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-2 sm:p-4">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-6 mb-4 sm:mb-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-base sm:text-lg flex-shrink-0">
                  {user.displayName?.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg sm:text-xl font-bold text-gray-800 truncate">
                    {user.displayName}
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-600 truncate">
                    {user.email}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                {(globalTotals.toReceive > 0.01 ||
                  globalTotals.toPay > 0.01) && (
                  <div className="flex items-center gap-2">
                    {globalTotals.toReceive > 0.01 && (
                      <div className="bg-green-100 px-2 sm:px-3 py-1 sm:py-2 rounded-lg">
                        <p className="text-xs text-green-700 font-medium">
                          Receive
                        </p>
                        <p className="text-sm sm:text-lg font-bold text-green-800">
                          ₹{globalTotals.toReceive.toFixed(0)}
                        </p>
                      </div>
                    )}
                    {globalTotals.toPay > 0.01 && (
                      <div className="bg-red-100 px-2 sm:px-3 py-1 sm:py-2 rounded-lg">
                        <p className="text-xs text-red-700 font-medium">Pay</p>
                        <p className="text-sm sm:text-lg font-bold text-red-800">
                          ₹{globalTotals.toPay.toFixed(0)}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  {modifications.length > 0 && (
                    <button
                      onClick={() => setShowModifications(true)}
                      className="relative p-2 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 touch-manipulation"
                    >
                      <Bell size={18} />
                      <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                        {modifications.length}
                      </span>
                    </button>
                  )}
                  <button
                    onClick={() => setShowInvitations(true)}
                    className="relative p-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 touch-manipulation"
                  >
                    <Bell size={18} />
                    {pendingInvitations > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                        {pendingInvitations}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={handleSignOut}
                    className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg touch-manipulation"
                  >
                    <LogOut size={18} className="inline sm:mr-2" />
                    <span className="hidden sm:inline">Sign Out</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-6 mb-4 sm:mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-700">
                📔 My Diaries
              </h2>
              <button
                onClick={handleCreateDiary}
                className="bg-orange-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-orange-700 text-sm sm:text-base touch-manipulation"
              >
                <Plus size={18} className="inline mr-1 sm:mr-2" />
                New
              </button>
            </div>

            {diaries.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-4">No diaries yet</p>
                <button
                  onClick={handleCreateDiary}
                  className="bg-orange-600 text-white px-6 py-3 rounded-lg touch-manipulation"
                >
                  Create First Diary
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {/* ✅ Show only first 6 diaries unless showAllDiaries is true */}
                  {(showAllDiaries ? diaries : diaries.slice(0, 6)).map((diary) => {
                  const settlements = calculateSettlements(diary);
                  const toReceiveSettlements = settlements.filter(
                    (s) => diary.people[s.to]?.userId === user.uid
                  );
                  const toPaySettlements = settlements.filter(
                    (s) => diary.people[s.from]?.userId === user.uid
                  );
                  const totalToReceive = toReceiveSettlements.reduce(
                    (sum, s) => sum + s.amount,
                    0
                  );
                  const totalToPay = toPaySettlements.reduce(
                    (sum, s) => sum + s.amount,
                    0
                  );
                  const markedPaidSettlements = diary.settlements.filter(
                    (s) =>
                      s.status === "marked_paid" &&
                      diary.people[s.from]?.userId === user.uid
                  );
                  const totalMarkedPaid = markedPaidSettlements.reduce(
                    (sum, s) => sum + s.amount,
                    0
                  );

                  return (
                    <div
                      key={diary.id}
                      onClick={() => setCurrentDiaryId(diary.id)}
                      className={`p-3 sm:p-4 rounded-lg border-2 cursor-pointer touch-manipulation ${
                        currentDiaryId === diary.id
                          ? "bg-orange-50 border-orange-500"
                          : "bg-gray-50 border-gray-200"
                      }`}
                    >
                      <h3 className="font-semibold text-gray-800 mb-2 text-sm sm:text-base">
                        {diary.name}
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-600 mb-2">
                        {Object.keys(diary.people).length} people •{" "}
                        {diary.expenses.length} expenses
                      </p>

                      <div className="flex gap-1 sm:gap-2 flex-wrap">
                        {toReceiveSettlements.length > 0 && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium whitespace-nowrap">
                            💰 {toReceiveSettlements.length} (₹
                            {totalToReceive.toFixed(0)})
                          </span>
                        )}
                        {toPaySettlements.length > 0 && (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium whitespace-nowrap">
                            ⚠️ {toPaySettlements.length} (₹
                            {totalToPay.toFixed(0)})
                          </span>
                        )}
                        {markedPaidSettlements.length > 0 && (
                          <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-medium whitespace-nowrap">
                            ⏳ {markedPaidSettlements.length} (₹
                            {totalMarkedPaid.toFixed(0)})
                          </span>
                        )}
                        {settlements.length === 0 &&
                          markedPaidSettlements.length === 0 && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full whitespace-nowrap">
                              ✓ All settled
                            </span>
                          )}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* ✅ Show "Show All" button only if there are more than 6 diaries */}
              {diaries.length > 6 && (
                <div className="mt-4 text-center">
                  <button
                    onClick={() => setShowAllDiaries(!showAllDiaries)}
                    className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300 transition text-sm font-medium"
                  >
                    {showAllDiaries ? '← Show Less' : `Show All (${diaries.length})`}
                  </button>
                </div>
              )}
            </>
            )}
          </div>

          {currentDiary && (
            <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-6">
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-800">
                    {currentDiary.name}
                  </h2>
                 <button
  onClick={async () => {
    const inviteLink = `https://syncsplit.vercel.app/invite/${currentDiary.id}`;
    const message = `Join "${currentDiary.name}" on SplitSync - Track expenses together!\n\n${inviteLink}`;
    
    // Try native share (mobile)
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${currentDiary.name} on SplitSync`,
          text: message,
          url: inviteLink
        });
      } catch (err) {
        // User cancelled, that's fine
      }
    } else {
      // Fallback: copy to clipboard (desktop)
      navigator.clipboard.writeText(message);
      
      // Show toast notification
      const toast = document.createElement('div');
      toast.textContent = '✓ Invite link copied!';
      toast.className = 'fixed bottom-4 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg z-50 text-sm';
      toast.style.animation = 'fadeIn 0.2s ease-out';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2000);
    }
  }}
  className="text-xs sm:text-sm bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-3 py-1.5 rounded-lg hover:from-blue-600 hover:to-indigo-600 shadow-sm font-medium transition-all flex items-center gap-1 touch-manipulation"
>
  <Share2 size={14} />
  <span className="hidden sm:inline">Share Invite</span>
  <span className="sm:hidden">Share</span>
</button>
                </div>

                <div className="flex gap-2 w-full sm:w-auto">
                  {currentDiary.deletedExpenses &&
                    currentDiary.deletedExpenses.length > 0 && (
                      <button
                        onClick={() => setShowDeletedExpenses(true)}
                        className="flex-1 sm:flex-none bg-gray-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-gray-700 flex items-center justify-center gap-2 text-sm touch-manipulation"
                      >
                        <Archive size={16} />
                        <span className="hidden sm:inline">
                          Deleted ({currentDiary.deletedExpenses.length})
                        </span>
                        <span className="sm:hidden">
                          ({currentDiary.deletedExpenses.length})
                        </span>
                      </button>
                    )}
                  <button
                    onClick={handleLeaveDiary}
                    className="flex-1 sm:flex-none bg-red-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-red-700 text-sm touch-manipulation"
                  >
                    Leave
                  </button>
                  <button
                    onClick={() => setShowPeopleManager(true)}
                    className="flex-1 sm:flex-none bg-indigo-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm touch-manipulation"
                  >
                    <Users size={16} className="inline mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">People</span>
                  </button>
                </div>
              </div>

              {showPeopleManager && (
  <PeopleManager
    diary={currentDiary}
    currentUserId={user.uid}
    onClose={() => setShowPeopleManager(false)}
    onUpdate={handleRefreshData}
  />
)}

{/* ✅ ADD THIS ENTIRE BLOCK */}
{currentDiary.joinRequests && currentDiary.joinRequests.length > 0 && (
  <JoinRequestsPanel
    requests={currentDiary.joinRequests}
    onApprove={async (requestId) => {
      if (!user) return;
      try {
        await firebaseService.approveJoinRequest(currentDiaryId!, requestId, user.uid);
        alert('✓ Request approved!');
        await handleRefreshData();
      } catch (error: any) {
        alert(error.message);
      }
    }}
    onReject={async (requestId) => {
      try {
        await firebaseService.rejectJoinRequest(currentDiaryId!, requestId);
        alert('✓ Request rejected');
        await handleRefreshData();
      } catch (error: any) {
        alert(error.message);
      }
    }}
  />
)}

              {Object.keys(currentDiary.people).length === 0 ? (
                <div className="text-center py-8">
                  <button
                    onClick={() => setShowAddPerson(true)}
                    className="text-indigo-600 touch-manipulation"
                  >
                    Add first person
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 mb-6">
                    {Object.values(currentDiary.people).map((person) => {
  // Determine status badge
  let statusBadge = null;
  let statusColor = '';
  
  if (person.status === 'unregistered') {
    statusBadge = 'Guest';
    statusColor = 'bg-gray-100 text-gray-600';
  } else if (person.status === 'pending') {
    statusBadge = 'Pending';
    statusColor = 'bg-yellow-100 text-yellow-700';
  } else if (person.status === 'accepted') {
    statusBadge = 'Joined';
    statusColor = 'bg-green-100 text-green-700';
  } else if (person.status === 'rejected') {
    // ✅ NEW: Show rejected status
    statusBadge = 'Rejected';
    statusColor = 'bg-red-100 text-red-700';
  }

  return (
    <div
      key={person.id}
      className="bg-gray-50 p-3 rounded-lg border border-gray-200"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1">
          <span className="font-medium">{person.name}</span>
          {statusBadge && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor}`}>
              {statusBadge}
            </span>
          )}
        </div>
        {person.userId === user.uid && (
          <span className="text-xs text-gray-500">(You)</span>
        )}
      </div>
      {person.email && (
        <p className="text-xs text-gray-500 mt-1">{person.email}</p>
      )}
    </div>
  );
})}
                  </div>

                  <button
                    onClick={() => setShowAddPerson(true)}
                    className="w-full bg-indigo-600 text-white px-4 py-2 sm:py-3 rounded-lg mb-6 text-sm sm:text-base touch-manipulation"
                  >
                    <UserPlus size={18} className="inline mr-2" />
                    Add Person
                  </button>

                  <EventManagement
                    events={currentDiary.events}
                    expenses={currentDiary.expenses}
                    onAddEvent={async (name) => {
                      if (
                        currentDiary.events.find(
                          (e) => e.name.toLowerCase() === name.toLowerCase()
                        )
                      ) {
                        alert("Event already exists!");
                        return;
                      }
                      const newEvent: Event = {
                        id: Date.now().toString(),
                        name,
                        order: currentDiary.events.length,
                      };
                      await firebaseService.addEvent(currentDiaryId!, newEvent);
                    }}
                    onDeleteEvent={async (eventId) => {
                      if (
                        eventId === "general" ||
                        !confirm("Delete this event?")
                      )
                        return;
                      await firebaseService.deleteEvent(
                        currentDiaryId!,
                        eventId
                      );
                    }}
                    onReorderEvents={async (dragIndex, hoverIndex) => {
                      const newEvents = [...currentDiary.events];
                      const dragEvent = newEvents[dragIndex];
                      newEvents.splice(dragIndex, 1);
                      newEvents.splice(hoverIndex, 0, dragEvent);
                      await firebaseService.reorderEvents(
                        currentDiaryId!,
                        newEvents.map((e, i) => ({ ...e, order: i }))
                      );
                    }}
                  />

                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg sm:text-xl font-semibold">
                        Expenses
                      </h3>
                      <button
                        onClick={() => setShowAddExpense(true)}
                        className="bg-green-600 text-white px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base touch-manipulation"
                      >
                        <Plus size={18} className="inline mr-1 sm:mr-2" />
                        Add
                      </button>
                    </div>

                    {showAddExpense && (
                      <ExpenseForm
                        people={currentDiary.people}
                        events={currentDiary.events}
                        currentUser={user}
                        editingExpense={null}
                        onSubmit={handleExpenseSubmit}
                        onCancel={() => setShowAddExpense(false)}
                      />
                    )}

                    {currentDiary.expenses.length === 0 ? (
                      <p className="text-gray-500 text-center py-8">
                        No expenses yet
                      </p>
                    ) : (
                      <div className="space-y-6">
                        {currentDiary.events.map((event) => {
                          const eventExpenses = currentDiary.expenses.filter(
                            (exp) => (exp.eventId || "general") === event.id
                          );
                          if (eventExpenses.length === 0) return null;

                          return (
                            <div
                              key={event.id}
                              className="border-l-4 border-purple-400 pl-3 sm:pl-4"
                            >
                              <h4 className="font-semibold text-gray-700 mb-3 text-sm sm:text-base">
                                {event.name} ({eventExpenses.length})
                              </h4>
                              <div className="space-y-3">
                                {eventExpenses.map((expense) => {
                                  const userShare =
                                    expense.participants.includes(user.uid)
                                      ? (expense.amount *
                                          parseInt(
                                            expense.splits[
                                              user.uid
                                            ]?.toString() || "0"
                                          )) /
                                        100
                                      : 0;
                                  const userPaid = expense.paidBy === user.uid;
                                  const userBalance = userPaid
                                    ? expense.amount - userShare
                                    : -userShare;

                                  return (
                                    <div key={expense.id}>
                                      {editingExpenseId === expense.id ? (
                                        <ExpenseForm
                                          people={currentDiary.people}
                                          events={currentDiary.events}
                                          currentUser={user}
                                          editingExpense={expense}
                                          onSubmit={handleExpenseSubmit}
                                          onCancel={() =>
                                            setEditingExpenseId(null)
                                          }
                                        />
                                      ) : (
                                        <div
                                          id={`expense-${expense.id}`}
                                          className="p-3 sm:p-4 rounded-lg border-2 bg-white border-gray-200 hover:shadow-md transition"
                                        >
                                          <div className="flex justify-between gap-2 mb-2">
                                            <div className="flex-1 min-w-0">
                                              <h3 className="font-semibold text-sm sm:text-base">
                                                {expense.description}
                                              </h3>
                                              <p className="text-xs sm:text-sm text-gray-600">
                                                ₹{expense.amount.toFixed(2)}{" "}
                                                paid by{" "}
                                                {displayName(
                                                  expense.paidBy,
                                                  currentDiary
                                                )}
                                              </p>

                                              {expense.participants.includes(
                                                user.uid
                                              ) && (
                                                <div className="mt-2 p-2 bg-blue-50 border-l-4 border-blue-500 rounded">
                                                  <p className="text-xs sm:text-sm font-medium text-blue-900">
                                                    Your share: ₹
                                                    {userShare.toFixed(2)}
                                                    {userPaid && (
                                                      <span className="ml-1 sm:ml-2 text-green-700 block sm:inline">
                                                        • You paid ₹
                                                        {expense.amount.toFixed(
                                                          2
                                                        )}
                                                        • You'll receive ₹
                                                        {userBalance.toFixed(2)}
                                                      </span>
                                                    )}
                                                    {!userPaid &&
                                                      userBalance < 0 && (
                                                        <span className="ml-1 sm:ml-2 text-red-700 block sm:inline">
                                                          • You owe ₹
                                                          {Math.abs(
                                                            userBalance
                                                          ).toFixed(2)}
                                                        </span>
                                                      )}
                                                  </p>
                                                </div>
                                              )}

                                              <div className="text-xs text-gray-500 mt-1">
                                                Split:{" "}
                                                {expense.participants
                                                  .map(
                                                    (p) =>
                                                      `${displayName(
                                                        p,
                                                        currentDiary
                                                      )} (${
                                                        expense.splits[p]
                                                      }%)`
                                                  )
                                                  .join(", ")}
                                              </div>
                                              {expense.lastModifiedBy && (
                                                <div className="text-xs text-orange-600 mt-1">
                                                  Modified by{" "}
                                                  {expense.modifiedByName || // First try stored name (new approach)
                                                    (() => {
                                                      // Fallback: Find person by userId
                                                      const person =
                                                        Object.values(
                                                          currentDiary.people
                                                        ).find(
                                                          (p) =>
                                                            p.userId ===
                                                            expense.lastModifiedBy
                                                        );
                                                      if (person) {
                                                        return person.userId ===
                                                          user.uid
                                                          ? "You"
                                                          : person.name;
                                                      }
                                                      return "Unknown";
                                                    })()}
                                                  {expense.lastModifiedAt &&
                                                    ` on ${new Date(
                                                      expense.lastModifiedAt
                                                    ).toLocaleDateString()}`}
                                                </div>
                                              )}
                                            </div>

                                            <div className="flex flex-col sm:flex-row gap-1 sm:gap-2 items-end sm:items-start">
                                              {expense.versions &&
                                                expense.versions.length > 0 && (
                                                  <button
                                                    onClick={() =>
                                                      setShowExpenseVersions(
                                                        expense.id
                                                      )
                                                    }
                                                    className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200 whitespace-nowrap touch-manipulation"
                                                    title="View version history"
                                                  >
                                                    <History
                                                      size={12}
                                                      className="inline mr-1"
                                                    />
                                                    v{expense.currentVersion}
                                                  </button>
                                                )}

                                              <button
                                                onClick={() =>
                                                  setEditingExpenseId(
                                                    expense.id
                                                  )
                                                }
                                                className="p-2 text-blue-500 hover:text-blue-700 touch-manipulation"
                                                title="Edit expense"
                                              >
                                                <Edit2 size={16} />
                                              </button>

                                              <button
                                                onClick={() =>
                                                  handleDeleteExpense(
                                                    expense.id
                                                  )
                                                }
                                                className="p-2 text-red-500 hover:text-red-700 touch-manipulation"
                                                title="Delete expense"
                                              >
                                                <Trash2 size={16} />
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {showExpenseVersions &&
                    currentDiary.expenses.find(
                      (e) => e.id === showExpenseVersions
                    ) && (
                      <ExpenseVersionHistory
                        expense={
                          currentDiary.expenses.find(
                            (e) => e.id === showExpenseVersions
                          )!
                        }
                        people={currentDiary.people}
                        onClose={() => setShowExpenseVersions(null)}
                      />
                    )}

                  {currentDiary.expenses.length > 0 && (
                    <div>
                      <h3 className="text-lg sm:text-xl font-semibold mb-4">
                        💰 Settlements
                      </h3>

                      {calculateSettlements(currentDiary).length === 0 &&
                      currentDiary.settlements.filter(
                        (s) => s.status === "marked_paid"
                      ).length === 0 ? (
                        <div className="text-center py-8 bg-green-50 rounded-lg">
                          <p className="text-green-700 font-semibold">
                            ✓ All Settled!
                          </p>
                        </div>
                      ) : (
                        <>
                          {Object.entries(
                            currentDiary.settlements
                              .filter((s) => s.status === "marked_paid")
                              .reduce((acc, s) => {
                                const key = `${s.from}-${s.to}`;
                                if (!acc[key])
                                  acc[key] = {
                                    from: s.from,
                                    to: s.to,
                                    marked: 0,
                                    settlement: s,
                                  };
                                acc[key].marked += s.amount;
                                acc[key].settlement = s;
                                return acc;
                              }, {} as Record<string, { from: string; to: string; marked: number; settlement: Settlement }>)
                          ).map(([key, data]) => {
                            const totalOwed = calculateSettlements(currentDiary)
                              .filter(
                                (s) => s.from === data.from && s.to === data.to
                              )
                              .reduce((sum, s) => sum + s.amount, 0);

                            const remaining = totalOwed;
                            const isUserPayer =
                              currentDiary.people[data.from]?.userId ===
                              user.uid;
                            const isUserReceiver =
                              currentDiary.people[data.to]?.userId === user.uid;

                            return (
                              <div key={key} className="space-y-3 mb-6">
                                <div className="bg-yellow-50 p-3 sm:p-4 rounded-lg border-l-4 border-yellow-500">
                                  <h4 className="text-xs font-semibold text-gray-600 uppercase mb-2">
                                    Marked as Paid (Pending Confirmation)
                                  </h4>
                                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                                    <div className="flex-1">
                                      <p className="text-sm sm:text-base text-gray-800">
                                        <span className="font-semibold">
                                          {displayName(data.from, currentDiary)}
                                        </span>{" "}
                                        marked payment to{" "}
                                        <span className="font-semibold">
                                          {displayName(data.to, currentDiary)}
                                        </span>{" "}
                                        <span className="font-bold text-yellow-600">
                                          ₹{data.marked.toFixed(2)}
                                        </span>
                                      </p>
                                      <p className="text-xs text-gray-500 mt-1">
                                        Marked on{" "}
                                        {new Date(
                                          data.settlement.markedPaidAt!
                                        ).toLocaleString()}
                                      </p>
                                    </div>

                                    {isUserReceiver && (
                                      <button
                                        onClick={() => {
                                          firebaseService.confirmSettlement(
                                            currentDiaryId!,
                                            data.settlement.id
                                          );
                                        }}
                                        className="bg-green-500 text-white px-3 sm:px-4 py-2 rounded-lg text-sm hover:bg-green-600 w-full sm:w-auto touch-manipulation"
                                      >
                                        Confirm
                                      </button>
                                    )}

                                    {isUserPayer && (
                                      <span className="text-xs sm:text-sm text-yellow-700 bg-yellow-100 px-3 py-1 rounded-lg">
                                        Waiting for confirmation
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {remaining > 0.01 && (
                                  <div className="bg-purple-50 p-3 sm:p-4 rounded-lg border-l-4 border-purple-500">
                                    <h4 className="text-xs font-semibold text-gray-600 uppercase mb-2">
                                      Remaining Pending
                                    </h4>
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                                      <p className="text-sm sm:text-base">
                                        <span className="font-semibold">
                                          {displayName(data.from, currentDiary)}
                                        </span>{" "}
                                        owes{" "}
                                        <span className="font-semibold">
                                          {displayName(data.to, currentDiary)}
                                        </span>{" "}
                                        <span className="font-bold text-purple-600">
                                          ₹{remaining.toFixed(2)}
                                        </span>
                                      </p>
                                      <div className="flex gap-2 w-full sm:w-auto">
                                        {isUserPayer && (
                                          <button
                                            onClick={() => {
                                              setInputDialog({
                                                show: true,
                                                title: "Mark Paid",
                                                label: "Amount",
                                                placeholder: `Enter amount (max ₹${remaining.toFixed(
                                                  2
                                                )})`,
                                                type: "number",
                                                maxValue: remaining,
                                                onConfirm: (value) => {
                                                  const amount =
                                                    parseFloat(value);
                                                  if (isNaN(amount)) return;
                                                  firebaseService.markSettlementAsPaid(
                                                    currentDiaryId!,
                                                    data.from,
                                                    data.to,
                                                    amount,
                                                    user!.uid
                                                  );
                                                  setInputDialog(null);
                                                },
                                              });
                                            }}
                                            className="flex-1 sm:flex-none bg-yellow-500 text-white px-3 sm:px-4 py-2 rounded-lg text-sm hover:bg-yellow-600 touch-manipulation"
                                          >
                                            Mark Paid
                                          </button>
                                        )}

                                        {isUserReceiver && (
                                          <button
                                            onClick={() => {
                                              const newSettlement: Settlement =
                                                {
                                                  id: `settlement_${Date.now()}`,
                                                  from: data.from,
                                                  to: data.to,
                                                  amount: remaining,
                                                  date: new Date().toISOString(),
                                                  status: "confirmed",
                                                };
                                              firebaseService.addSettlement(
                                                currentDiaryId!,
                                                newSettlement
                                              );
                                            }}
                                            className="flex-1 sm:flex-none bg-green-500 text-white px-3 sm:px-4 py-2 rounded-lg text-sm hover:bg-green-600 touch-manipulation"
                                          >
                                            Settle
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {calculateSettlements(currentDiary).filter(
                            (settlement) => {
                              const hasMarkedPaid =
                                currentDiary.settlements.some(
                                  (s) =>
                                    s.from === settlement.from &&
                                    s.to === settlement.to &&
                                    s.status === "marked_paid"
                                );
                              return !hasMarkedPaid;
                            }
                          ).length > 0 && (
                            <div className="space-y-3 mb-6">
                              <h4 className="text-sm font-semibold text-gray-600 uppercase">
                                Pending Settlements
                              </h4>
                              {calculateSettlements(currentDiary)
                                .filter((settlement) => {
                                  const hasMarkedPaid =
                                    currentDiary.settlements.some(
                                      (s) =>
                                        s.from === settlement.from &&
                                        s.to === settlement.to &&
                                        s.status === "marked_paid"
                                    );
                                  return !hasMarkedPaid;
                                })
                                .map((settlement, idx) => {
                                  const isUserPayer =
                                    currentDiary.people[settlement.from]
                                      ?.userId === user.uid;
                                  const isUserReceiver =
                                    currentDiary.people[settlement.to]
                                      ?.userId === user.uid;

                                  return (
                                    <div
                                      key={idx}
                                      className="bg-purple-50 p-3 sm:p-4 rounded-lg border-l-4 border-purple-500"
                                    >
                                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                                        <p className="text-sm sm:text-base">
                                          <span className="font-semibold">
                                            {displayName(
                                              settlement.from,
                                              currentDiary
                                            )}
                                          </span>{" "}
                                          owes{" "}
                                          <span className="font-semibold">
                                            {displayName(
                                              settlement.to,
                                              currentDiary
                                            )}
                                          </span>{" "}
                                          <span className="font-bold text-purple-600">
                                            ₹{settlement.amount.toFixed(2)}
                                          </span>
                                        </p>
                                        <div className="flex gap-2 w-full sm:w-auto">
                                          {isUserPayer && (
                                            <button
                                              onClick={() => {
                                                setInputDialog({
                                                  show: true,
                                                  title: "Mark Paid",
                                                  label: "Amount",
                                                  placeholder: `Enter amount (max ₹${settlement.amount.toFixed(
                                                    2
                                                  )})`,
                                                  type: "number",
                                                  maxValue: settlement.amount,
                                                  onConfirm: (value) => {
                                                    const amount =
                                                      parseFloat(value);
                                                    if (isNaN(amount)) return;
                                                    firebaseService.markSettlementAsPaid(
                                                      currentDiaryId!,
                                                      settlement.from,
                                                      settlement.to,
                                                      amount,
                                                      user.uid
                                                    );
                                                    setInputDialog(null);
                                                  },
                                                });
                                              }}
                                              className="flex-1 sm:flex-none bg-yellow-500 text-white px-3 sm:px-4 py-2 rounded-lg text-sm hover:bg-yellow-600 touch-manipulation"
                                            >
                                              Mark Paid
                                            </button>
                                          )}

                                          {isUserReceiver && (
                                            <button
                                              onClick={() => {
                                                const newSettlement: Settlement =
                                                  {
                                                    id: `settlement_${Date.now()}`,
                                                    from: settlement.from,
                                                    to: settlement.to,
                                                    amount: settlement.amount,
                                                    date: new Date().toISOString(),
                                                    status: "confirmed",
                                                  };
                                                firebaseService.addSettlement(
                                                  currentDiaryId!,
                                                  newSettlement
                                                );
                                              }}
                                              className="flex-1 sm:flex-none bg-green-500 text-white px-3 sm:px-4 py-2 rounded-lg text-sm hover:bg-green-600 touch-manipulation"
                                            >
                                              Settle
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                            </div>
                          )}
                        </>
                      )}

                      {currentDiary.settlements.filter(
                        (s) => s.status === "confirmed"
                      ).length > 0 && (
                        <div className="mt-6">
                          <h4 className="text-sm font-semibold text-gray-600 mb-3">
                            Settled History
                          </h4>
                          {currentDiary.settlements
                            .filter((s) => s.status === "confirmed")
                            .map((settlement) => (
                              <div
                                key={settlement.id}
                                className="bg-green-50 p-3 rounded-lg mb-2"
                              >
                                <p className="text-xs sm:text-sm">
                                  <span className="font-semibold">
                                    {displayName(settlement.from, currentDiary)}
                                  </span>{" "}
                                  paid{" "}
                                  <span className="font-semibold">
                                    {displayName(settlement.to, currentDiary)}
                                  </span>{" "}
                                  <span className="font-bold text-green-600">
                                    ₹{settlement.amount.toFixed(2)}
                                  </span>
                                </p>
                                <p className="text-xs text-gray-500">
                                  {new Date(settlement.date).toLocaleString()}
                                </p>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {showInvitations && (
            <InvitationsPanel
              user={user}
              invitations={invitations}
              onClose={() => setShowInvitations(false)}
              onAccepted={handleRefreshData}
            />
          )}

          {showModifications && (
            <ModificationNotifications
              notifications={modifications}
              onAcknowledge={handleAcknowledgeModification}
              onNavigate={handleNavigateToExpense}
              onClose={() => setShowModifications(false)}
            />
          )}

          {showDeletedExpenses && currentDiary && (
            <DeletedExpenses
              deletedExpenses={currentDiary.deletedExpenses || []}
              people={currentDiary.people}
              events={currentDiary.events}
              currentUserId={user.uid}
              onRestore={handleRestoreExpense}
              onEdit={handleEditAndRestoreExpense}
              onPermanentDelete={handlePermanentDelete}
              onClose={() => setShowDeletedExpenses(false)}
            />
          )}

          {showAddPerson && currentDiary && (
            <AddPersonModal
              diary={currentDiary}
              currentUser={user}
              allDiaries={diaries} 
              onClose={() => setShowAddPerson(false)}
              onAdded={handleRefreshData}
            />
          )}

          {inputDialog && (
            <InputDialog
              title={inputDialog.title}
              label={inputDialog.label}
              placeholder={inputDialog.placeholder}
              type={inputDialog.type}
              onConfirm={(value) => {
                inputDialog.onConfirm(value);
              }}
              onClose={() => setInputDialog(null)}
            />
          )}

          <Analytics />
          <SpeedInsights />
        </div>
      </div>
    </>
  );
}