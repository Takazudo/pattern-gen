import { useState, useEffect, useCallback, useRef } from 'react';
import { api, fetchBlob } from '../lib/api-client.js';
import type { FileEntry, FilesResponse } from '../lib/api-types.js';

interface MyFilesProps {
  onClose: () => void;
  onUseAsLayer: (file: File) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MyFiles({ onClose, onUseAsLayer }: MyFilesProps) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<FilesResponse>('/api/files');
      setFiles(data.files);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleUpload = useCallback(
    async (file: File) => {
      setUploading(true);
      setUploadProgress(`Uploading ${file.name}...`);
      setError(null);
      try {
        const entry = await api.upload<FileEntry>('/api/files', file);
        setFiles((prev) => [entry, ...prev]);
        setTotal((prev) => prev + 1);
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

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Delete this file?')) return;
    setDeletingId(id);
    try {
      await api.delete(`/api/files/${id}`);
      setFiles((prev) => prev.filter((f) => f.id !== id));
      setTotal((prev) => prev - 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete file');
    } finally {
      setDeletingId(null);
    }
  }, []);

  const handleUseFile = useCallback(
    async (entry: FileEntry) => {
      try {
        const blob = await fetchBlob(`/api/files/${entry.id}/download`);
        const file = new File([blob], entry.filename, { type: entry.content_type });
        onUseAsLayer(file);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to download file');
      }
    },
    [onUseAsLayer, onClose],
  );

  return (
    <div className="url-modal-overlay" onClick={onClose}>
      <div className="gallery-modal" onClick={(e) => e.stopPropagation()}>
        <div className="gallery-header">
          <div className="url-modal-title">My Files</div>
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

        {loading && files.length === 0 ? (
          <div className="gallery-loading">
            <div className="processing-spinner" />
            <span>Loading...</span>
          </div>
        ) : files.length === 0 ? (
          <div className="gallery-empty">No uploaded files yet.</div>
        ) : (
          <div className="gallery-grid">
            {files.map((f) => (
              <div key={f.id} className="gallery-card">
                <div
                  className="gallery-card-preview"
                  onClick={() => handleUseFile(f)}
                  title="Use as image layer"
                >
                  {f.content_type.startsWith('image/') ? (
                    <img
                      src={`/api/files/${f.id}/download`}
                      alt={f.filename}
                      className="gallery-card-img"
                    />
                  ) : (
                    <div className="gallery-card-placeholder">
                      {f.content_type.split('/')[1] ?? 'file'}
                    </div>
                  )}
                </div>
                <div className="gallery-card-info">
                  <div className="gallery-card-name" title={f.filename}>
                    {f.filename}
                  </div>
                  <div className="gallery-card-meta">
                    <span>{formatSize(f.size_bytes)}</span>
                    <span>{new Date(f.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <button
                  className="gallery-card-delete"
                  onClick={() => handleDelete(f.id)}
                  disabled={deletingId === f.id}
                  title="Delete"
                >
                  {deletingId === f.id ? '...' : '\u00d7'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
