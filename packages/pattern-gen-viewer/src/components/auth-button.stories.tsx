import { AuthButton } from './auth-button';
import { AuthProvider, setMockAuth } from '../contexts/auth-context.js';

export const meta = { title: 'UI/AuthButton' };

export const SignedOut = () => {
  setMockAuth(null, false);
  return (
    <AuthProvider>
      <div style={{ position: 'relative', height: 60 }}>
        <AuthButton onOpenUserPage={() => {}} />
      </div>
    </AuthProvider>
  );
};

export const SignedIn = () => {
  setMockAuth({
    id: 'user-1',
    email: 'demo@example.com',
    emailVerified: true,
    name: 'Demo User',
    nickname: 'demo',
    pictureUrl: null,
    photoUrl: null,
    createdAt: Date.now(),
  });
  return (
    <AuthProvider>
      <div style={{ position: 'relative', height: 60 }}>
        <AuthButton onOpenUserPage={() => console.log('Open user page')} />
      </div>
    </AuthProvider>
  );
};

export const Loading = () => {
  setMockAuth(null, true);
  return (
    <AuthProvider>
      <div style={{ position: 'relative', height: 60 }}>
        <AuthButton onOpenUserPage={() => {}} />
      </div>
    </AuthProvider>
  );
};
