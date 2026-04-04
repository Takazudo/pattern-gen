import { useCodePanel } from './use-code-panel';

function CodeIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

export default function CodePanelToggle() {
  const [visible, toggle] = useCodePanel();

  return (
    <button
      type="button"
      onClick={toggle}
      className={[
        'transition-colors p-hsp-sm focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2',
        visible ? 'text-accent' : 'text-muted hover:text-fg',
      ].join(' ')}
      aria-label={visible ? 'Hide code panel' : 'Show code panel'}
      aria-pressed={visible}
    >
      <CodeIcon />
    </button>
  );
}
