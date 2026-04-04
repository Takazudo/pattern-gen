import { AuthButton } from './auth-button';
import { AuthProvider } from '../contexts/auth-context.js';

export const meta = { title: 'UI/AuthButton' };

export const SignedOut = () => (
  <AuthProvider>
    <div style={{ position: 'relative', height: 60 }}>
      <AuthButton onOpenUserPage={() => {}} />
    </div>
  </AuthProvider>
);

export const SignedIn = () => (
  <AuthProvider
    mockUser={{
      id: 'user-1',
      email: 'demo@example.com',
      emailVerified: true,
      name: 'Demo User',
      nickname: 'demo',
      pictureUrl: null,
      photoUrl: null,
      createdAt: Date.now(),
    }}
  >
    <div style={{ position: 'relative', height: 60 }}>
      <AuthButton onOpenUserPage={() => console.log('Open user page')} />
    </div>
  </AuthProvider>
);

export const Loading = () => (
  <AuthProvider mockIsLoading>
    <div style={{ position: 'relative', height: 60 }}>
      <AuthButton onOpenUserPage={() => {}} />
    </div>
  </AuthProvider>
);
