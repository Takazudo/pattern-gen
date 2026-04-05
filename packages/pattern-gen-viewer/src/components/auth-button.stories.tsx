import { AuthButton } from './auth-button';

export const meta = { title: 'UI/AuthButton' };

export const SignedOut = () => (
  <div style={{ position: 'relative', height: 60 }}>
    <AuthButton onOpenUserPage={() => {}} />
  </div>
);

export const SignedIn = () => (
  <div style={{ position: 'relative', height: 60 }}>
    <AuthButton onOpenUserPage={() => console.log('Open user page')} />
  </div>
);

export const Loading = () => (
  <div style={{ position: 'relative', height: 60 }}>
    <AuthButton onOpenUserPage={() => {}} />
  </div>
);
