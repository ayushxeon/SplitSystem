import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { firebaseService } from '../services/firebaseService';
import type { Diary } from '../types/types';

export function DiaryInvite() {
  const { diaryId } = useParams<{ diaryId: string }>();
  const navigate = useNavigate();
  const [diary, setDiary] = useState<Diary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [userStatus, setUserStatus] = useState<'not-logged-in' | 'member' | 'pending-invite' | 'guest' | 'needs-request'>('not-logged-in');
  const [requesting, setRequesting] = useState(false);

  // Load diary
  useEffect(() => {
    const loadDiary = async () => {
      if (!diaryId) {
        setError('Invalid invite link');
        setLoading(false);
        return;
      }

      try {
        const diaryDoc = await getDoc(doc(db, 'diaries', diaryId));
        if (diaryDoc.exists()) {
          setDiary(diaryDoc.data() as Diary);
        } else {
          setError('Diary not found');
        }
      } catch (err) {
        console.error('Error loading diary:', err);
        setError('Failed to load diary');
      } finally {
        setLoading(false);
      }
    };

    loadDiary();
  }, [diaryId]);

  // Check user status
  useEffect(() => {
    if (!diary || !diaryId) return;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUserStatus('not-logged-in');
        setUser(null);
        return;
      }

      setUser(firebaseUser);

      try {
        // Check 1: Already a member?
        if (diary.members.includes(firebaseUser.uid)) {
          navigate('/?diary=' + diaryId);
          return;
        }

        // Check 2: Has pending invitation?
        const invitations = await firebaseService.loadInvitations(firebaseUser.email!);
        const existingInvite = invitations.find(
          (inv) => inv.diaryId === diaryId && inv.status === 'pending'
        );

        if (existingInvite) {
          navigate('/?showInvites=true');
          return;
        }

        // Check 3: Added as unregistered guest?
        const guestEntry = Object.entries(diary.people).find(
          ([_, person]) =>
            person.email?.toLowerCase() === firebaseUser.email?.toLowerCase() &&
            person.status === 'unregistered'
        );

        if (guestEntry) {
          setUserStatus('guest');
          return;
        }

        // Check 4: Already sent join request?
        const existingRequest = diary.joinRequests?.find(
          (r) => r.userId === firebaseUser.uid && r.status === 'pending'
        );

        if (existingRequest) {
          setUserStatus('pending-invite');
          return;
        }

        // Needs to request
        setUserStatus('needs-request');
      } catch (error: any) {
        console.error('Error checking user status:', error);
        setError(error.message);
      }
    });

    return () => unsubscribe();
  }, [diary, diaryId, navigate]);

  const handleAcceptAsGuest = async () => {
    if (!user || !diary || !diaryId) return;

    setRequesting(true);
    try {
      // Find guest entry
      const guestEntry = Object.entries(diary.people).find(
        ([_, person]) =>
          person.email?.toLowerCase() === user.email?.toLowerCase() &&
          person.status === 'unregistered'
      );

      if (!guestEntry) {
        throw new Error('Guest entry not found');
      }

      const [personId] = guestEntry;

      // Create invitation
      await firebaseService.createInvitationForGuest(
        diaryId,
        personId,
        user.email!,
        diary.name
      );

      // Show invitations panel
      navigate('/?showInvites=true');
    } catch (error: any) {
      alert(error.message);
      setRequesting(false);
    }
  };

  const handleRequestToJoin = async () => {
    if (!user || !diaryId) return;

    setRequesting(true);
    try {
      await firebaseService.requestToJoin(diaryId, {
        uid: user.uid,
        email: user.email!,
        displayName: user.displayName || 'Unknown User',
      });

      alert('✓ Join request sent! The diary owner will review your request.');
      navigate('/');
    } catch (error: any) {
      alert(error.message);
      setRequesting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading invitation...</p>
        </div>
      </div>
    );
  }

  if (error || !diary) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">❌</span>
          </div>
          <h2 className="text-2xl font-bold text-red-800 mb-2">Oops!</h2>
          <p className="text-red-600 mb-6">{error || 'Diary not found'}</p>
          <button
            onClick={() => navigate('/')}
            className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition font-medium"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  // Not logged in
  if (userStatus === 'not-logged-in') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">💰</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">You're Invited!</h1>
            <p className="text-gray-600">
              Join <strong className="text-indigo-600">{diary.name}</strong> on SplitSync
            </p>
          </div>

          <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl p-4 mb-6 border border-indigo-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Diary</span>
              <span className="font-semibold text-gray-800">{diary.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Members</span>
              <span className="font-semibold text-gray-800">
                {Object.keys(diary.people).length} people
              </span>
            </div>
          </div>

          <button
            onClick={() => navigate('/')}
            className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 text-white py-3 rounded-lg font-semibold hover:from-indigo-700 hover:to-blue-700 transition shadow-lg"
          >
            Sign In to Continue
          </button>

          <p className="text-xs text-gray-500 text-center mt-4">
            Sign in with Google to accept this invitation
          </p>
        </div>
      </div>
    );
  }

  // Already sent join request
  if (userStatus === 'pending-invite') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">⏳</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Request Pending</h2>
          <p className="text-gray-600 mb-6">
            You've already requested to join <strong>{diary.name}</strong>.
            The diary owner will review your request soon.
          </p>
          <button
            onClick={() => navigate('/')}
            className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition font-medium"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  // User was added as guest
  if (userStatus === 'guest') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">🎉</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">You're Invited!</h1>
            <p className="text-gray-600">
              You've been added to <strong className="text-green-600">{diary.name}</strong>
            </p>
          </div>

          <div className="bg-green-50 rounded-xl p-4 mb-6 border border-green-200">
            <p className="text-sm text-green-800 text-center">
              Click below to accept the invitation and join the diary
            </p>
          </div>

          <button
            onClick={handleAcceptAsGuest}
            disabled={requesting}
            className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-3 rounded-lg font-semibold hover:from-green-700 hover:to-emerald-700 transition shadow-lg disabled:opacity-50"
          >
            {requesting ? 'Processing...' : 'Accept Invitation'}
          </button>
        </div>
      </div>
    );
  }

  // Needs to request to join
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">💰</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Join {diary.name}?</h1>
          <p className="text-gray-600">Request to join this expense diary</p>
        </div>

        <div className="bg-indigo-50 rounded-xl p-4 mb-6 border border-indigo-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Diary</span>
            <span className="font-semibold text-gray-800">{diary.name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Members</span>
            <span className="font-semibold text-gray-800">
              {Object.keys(diary.people).length} people
            </span>
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-6">
          <p className="text-sm text-yellow-800">
            <strong>Note:</strong> The diary owner will need to approve your request before you can join.
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleRequestToJoin}
            disabled={requesting}
            className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 text-white py-3 rounded-lg font-semibold hover:from-indigo-700 hover:to-blue-700 transition shadow-lg disabled:opacity-50"
          >
            {requesting ? 'Sending Request...' : 'Request to Join'}
          </button>

          <button
            onClick={() => navigate('/')}
            className="w-full bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}