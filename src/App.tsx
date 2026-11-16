/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from './firebase';
import SignUpForm from './components/SignUpForm';
import CustomerProfile from './components/CustomerProfile';
import AdminPanel from './components/AdminPanel';

import ThemeToggle from './components/ThemeToggle';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const unsubscribeDoc = onSnapshot(doc(db, 'users', currentUser.uid), (docSnap) => {
          if (docSnap.exists()) {
            setRole(docSnap.data().role);
          }
          setLoading(false);
        }, (error) => {
          console.error("Error fetching user role:", error);
          setLoading(false);
        });
        return () => unsubscribeDoc();
      } else {
        setRole(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fdfbf7] dark:bg-stone-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-700"></div>
        <ThemeToggle />
      </div>
    );
  }

  if (!user) return (
    <>
      <SignUpForm />
      <ThemeToggle />
    </>
  );

  // Allow the specific email to act as admin even if role is client (fallback for bootstrapping)
  const isAdmin = role === 'admin' || user.email === 'ferortizcob@gmail.com';

  return (
    <>
      {isAdmin ? <AdminPanel /> : <CustomerProfile uid={user.uid} />}
      <ThemeToggle />
    </>
  );
}
