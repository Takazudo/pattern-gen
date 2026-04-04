import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

// Mirror the real AuthUser type
interface AuthUser {
  id: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  nickname: string | null;
  pictureUrl: string | null;
  photoUrl: string | null;
  createdAt: number;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => void;
  logout: () => Promise<void>;
  updateUser: (user: AuthUser) => void;
  refreshUser: () => Promise<void>;
}

// Default: signed-out state
let mockUser: AuthUser | null = null;
let mockIsLoading = false;

/** Call before rendering a story to configure the auth state */
export function setMockAuth(user: AuthUser | null, isLoading = false) {
  mockUser = user;
  mockIsLoading = isLoading;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  login: () => {},
  logout: async () => {},
  updateUser: () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const value: AuthContextType = {
    user: mockUser,
    isAuthenticated: mockUser !== null,
    isLoading: mockIsLoading,
    login: () => console.log('[mock] login'),
    logout: async () => console.log('[mock] logout'),
    updateUser: () => {},
    refreshUser: async () => {},
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
