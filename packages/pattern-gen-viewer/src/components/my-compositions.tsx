import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api-client.js';
import type { Composition, CompositionsResponse } from '../lib/api-types.js';

interface MyCompositionsProps {
  onClose: () => void;
  onLoadComposition: (configJson: string, patternType: string) => void;
}

const PAGE_SIZE = 20;

export function MyCompositions({ onClose, onLoadComposition }: MyCompositionsProps) {
  const [compositions, setCompositions] = useState<Composition[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchCompositions = useCallback(async (offset = 0, append = false) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<CompositionsResponse>(
        `/api/compositions?limit=${PAGE_SIZE}&offset=${offset}`,
      );
      setCompositions((prev) => (append ? [...prev, ...data.items] : data.items));
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load compositions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompositions();
  }, [fetchCompositions]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm('Delete this composition?')) return;
      setDeletingId(id);
      try {
        await api.delete(`/api/compositions/${id}`);
        setCompositions((prev) => prev.filter((p) => p.id !== id));
        setTotal((prev) => prev - 1);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete composition');
      } finally {
        setDeletingId(null);
      }
    },
    [],
  );

  const handleLoadMore = useCallback(() => {
    fetchCompositions(compositions.length, true);
  }, [fetchCompositions, compositions.length]);

  return (
    <div className="url-modal-overlay" onClick={onClose}>
      <div className="gallery-modal" onClick={(e) => e.stopPropagation()}>
        <div className="gallery-header">
          <div className="url-modal-title">My Compositions</div>
          <button className="btn gallery-close-btn" onClick={onClose}>
            Close
          </button>
        </div>

        {error && <div className="save-pattern-error">{error}</div>}

        {loading && compositions.length === 0 ? (
          <div className="gallery-loading">
            <div className="processing-spinner" />
            <span>Loading...</span>
          </div>
        ) : compositions.length === 0 ? (
          <div className="gallery-empty">No saved compositions yet.</div>
        ) : (
          <>
            <div className="gallery-grid">
              {compositions.map((p) => (
                <div key={p.id} className="gallery-card">
                  <div
                    className="gallery-card-preview"
                    onClick={() => {
                      onLoadComposition(p.configJson, p.patternType);
                      onClose();
                    }}
                  >
                    {p.previewR2Key ? (
                      <img
                        src={`/api/compositions/${p.id}/preview`}
                        alt={p.name}
                        className="gallery-card-img"
                      />
                    ) : (
                      <div className="gallery-card-placeholder">
                        {p.patternType}
                      </div>
                    )}
                  </div>
                  <div className="gallery-card-info">
                    <div className="gallery-card-name" title={p.name}>
                      {p.name}
                    </div>
                    <div className="gallery-card-meta">
                      <span>{p.patternType}</span>
                      <span>{new Date(p.createdAt).toLocaleDateString()}</span>
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
            {compositions.length < total && (
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
