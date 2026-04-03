import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api-client.js';
import type { Pattern, PatternsResponse } from '../lib/api-types.js';

interface MyPatternsProps {
  onClose: () => void;
  onLoadPattern: (configJson: string, patternType: string) => void;
}

const PAGE_SIZE = 20;

export function MyPatterns({ onClose, onLoadPattern }: MyPatternsProps) {
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchPatterns = useCallback(async (offset = 0, append = false) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<PatternsResponse>(
        `/api/patterns?limit=${PAGE_SIZE}&offset=${offset}`,
      );
      setPatterns((prev) => (append ? [...prev, ...data.patterns] : data.patterns));
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load patterns');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPatterns();
  }, [fetchPatterns]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm('Delete this pattern?')) return;
      setDeletingId(id);
      try {
        await api.delete(`/api/patterns/${id}`);
        setPatterns((prev) => prev.filter((p) => p.id !== id));
        setTotal((prev) => prev - 1);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete pattern');
      } finally {
        setDeletingId(null);
      }
    },
    [],
  );

  const handleLoadMore = useCallback(() => {
    fetchPatterns(patterns.length, true);
  }, [fetchPatterns, patterns.length]);

  return (
    <div className="url-modal-overlay" onClick={onClose}>
      <div className="gallery-modal" onClick={(e) => e.stopPropagation()}>
        <div className="gallery-header">
          <div className="url-modal-title">My Patterns</div>
          <button className="btn gallery-close-btn" onClick={onClose}>
            Close
          </button>
        </div>

        {error && <div className="save-pattern-error">{error}</div>}

        {loading && patterns.length === 0 ? (
          <div className="gallery-loading">
            <div className="processing-spinner" />
            <span>Loading...</span>
          </div>
        ) : patterns.length === 0 ? (
          <div className="gallery-empty">No saved patterns yet.</div>
        ) : (
          <>
            <div className="gallery-grid">
              {patterns.map((p) => (
                <div key={p.id} className="gallery-card">
                  <div
                    className="gallery-card-preview"
                    onClick={() => {
                      onLoadPattern(p.config_json, p.pattern_type);
                      onClose();
                    }}
                  >
                    {p.preview_r2_key ? (
                      <img
                        src={`/api/patterns/${p.id}/preview`}
                        alt={p.name}
                        className="gallery-card-img"
                      />
                    ) : (
                      <div className="gallery-card-placeholder">
                        {p.pattern_type}
                      </div>
                    )}
                  </div>
                  <div className="gallery-card-info">
                    <div className="gallery-card-name" title={p.name}>
                      {p.name}
                    </div>
                    <div className="gallery-card-meta">
                      <span>{p.pattern_type}</span>
                      <span>{new Date(p.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <button
                    className="gallery-card-delete"
                    onClick={() => handleDelete(p.id)}
                    disabled={deletingId === p.id}
                    title="Delete"
                  >
                    {deletingId === p.id ? '...' : '\u00d7'}
                  </button>
                </div>
              ))}
            </div>
            {patterns.length < total && (
              <button
                className="btn gallery-load-more"
                onClick={handleLoadMore}
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Load More'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
