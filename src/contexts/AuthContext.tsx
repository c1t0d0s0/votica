import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  User,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from '../lib/firebase';
import { useTranslation } from './LanguageContext';

export interface AppUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  isAnonymous?: boolean;
  isMock?: boolean;
}

interface AuthContextType {
  currentUser: AppUser | null;
  loading: boolean;
  isFirebaseConfigured: boolean;
  signInWithGoogle: () => Promise<void>;
  signInAsDemoUser: (name?: string) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_USER_KEY = 'votica_demo_user';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const { t } = useTranslation();

  // Check demo user in localStorage if Firebase is not configured or demo mode
  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      try {
        const savedDemo = localStorage.getItem(DEMO_USER_KEY);
        if (savedDemo) {
          setCurrentUser(JSON.parse(savedDemo));
        }
      } catch (e) {
        console.error('Failed to load demo user:', e);
      }
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: User | null) => {
      if (firebaseUser) {
        setCurrentUser({
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName || t('common.user'),
          email: firebaseUser.email,
          photoURL: firebaseUser.photoURL,
          isAnonymous: firebaseUser.isAnonymous,
          isMock: false,
        });
      } else {
        // Fallback to check if demo user was active
        const savedDemo = localStorage.getItem(DEMO_USER_KEY);
        if (savedDemo) {
          setCurrentUser(JSON.parse(savedDemo));
        } else {
          setCurrentUser(null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [t]);

  const signInWithGoogle = async () => {
    if (!isFirebaseConfigured || !auth || !googleProvider) {
      // Prompt demo sign-in
      signInAsDemoUser(t('common.demoUser'));
      return;
    }

    try {
      setLoading(true);
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error('Google Sign-in failed:', error);
      // If popup blocked or cancelled
      if (error.code !== 'auth/popup-closed-by-user') {
        throw error;
      }
    } finally {
      setLoading(false);
    }
  };

  const signInAsDemoUser = (name?: string) => {
    const demoUid = 'demo_user_' + Math.random().toString(36).substring(2, 8);
    const demoUser: AppUser = {
      uid: demoUid,
      displayName: name || t('common.demoUser'),
      email: `${demoUid}@example.com`,
      photoURL: `https://api.dicebear.com/7.x/bottts/svg?seed=${demoUid}`,
      isMock: true,
    };
    localStorage.setItem(DEMO_USER_KEY, JSON.stringify(demoUser));
    setCurrentUser(demoUser);
  };

  const logout = async () => {
    localStorage.removeItem(DEMO_USER_KEY);
    if (auth) {
      try {
        await signOut(auth);
      } catch (e) {
        console.error('Error signing out:', e);
      }
    }
    setCurrentUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        loading,
        isFirebaseConfigured,
        signInWithGoogle,
        signInAsDemoUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
