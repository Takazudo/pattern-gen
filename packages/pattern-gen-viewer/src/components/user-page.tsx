import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/auth-context.js';
import { api, fetchBlob } from '../lib/api-client.js';
import type {
  AuthUser,
  Pattern,
  PatternsResponse,
  FileEntry,
  FilesResponse,
  TrashResponse,
} from '../lib/api-types.js';
import { ImageEnlargeModal } from './image-enlarge-modal.js';

interface UserPageProps {
  onClose: () => void;
  onLoadPattern: (configJson: string, patternType: string) => void;
  onUseAsLayer: (file: File) => void;
}

type Tab = 'patterns' | 'images';

const PAGE_SIZE = 20;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UserPage({ onClose, onLoadPattern, onUseAsLayer }: UserPageProps) {
  const { user, updateUser } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('patterns');

  // Profile editing — sync from user when it changes (e.g. after photo upload returns updated AuthUser)
  const [nickname, setNickname] = useState(user?.nickname ?? user?.name ?? '');
  const [editingNickname, setEditingNickname] = useState(false);
  useEffect(() => {
    if (!editingNickname) {
      setNickname(user?.nickname ?? user?.name ?? '');
    }
  }, [user, editingNickname]);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Patterns tab
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [patternsTotal, setPatternsTotal] = useState(0);
  const [patternsLoading, setPatternsLoading] = useState(true);
  const [trashedPatterns, setTrashedPatterns] = useState<Pattern[]>([]);
  const [showPatternTrash, setShowPatternTrash] = useState(false);

  // Files tab
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [filesTotal, setFilesTotal] = useState(0);
  const [filesLoading, setFilesLoading] = useState(true);
  const [trashedFiles, setTrashedFiles] = useState<FileEntry[]>([]);
  const [showFileTrash, setShowFileTrash] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Shared
  const [error, setError] = useState<string | null>(null);
  // Separate action IDs per tab to avoid cross-tab state bleed
  const [patternActionId, setPatternActionId] = useState<string | null>(null);
  const [fileActionId, setFileActionId] = useState<string | null>(null);

  // Image enlarge
  const [enlargeImages, setEnlargeImages] = useState<{ src: string; label: string }[] | null>(null);
  const [enlargeIndex, setEnlargeIndex] = useState(0);

  // --- Profile ---
  const handleNicknameSave = useCallback(async () => {
    setEditingNickname(false);
    const trimmed = nickname.trim();
    const currentNickname = user?.nickname ?? user?.name ?? '';
    if (!trimmed || trimmed === currentNickname) return;
    try {
      const updated = await api.patch<AuthUser>('/api/me', { nickname: trimmed });
      updateUser(updated);
    } catch {
      setError('Failed to update nickname');
    }
  }, [nickname, user, updateUser]);

  const handlePhotoUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = '';
      setUploadingPhoto(true);
      try {
        const updated = await api.upload<AuthUser>('/api/me/photo', file);
        updateUser(updated);
      } catch {
        setError('Failed to upload photo');
      } finally {
        setUploadingPhoto(false);
      }
    },
    [updateUser],
  );

  const handlePhotoDelete = useCallback(async () => {
    try {
      await api.delete('/api/me/photo');
      if (user) updateUser({ ...user, photoUrl: null });
    } catch {
      setError('Failed to remove photo');
    }
  }, [user, updateUser]);

  // --- Patterns ---
  const fetchPatterns = useCallback(async (offset = 0, append = false) => {
    setPatternsLoading(true);
    try {
      const data = await api.get<PatternsResponse>(
        `/api/patterns?limit=${PAGE_SIZE}&offset=${offset}`,
      );
      setPatterns((prev) => (append ? [...prev, ...data.items] : data.items));
      setPatternsTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load patterns');
    } finally {
      setPatternsLoading(false);
    }
  }, []);

  const fetchTrashedPatterns = useCallback(async () => {
    try {
      const data = await api.get<TrashResponse<Pattern>>('/api/patterns/trash');
      setTrashedPatterns(data.items);
    } catch {
      // silent
    }
  }, []);

  const handleDeletePattern = useCallback(async (id: string) => {
    setPatternActionId(id);
    try {
      await api.delete(`/api/patterns/${id}`);
      setPatterns((prev) => prev.filter((p) => p.id !== id));
      setPatternsTotal((prev) => prev - 1);
      if (showPatternTrash) fetchTrashedPatterns();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setPatternActionId(null);
    }
  }, [showPatternTrash, fetchTrashedPatterns]);

  const handleRestorePattern = useCallback(async (id: string) => {
    setPatternActionId(id);
    try {
      await api.post(`/api/patterns/${id}/restore`);
      setTrashedPatterns((prev) => prev.filter((p) => p.id !== id));
      fetchPatterns();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore');
    } finally {
      setPatternActionId(null);
    }
  }, [fetchPatterns]);

  const handlePermanentDeletePattern = useCallback(async (id: string) => {
    if (!confirm('Permanently delete this pattern? This cannot be undone.')) return;
    setPatternActionId(id);
    try {
      await api.delete(`/api/patterns/${id}/permanent`);
      setTrashedPatterns((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to permanently delete');
    } finally {
      setPatternActionId(null);
    }
  }, []);

  // --- Files ---
  const fetchFiles = useCallback(async (offset = 0, append = false) => {
    setFilesLoading(true);
    try {
      const data = await api.get<FilesResponse>(
        `/api/files?limit=${PAGE_SIZE}&offset=${offset}`,
      );
      setFiles((prev) => (append ? [...prev, ...data.items] : data.items));
      setFilesTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files');
    } finally {
      setFilesLoading(false);
    }
  }, []);

  const fetchTrashedFiles = useCallback(async () => {
    try {
      const data = await api.get<TrashResponse<FileEntry>>('/api/files/trash');
      setTrashedFiles(data.items);
    } catch {
      // silent
    }
  }, []);

  const handleDeleteFile = useCallback(async (id: string) => {
    setFileActionId(id);
    try {
      await api.delete(`/api/files/${id}`);
      setFiles((prev) => prev.filter((f) => f.id !== id));
      setFilesTotal((prev) => prev - 1);
      if (showFileTrash) fetchTrashedFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setFileActionId(null);
    }
  }, [showFileTrash, fetchTrashedFiles]);

  const handleRestoreFile = useCallback(async (id: string) => {
    setFileActionId(id);
    try {
      await api.post(`/api/files/${id}/restore`);
      setTrashedFiles((prev) => prev.filter((f) => f.id !== id));
      fetchFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore');
    } finally {
      setFileActionId(null);
    }
  }, [fetchFiles]);

  const handlePermanentDeleteFile = useCallback(async (id: string) => {
    if (!confirm('Permanently delete this file? This cannot be undone.')) return;
    setFileActionId(id);
    try {
      await api.delete(`/api/files/${id}/permanent`);
      setTrashedFiles((prev) => prev.filter((f) => f.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to permanently delete');
    } finally {
      setFileActionId(null);
    }
  }, []);

  const handleUploadFile = useCallback(async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const entry = await api.upload<FileEntry>('/api/files', file);
      setFiles((prev) => [entry, ...prev]);
      setFilesTotal((prev) => prev + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleUploadFile(file);
      e.target.value = '';
    },
    [handleUploadFile],
  );

  const handleUseFile = useCallback(
    async (entry: FileEntry) => {
      try {
        const blob = await fetchBlob(`/api/files/${entry.id}/download`);
        const file = new File([blob], entry.filename, { type: entry.contentType });
        onUseAsLayer(file);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to download file');
      }
    },
    [onUseAsLayer, onClose],
  );

  // --- Load data on tab switch ---
  useEffect(() => {
    if (activeTab === 'patterns') {
      fetchPatterns();
    } else {
      fetchFiles();
    }
  }, [activeTab, fetchPatterns, fetchFiles]);

  useEffect(() => {
    if (showPatternTrash) fetchTrashedPatterns();
  }, [showPatternTrash, fetchTrashedPatterns]);

  useEffect(() => {
    if (showFileTrash) fetchTrashedFiles();
  }, [showFileTrash, fetchTrashedFiles]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !enlargeImages) onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose, enlargeImages]);

  const photoSrc = user?.photoUrl ? '/api/me/photo' : null;

  return (
    <div className="user-page-overlay" onClick={onClose}>
      <div className="user-page" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="user-page-header">
          <div className="user-page-photo-section">
            <div
              className="user-page-photo"
              onClick={() => photoInputRef.current?.click()}
              title="Change photo"
            >
              {uploadingPhoto ? (
                <div className="processing-spinner" />
              ) : photoSrc ? (
                <img src={photoSrc} alt="Profile" className="user-page-photo-img" />
              ) : (
                <span className="user-page-photo-placeholder">
                  {user?.name?.charAt(0).toUpperCase() ?? '?'}
                </span>
              )}
            </div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              hidden
            />
            {photoSrc && (
              <button className="user-page-photo-remove" onClick={handlePhotoDelete}>
                Remove
              </button>
            )}
          </div>
          <div className="user-page-info">
            {editingNickname ? (
              <input
                type="text"
                className="user-page-nickname-input"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                onBlur={handleNicknameSave}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleNicknameSave();
                  if (e.key === 'Escape') {
                    setNickname(user?.nickname ?? user?.name ?? '');
                    setEditingNickname(false);
                  }
                }}
                autoFocus
              />
            ) : (
              <button
                className="user-page-nickname"
                onClick={() => setEditingNickname(true)}
                title="Click to edit nickname"
              >
                {user?.nickname ?? user?.name ?? 'User'}
              </button>
            )}
            <div className="user-page-email">{user?.email ?? ''}</div>
          </div>
          <button className="btn user-page-close" onClick={onClose}>
            Close
          </button>
        </div>

        {error && <div className="save-pattern-error">{error}</div>}

        {/* Tab bar */}
        <div className="user-page-tabs">
          <button
            className={`user-page-tab${activeTab === 'patterns' ? ' active' : ''}`}
            onClick={() => setActiveTab('patterns')}
          >
            Patterns
          </button>
          <button
            className={`user-page-tab${activeTab === 'images' ? ' active' : ''}`}
            onClick={() => setActiveTab('images')}
          >
            Images
          </button>
        </div>

        {/* Tab content */}
        <div className="user-page-content">
          {activeTab === 'patterns' && (
            <PatternsTabContent
              patterns={patterns}
              total={patternsTotal}
              loading={patternsLoading}
              trashedPatterns={trashedPatterns}
              showTrash={showPatternTrash}
              actionId={patternActionId}
              onLoadMore={() => fetchPatterns(patterns.length, true)}
              onLoadPattern={(p) => {
                onLoadPattern(p.configJson, p.patternType);
                onClose();
              }}
              onDelete={handleDeletePattern}
              onToggleTrash={() => setShowPatternTrash((v) => !v)}
              onRestore={handleRestorePattern}
              onPermanentDelete={handlePermanentDeletePattern}
              onEnlarge={(images, index) => {
                setEnlargeImages(images);
                setEnlargeIndex(index);
              }}
            />
          )}
          {activeTab === 'images' && (
            <FilesTabContent
              files={files}
              total={filesTotal}
              loading={filesLoading}
              trashedFiles={trashedFiles}
              showTrash={showFileTrash}
              uploading={uploading}
              actionId={fileActionId}
              onLoadMore={() => fetchFiles(files.length, true)}
              onUpload={() => fileInputRef.current?.click()}
              onUseFile={handleUseFile}
              onDelete={handleDeleteFile}
              onToggleTrash={() => setShowFileTrash((v) => !v)}
              onRestore={handleRestoreFile}
              onPermanentDelete={handlePermanentDeleteFile}
              onEnlarge={(images, index) => {
                setEnlargeImages(images);
                setEnlargeIndex(index);
              }}
            />
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileInputChange}
            hidden
          />
        </div>
      </div>

      {/* Image enlarge modal */}
      {enlargeImages && (
        <ImageEnlargeModal
          images={enlargeImages}
          currentIndex={enlargeIndex}
          onClose={() => setEnlargeImages(null)}
          onNavigate={setEnlargeIndex}
        />
      )}
    </div>
  );
}

// --- Patterns Tab ---

interface PatternsTabContentProps {
  patterns: Pattern[];
  total: number;
  loading: boolean;
  trashedPatterns: Pattern[];
  showTrash: boolean;
  actionId: string | null;
  onLoadMore: () => void;
  onLoadPattern: (p: Pattern) => void;
  onDelete: (id: string) => void;
  onToggleTrash: () => void;
  onRestore: (id: string) => void;
  onPermanentDelete: (id: string) => void;
  onEnlarge: (images: { src: string; label: string }[], index: number) => void;
}

function PatternsTabContent({
  patterns,
  total,
  loading,
  trashedPatterns,
  showTrash,
  actionId,
  onLoadMore,
  onLoadPattern,
  onDelete,
  onToggleTrash,
  onRestore,
  onPermanentDelete,
  onEnlarge,
}: PatternsTabContentProps) {
  const enlargeableImages = patterns
    .filter((p) => p.previewR2Key)
    .map((p) => ({ src: `/api/patterns/${p.id}/preview`, label: p.name }));

  return (
    <>
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
            {patterns.map((p) => {
              const imgIndex = enlargeableImages.findIndex(
                (img) => img.src === `/api/patterns/${p.id}/preview`,
              );
              return (
                <div key={p.id} className="gallery-card">
                  <div className="gallery-card-preview">
                    {p.previewR2Key ? (
                      <img
                        src={`/api/patterns/${p.id}/preview`}
                        alt={p.name}
                        className="gallery-card-img"
                        onClick={() => {
                          if (imgIndex >= 0) onEnlarge(enlargeableImages, imgIndex);
                        }}
                      />
                    ) : (
                      <div className="gallery-card-placeholder">{p.patternType}</div>
                    )}
                  </div>
                  <div className="gallery-card-info">
                    <div className="gallery-card-name" title={p.name}>{p.name}</div>
                    <div className="gallery-card-meta">
                      <span>{p.patternType}</span>
                      <span>{new Date(p.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="gallery-card-actions">
                    <button
                      className="btn gallery-card-action-btn"
                      onClick={() => onLoadPattern(p)}
                      title="Load in editor"
                    >
                      Edit
                    </button>
                    <button
                      className="gallery-card-delete"
                      style={{ position: 'static', opacity: 1 }}
                      onClick={() => onDelete(p.id)}
                      disabled={actionId === p.id}
                      title="Move to trash"
                    >
                      {actionId === p.id ? '...' : '\u00d7'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {patterns.length < total && (
            <button className="btn gallery-load-more" onClick={onLoadMore} disabled={loading}>
              {loading ? 'Loading...' : 'Load More'}
            </button>
          )}
        </>
      )}

      {/* Dustbox */}
      <div className="user-page-dustbox">
        <button
          className="user-page-dustbox-toggle"
          onClick={onToggleTrash}
        >
          Trash ({trashedPatterns.length}) {showTrash ? '\u25B2' : '\u25BC'}
        </button>
        {showTrash && (
          <div className="user-page-dustbox-content">
            {trashedPatterns.length === 0 ? (
              <div className="gallery-empty">Trash is empty.</div>
            ) : (
              <div className="user-page-dustbox-list">
                {trashedPatterns.map((p) => (
                  <div key={p.id} className="user-page-dustbox-item">
                    <span className="user-page-dustbox-item-name">{p.name}</span>
                    <span className="user-page-dustbox-item-meta">{p.patternType}</span>
                    <button
                      className="btn user-page-dustbox-restore"
                      onClick={() => onRestore(p.id)}
                      disabled={actionId === p.id}
                    >
                      Restore
                    </button>
                    <button
                      className="btn user-page-dustbox-perm-delete"
                      onClick={() => onPermanentDelete(p.id)}
                      disabled={actionId === p.id}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// --- Files Tab ---

interface FilesTabContentProps {
  files: FileEntry[];
  total: number;
  loading: boolean;
  trashedFiles: FileEntry[];
  showTrash: boolean;
  uploading: boolean;
  actionId: string | null;
  onLoadMore: () => void;
  onUpload: () => void;
  onUseFile: (entry: FileEntry) => void;
  onDelete: (id: string) => void;
  onToggleTrash: () => void;
  onRestore: (id: string) => void;
  onPermanentDelete: (id: string) => void;
  onEnlarge: (images: { src: string; label: string }[], index: number) => void;
}

function FilesTabContent({
  files,
  total,
  loading,
  trashedFiles,
  showTrash,
  uploading,
  actionId,
  onLoadMore,
  onUpload,
  onUseFile,
  onDelete,
  onToggleTrash,
  onRestore,
  onPermanentDelete,
  onEnlarge,
}: FilesTabContentProps) {
  const enlargeableImages = files
    .filter((f) => f.contentType.startsWith('image/'))
    .map((f) => ({ src: `/api/files/${f.id}/download`, label: f.filename }));

  return (
    <>
      <div className="user-page-files-actions">
        <button className="btn" onClick={onUpload} disabled={uploading}>
          {uploading ? 'Uploading...' : 'Upload Image'}
        </button>
      </div>

      {loading && files.length === 0 ? (
        <div className="gallery-loading">
          <div className="processing-spinner" />
          <span>Loading...</span>
        </div>
      ) : files.length === 0 ? (
        <div className="gallery-empty">No uploaded files yet.</div>
      ) : (
        <>
          <div className="gallery-grid">
            {files.map((f) => {
              const imgIndex = enlargeableImages.findIndex(
                (img) => img.src === `/api/files/${f.id}/download`,
              );
              return (
                <div key={f.id} className="gallery-card">
                  <div className="gallery-card-preview">
                    {f.contentType.startsWith('image/') ? (
                      <img
                        src={`/api/files/${f.id}/download`}
                        alt={f.filename}
                        className="gallery-card-img"
                        onClick={() => {
                          if (imgIndex >= 0) onEnlarge(enlargeableImages, imgIndex);
                        }}
                      />
                    ) : (
                      <div className="gallery-card-placeholder">
                        {f.contentType.split('/')[1] ?? 'file'}
                      </div>
                    )}
                  </div>
                  <div className="gallery-card-info">
                    <div className="gallery-card-name" title={f.filename}>{f.filename}</div>
                    <div className="gallery-card-meta">
                      <span>{formatSize(f.sizeBytes)}</span>
                      <span>{new Date(f.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="gallery-card-actions">
                    <button
                      className="btn gallery-card-action-btn"
                      onClick={() => onUseFile(f)}
                      title="Use in Composer"
                    >
                      Use
                    </button>
                    <button
                      className="gallery-card-delete"
                      style={{ position: 'static', opacity: 1 }}
                      onClick={() => onDelete(f.id)}
                      disabled={actionId === f.id}
                      title="Move to trash"
                    >
                      {actionId === f.id ? '...' : '\u00d7'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {files.length < total && (
            <button className="btn gallery-load-more" onClick={onLoadMore} disabled={loading}>
              {loading ? 'Loading...' : 'Load More'}
            </button>
          )}
        </>
      )}

      {/* Dustbox */}
      <div className="user-page-dustbox">
        <button
          className="user-page-dustbox-toggle"
          onClick={onToggleTrash}
        >
          Trash ({trashedFiles.length}) {showTrash ? '\u25B2' : '\u25BC'}
        </button>
        {showTrash && (
          <div className="user-page-dustbox-content">
            {trashedFiles.length === 0 ? (
              <div className="gallery-empty">Trash is empty.</div>
            ) : (
              <div className="user-page-dustbox-list">
                {trashedFiles.map((f) => (
                  <div key={f.id} className="user-page-dustbox-item">
                    <span className="user-page-dustbox-item-name">{f.filename}</span>
                    <span className="user-page-dustbox-item-meta">{formatSize(f.sizeBytes)}</span>
                    <button
                      className="btn user-page-dustbox-restore"
                      onClick={() => onRestore(f.id)}
                      disabled={actionId === f.id}
                    >
                      Restore
                    </button>
                    <button
                      className="btn user-page-dustbox-perm-delete"
                      onClick={() => onPermanentDelete(f.id)}
                      disabled={actionId === f.id}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
