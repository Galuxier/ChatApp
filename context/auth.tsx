// Updated context/auth.tsx
import React, { createContext, useState, useEffect, useContext } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../firebase';

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Validate auth before subscribing
    if (!auth) {
      console.error("Auth is not initialized in AuthProvider");
      setIsLoading(false);
      return () => {};
    }

    console.log("Setting up auth state listener");
    
    // Set up the auth state listener
    const unsubscribe = onAuthStateChanged(auth, (authUser) => {
      console.log("Auth state changed", authUser ? "User logged in" : "No user");
      setUser(authUser);
      setIsLoading(false);
    }, (error) => {
      console.error("Auth state change error:", error);
      setIsLoading(false);
    });

    // Return the unsubscribe function to clean up
    return () => {
      console.log("Cleaning up auth state listener");
      unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);