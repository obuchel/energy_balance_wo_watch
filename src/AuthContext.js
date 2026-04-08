import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase-config'; // adjust path if needed

// ── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext(null);

/**
 * useAuth — consume auth state anywhere in the tree.
 *
 * Returns:
 *   user       — Firebase Auth user object (or null)
 *   profile    — Firestore /users/{uid} document data (or null)
 *   loading    — true while the initial auth check is in progress
 *   signOut    — call to sign the user out
 *   refreshProfile — re-fetch Firestore profile (call after saving settings)
 */
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};

// ── Provider ─────────────────────────────────────────────────────────────────

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);   // Firebase Auth user
  const [profile, setProfile] = useState(null);   // Firestore profile doc
  const [loading, setLoading] = useState(true);   // waiting for first auth event

  // Fetch Firestore profile for a given uid
  const fetchProfile = async (uid) => {
    try {
      const snap = await getDoc(doc(db, 'users', uid), { source: 'server' });
      setProfile(snap.exists() ? { id: uid, ...snap.data() } : null);
    } catch (err) {
      console.error('AuthContext: failed to fetch profile', err);
      setProfile(null);
    }
  };

  // Re-fetch profile after the user saves settings
  const refreshProfile = async () => {
    if (user) await fetchProfile(user.uid);
  };

  // Single auth observer for the entire app
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        await fetchProfile(firebaseUser.uid);
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signOut = async () => {
    await firebaseSignOut(auth);
    // onAuthStateChanged fires with null — state updates automatically
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
