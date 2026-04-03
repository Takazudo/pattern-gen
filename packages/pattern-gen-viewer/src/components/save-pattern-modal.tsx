import { useState, useCallback } from 'react';
import { api } from '../lib/api-client.js';
import type { Pattern } from '../lib/api-types.js';

interface SavePatternModalProps {
  patternType: string;
  configJson: string;
  previewDataUrl?: string;
  onClose: () => void;
  onSaved: (pattern: Pattern) => void;
}

export function SavePatternModal({
  patternType,
  configJson,
  previewDataUrl,
  onClose,
  onSaved,
}: SavePatternModalProps) {
  const [name, setName] = useState(`${patternType} pattern`);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const pattern = await api.post<Pattern>('/api/patterns', {
        name: name.trim(),
        configJson,
        patternType,
        previewDataUrl,
      });
      onSaved(pattern);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save pattern');
    } finally {
      setSaving(false);
    }
  }, [name, configJson, patternType, previewDataUrl, onSaved]);

  return (
    <div className="url-modal-overlay" onClick={onClose}>
      <div className="url-modal" onClick={(e) => e.stopPropagation()}>
        <div className="url-modal-title">Save Pattern</div>
        <p className="url-modal-description">
          Give your pattern a name to save it to your account.
        </p>
        <div className="save-pattern-field">
          <label htmlFor="pattern-name-input" className="save-pattern-label">
            Name
          </label>
          <input
            id="pattern-name-input"
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
            <img src={previewDataUrl} alt="Pattern preview" />
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
