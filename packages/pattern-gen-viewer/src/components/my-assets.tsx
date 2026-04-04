import { useState, useEffect, useCallback, useRef } from 'react';
import { api, fetchBlob } from '../lib/api-client.js';
import type { AssetEntry, AssetsResponse } from '../lib/api-types.js';
import { ConfirmDialog } from './confirm-dialog.js';

interface MyAssetsProps {
  onClose: () => void;
  onUseAsLayer: (file: File) => void;
  onToast?: (msg: string) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MyAssets({ onClose, onUseAsLayer, onToast }: MyAssetsProps) {
  const [assets, setAssets] = useState<AssetEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AssetEntry | null>(null);
  const [notesLocal, setNotesLocal] = useState<Record<string, string>>({});
  const [savingNotesId, setSavingNotesId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<AssetsResponse>('/api/assets');
      setAssets(data.items);
      setTotal(data.total);
      // Initialize local notes state from fetched assets
      const notes: Record<string, string> = {};
      for (const a of data.items) {
        notes[a.id] = a.notes ?? '';
      }
      setNotesLocal(notes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const handleUpload = useCallback(
    async (file: File) => {
      setUploading(true);
      setUploadProgress(`Uploading ${file.name}...`);
      setError(null);
      try {
        const entry = await api.upload<AssetEntry>('/api/assets', file);
        setAssets((prev) => [entry, ...prev]);
        setTotal((prev) => prev + 1);
        setNotesLocal((prev) => ({ ...prev, [entry.id]: entry.notes ?? '' }));
        setUploadProgress(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
        setUploadProgress(null);
      } finally {
        setUploading(false);
      }
    },
    [],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleUpload(file);
      e.target.value = '';
    },
    [handleUpload],
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeletingId(id);
    setDeleteTarget(null);
    try {
      await api.delete(`/api/assets/${id}`);
      setAssets((prev) => prev.filter((f) => f.id !== id));
      setTotal((prev) => prev - 1);
      onToast?.('Asset deleted');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete asset');
    } finally {
      setDeletingId(null);
    }
  }, [deleteTarget, onToast]);

  const handleDuplicate = useCallback(
    async (entry: AssetEntry) => {
      setDuplicatingId(entry.id);
      setError(null);
      try {
        const blob = await fetchBlob(`/api/assets/${entry.id}/download`);
        const newFilename = `Copy of ${entry.filename}`;
        const file = new File([blob], newFilename, { type: entry.contentType });
        const newEntry = await api.upload<AssetEntry>('/api/assets', file);
        setAssets((prev) => [newEntry, ...prev]);
        setTotal((prev) => prev + 1);
        setNotesLocal((prev) => ({ ...prev, [newEntry.id]: newEntry.notes ?? '' }));
        onToast?.('Asset duplicated');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to duplicate asset');
      } finally {
        setDuplicatingId(null);
      }
    },
    [onToast],
  );

  const handleNotesSave = useCallback(
    async (id: string) => {
      const value = notesLocal[id] ?? '';
      const asset = assets.find((a) => a.id === id);
      // Skip if unchanged
      if (asset && (asset.notes ?? '') === value) return;

      setSavingNotesId(id);
      try {
        const updated = await api.patch<AssetEntry>(`/api/assets/${id}`, {
          notes: value || null,
        });
        setAssets((prev) => prev.map((a) => (a.id === id ? updated : a)));
        onToast?.('Note saved');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save note');
      } finally {
        setSavingNotesId(null);
      }
    },
    [notesLocal, assets, onToast],
  );

  const handleUseAsset = useCallback(
    async (entry: AssetEntry) => {
      try {
        const blob = await fetchBlob(`/api/assets/${entry.id}/download`);
        const file = new File([blob], entry.filename, { type: entry.contentType });
        onUseAsLayer(file);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to download asset');
      }
    },
    [onUseAsLayer, onClose],
  );

  return (
    <div className="url-modal-overlay" onClick={onClose}>
      <div className="gallery-modal" onClick={(e) => e.stopPropagation()}>
        <div className="gallery-header">
          <div className="url-modal-title">My Assets</div>
          <div className="gallery-header-actions">
            <button
              className="btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              Upload
            </button>
            <button className="btn gallery-close-btn" onClick={onClose}>
              Close
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            hidden
          />
        </div>

        {uploadProgress && (
          <div className="gallery-upload-status">{uploadProgress}</div>
        )}
        {error && <div className="save-pattern-error">{error}</div>}

        {loading && assets.length === 0 ? (
          <div className="gallery-loading">
            <div className="processing-spinner" />
            <span>Loading...</span>
          </div>
        ) : assets.length === 0 ? (
          <div className="gallery-empty">No uploaded assets yet.</div>
        ) : (
          <div className="gallery-grid">
            {assets.map((f) => (
              <div key={f.id} className="gallery-card">
                <div
                  className="gallery-card-preview"
                  onClick={() => handleUseAsset(f)}
                  title="Use as image layer"
                >
                  {f.contentType.startsWith('image/') ? (
                    <img
                      src={`/api/assets/${f.id}/download`}
                      alt={f.filename}
                      className="gallery-card-img"
                    />
                  ) : (
                    <div className="gallery-card-placeholder">
                      {f.contentType.split('/')[1] ?? 'file'}
                    </div>
                  )}
                </div>
                <div className="gallery-card-info">
                  <div className="gallery-card-name" title={f.filename}>
                    {f.filename}
                  </div>
                  <div className="gallery-card-meta">
                    <span>{formatSize(f.sizeBytes)}</span>
                    <span>{new Date(f.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="asset-notes">
                  <input
                    type="text"
                    className="asset-notes-input"
                    placeholder="Add a note..."
                    value={notesLocal[f.id] ?? ''}
                    onChange={(e) =>
                      setNotesLocal((prev) => ({ ...prev, [f.id]: e.target.value }))
                    }
                    onBlur={() => handleNotesSave(f.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    disabled={savingNotesId === f.id}
                  />
                </div>
                <div className="gallery-card-actions">
                  <button
                    className="btn gallery-card-action-btn"
                    onClick={() => handleDuplicate(f)}
                    disabled={duplicatingId === f.id}
                  >
                    {duplicatingId === f.id ? 'Duplicating...' : 'Duplicate'}
                  </button>
                  <button
                    className="btn gallery-card-action-btn gallery-card-action-btn-danger"
                    onClick={() => setDeleteTarget(f)}
                    disabled={deletingId === f.id}
                  >
                    {deletingId === f.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {deleteTarget && (
        <ConfirmDialog
          title="Delete Asset"
          message={`Are you sure you want to delete "${deleteTarget.filename}" (${formatSize(deleteTarget.sizeBytes)})?`}
          confirmLabel="Delete"
          confirmVariant="danger"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        >
          {deleteTarget.contentType.startsWith('image/') && (
            <div className="confirm-dialog-preview">
              <img
                src={`/api/assets/${deleteTarget.id}/download`}
                alt={deleteTarget.filename}
                className="confirm-dialog-preview-img"
              />
            </div>
          )}
        </ConfirmDialog>
      )}
    </div>
  );
}
