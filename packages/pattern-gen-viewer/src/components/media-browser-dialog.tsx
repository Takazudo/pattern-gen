import { useState, useEffect, useCallback, useRef } from 'react';
import { api, fetchBlob } from '../lib/api-client.js';
import type { FileEntry, FilesResponse } from '../lib/api-types.js';

interface MediaBrowserDialogProps {
  onClose: () => void;
  onSelect: (file: File) => void;
}

const PAGE_SIZE = 20;

export function MediaBrowserDialog({ onClose, onSelect }: MediaBrowserDialogProps) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchFiles = useCallback(async (offset = 0, append = false) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<FilesResponse>(
        `/api/files?limit=${PAGE_SIZE}&offset=${offset}`,
      );
      setFiles((prev) => (append ? [...prev, ...data.items] : data.items));
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

  const handleSelect = useCallback(
    async (entry: FileEntry) => {
      try {
        const blob = await fetchBlob(`/api/files/${entry.id}/download`);
        const file = new File([blob], entry.filename, { type: entry.contentType });
        onSelect(file);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to download file');
      }
    },
    [onSelect, onClose],
  );

  const handleUpload = useCallback(
    async (file: File) => {
      setUploading(true);
      setError(null);
      try {
        const entry = await api.upload<FileEntry>('/api/files', file);
        setFiles((prev) => [entry, ...prev]);
        setTotal((prev) => prev + 1);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
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

  const handleLoadMore = useCallback(() => {
    fetchFiles(files.length, true);
  }, [fetchFiles, files.length]);

  const filteredFiles = filter
    ? files.filter((f) => f.filename.toLowerCase().includes(filter.toLowerCase()))
    : files;

  return (
    <div className="url-modal-overlay" onClick={onClose}>
      <div className="gallery-modal media-browser-modal" onClick={(e) => e.stopPropagation()}>
        <div className="gallery-header">
          <div className="url-modal-title">My Files</div>
          <div className="gallery-header-actions">
            <button
              className="btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? 'Uploading...' : 'Upload'}
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

        <div className="media-browser-filter">
          <input
            type="text"
            placeholder="Filter by filename..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>

        {error && <div className="save-pattern-error">{error}</div>}

        {loading && files.length === 0 ? (
          <div className="gallery-loading">
            <div className="processing-spinner" />
            <span>Loading...</span>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="gallery-empty">
            {files.length === 0 ? 'No uploaded images yet.' : 'No matching files.'}
          </div>
        ) : (
          <>
            <div className="gallery-grid">
              {filteredFiles.map((f) => (
                <div key={f.id} className="gallery-card">
                  <div
                    className="gallery-card-preview"
                    onClick={() => handleSelect(f)}
                    title="Select image"
                  >
                    {f.contentType.startsWith('image/') ? (
                      <img
                        src={`/api/files/${f.id}/download`}
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
                  </div>
                </div>
              ))}
            </div>
            {files.length < total && (
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
