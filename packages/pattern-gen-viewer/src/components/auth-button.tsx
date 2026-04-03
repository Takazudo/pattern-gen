import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/auth-context.js';

interface AuthButtonProps {
  onOpenUserPage: () => void;
}

export function AuthButton({ onOpenUserPage }: AuthButtonProps) {
  const { user, isAuthenticated, isLoading, login, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open, handleClickOutside]);

  if (isLoading) return null;

  if (!isAuthenticated) {
    return (
      <button className="auth-button auth-sign-in" onClick={login}>
        Sign In
      </button>
    );
  }

  return (
    <div className="auth-button-wrapper" ref={menuRef}>
      <button className="auth-button auth-user-btn" onClick={() => setOpen((v) => !v)}>
        {(user?.photoUrl || user?.pictureUrl) ? (
          <img src={user.photoUrl || user.pictureUrl!} alt="" className="auth-avatar" />
        ) : (
          <span className="auth-avatar-placeholder">
            {user?.name?.charAt(0).toUpperCase() ?? '?'}
          </span>
        )}
        <span className="auth-user-name">{user?.nickname ?? user?.name ?? 'User'}</span>
      </button>
      {open && (
        <div className="auth-dropdown">
          <button
            className="auth-dropdown-item"
            onClick={() => {
              setOpen(false);
              onOpenUserPage();
            }}
          >
            My Page
          </button>
          <div className="auth-dropdown-divider" />
          <button
            className="auth-dropdown-item auth-dropdown-signout"
            onClick={() => {
              setOpen(false);
              logout();
            }}
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
