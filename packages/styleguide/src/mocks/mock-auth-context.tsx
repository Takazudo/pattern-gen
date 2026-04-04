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

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  login: () => {},
  logout: async () => {},
  updateUser: () => {},
  refreshUser: async () => {},
});

interface AuthProviderProps {
  children: ReactNode;
  /** Mock user for stories. Omit or pass null for signed-out state. */
  mockUser?: AuthUser | null;
  /** Mock loading state for stories. */
  mockIsLoading?: boolean;
}

/**
 * Mock AuthProvider that accepts user/loading as props.
 * Stories pass mock data declaratively instead of via mutable globals.
 */
export function AuthProvider({
  children,
  mockUser = null,
  mockIsLoading = false,
}: AuthProviderProps) {
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
