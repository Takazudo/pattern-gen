import { CollapsibleSection } from './collapsible-section';

export const meta = { title: 'UI/CollapsibleSection' };

export const Default = () => (
  <CollapsibleSection title="Section Title">
    <p style={{ color: 'var(--color-fg-muted)', fontSize: 13 }}>
      This is the collapsed content. Click the header to toggle.
    </p>
  </CollapsibleSection>
);

export const InitiallyOpen = () => (
  <CollapsibleSection title="Open Section" defaultOpen>
    <p style={{ color: 'var(--color-fg-muted)', fontSize: 13 }}>
      This section starts expanded by default.
    </p>
  </CollapsibleSection>
);

export const MultipleSections = () => (
  <div style={{ width: 280, background: 'var(--color-surface-glass)', padding: 20, borderRadius: 12 }}>
    <CollapsibleSection title="Color Tweaks" defaultOpen>
      <p style={{ color: 'var(--color-fg-muted)', fontSize: 12 }}>Hue, saturation, lightness controls</p>
    </CollapsibleSection>
    <CollapsibleSection title="View Transform">
      <p style={{ color: 'var(--color-fg-muted)', fontSize: 12 }}>Zoom, contrast, brightness</p>
    </CollapsibleSection>
    <CollapsibleSection title="Image Overlay">
      <p style={{ color: 'var(--color-fg-muted)', fontSize: 12 }}>Layer import and blending</p>
    </CollapsibleSection>
  </div>
);
