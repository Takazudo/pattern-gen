import { useState, useCallback } from 'react';
import { api } from '../lib/api-client.js';
import type { Composition } from '../lib/api-types.js';

interface SaveCompositionModalProps {
  patternType: string;
  configJson: string;
  previewDataUrl?: string;
  onClose: () => void;
  onSaved: (composition: Composition) => void;
}

export function SaveCompositionModal({
  patternType,
  configJson,
  previewDataUrl,
  onClose,
  onSaved,
}: SaveCompositionModalProps) {
  const [name, setName] = useState(`${patternType} composition`);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const composition = await api.post<Composition>('/api/compositions', {
        name: name.trim(),
        configJson,
        patternType,
        previewDataUrl,
      });
      onSaved(composition);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save composition');
    } finally {
      setSaving(false);
    }
  }, [name, configJson, patternType, previewDataUrl, onSaved]);

  return (
    <div className="url-modal-overlay" onClick={onClose}>
      <div className="url-modal" onClick={(e) => e.stopPropagation()}>
        <div className="url-modal-title">Save Composition</div>
        <p className="url-modal-description">
          Give your composition a name to save it to your account.
        </p>
        <div className="save-pattern-field">
          <label htmlFor="composition-name-input" className="save-pattern-label">
            Name
          </label>
          <input
            id="composition-name-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
            }}
            autoFocus
          />
        </div>
        {previewDataUrl && (
          <div className="save-pattern-preview">
            <img src={previewDataUrl} alt="Composition preview" />
          </div>
        )}
        {error && <div className="save-pattern-error">{error}</div>}
        <div className="url-modal-actions">
          <button
            className="btn url-modal-copy-btn"
            onClick={handleSave}
            disabled={saving || !name.trim()}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button className="btn url-modal-close-btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
