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
  <AuthProvider>
    <div style={{ position: 'relative', height: 60 }}>
      <AuthButton onOpenUserPage={() => console.log('Open user page')} />
    </div>
  </AuthProvider>
);

export const Loading = () => (
  <AuthProvider>
    <div style={{ position: 'relative', height: 60 }}>
      <AuthButton onOpenUserPage={() => {}} />
    </div>
  </AuthProvider>
);
