import { AuthButton } from './auth-button.js';
import './global-header.css';

interface GlobalHeaderProps {
  onOpenUserPage: () => void;
  onLogoClick: () => void;
}

export function GlobalHeader({ onOpenUserPage, onLogoClick }: GlobalHeaderProps) {
  return (
    <header className="global-header">
      <div className="global-header-left">
        <button
          className="global-header-logo-btn"
          onClick={onLogoClick}
          type="button"
        >
          <img
            src={`${import.meta.env.BASE_URL}takazudo.svg`}
            alt=""
            className="global-header-logo"
          />
          <span className="global-header-app-name">zudo-pattern-gen</span>
        </button>
      </div>
      <div className="global-header-right">
        <a
          className="global-header-link"
          href="https://zudo-pattern-gen.pages.dev/pj/pattern-gen/doc/"
          target="_blank"
          rel="noopener noreferrer"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
          <span>Doc</span>
        </a>
        <AuthButton onOpenUserPage={onOpenUserPage} />
      </div>
    </header>
  );
}
