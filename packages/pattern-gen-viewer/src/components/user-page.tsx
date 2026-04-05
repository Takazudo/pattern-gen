import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/auth-context.js';
import { api, fetchBlob } from '../lib/api-client.js';
import type {
  AuthUser,
  Composition,
  CompositionsResponse,
  AssetEntry,
  AssetsResponse,
  TrashResponse,
} from '../lib/api-types.js';
import { ImageEnlargeModal } from './image-enlarge-modal.js';

interface UserPageProps {
  onClose: () => void;
  onLoadComposition: (composition: Composition) => void;
  onUseAsLayer: (file: File) => void;
}

type Tab = 'compositions' | 'images';

const PAGE_SIZE = 20;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UserPage({ onClose, onLoadComposition, onUseAsLayer }: UserPageProps) {
  const { user, updateUser } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('compositions');

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

  // Compositions tab
  const [compositions, setCompositions] = useState<Composition[]>([]);
  const [compositionsTotal, setCompositionsTotal] = useState(0);
  const [compositionsLoading, setCompositionsLoading] = useState(true);
  const [trashedCompositions, setTrashedCompositions] = useState<Composition[]>([]);
  const [showCompositionTrash, setShowCompositionTrash] = useState(false);

  // Assets tab
  const [assets, setAssets] = useState<AssetEntry[]>([]);
  const [assetsTotal, setAssetsTotal] = useState(0);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [trashedAssets, setTrashedAssets] = useState<AssetEntry[]>([]);
  const [showAssetTrash, setShowAssetTrash] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Shared
  const [error, setError] = useState<string | null>(null);
  // Separate action IDs per tab to avoid cross-tab state bleed
  const [compositionActionId, setCompositionActionId] = useState<string | null>(null);
  const [assetActionId, setAssetActionId] = useState<string | null>(null);

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

  // --- Compositions ---
  const fetchCompositions = useCallback(async (offset = 0, append = false) => {
    setCompositionsLoading(true);
    try {
      const data = await api.get<CompositionsResponse>(
        `/api/compositions?limit=${PAGE_SIZE}&offset=${offset}`,
      );
      setCompositions((prev) => (append ? [...prev, ...data.items] : data.items));
      setCompositionsTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load compositions');
    } finally {
      setCompositionsLoading(false);
    }
  }, []);

  const fetchTrashedCompositions = useCallback(async () => {
    try {
      const data = await api.get<TrashResponse<Composition>>('/api/compositions/trash');
      setTrashedCompositions(data.items);
    } catch {
      // silent
    }
  }, []);

  const handleDeleteComposition = useCallback(async (id: string) => {
    setCompositionActionId(id);
    try {
      await api.delete(`/api/compositions/${id}`);
      setCompositions((prev) => prev.filter((p) => p.id !== id));
      setCompositionsTotal((prev) => prev - 1);
      if (showCompositionTrash) fetchTrashedCompositions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setCompositionActionId(null);
    }
  }, [showCompositionTrash, fetchTrashedCompositions]);

  const handleRestoreComposition = useCallback(async (id: string) => {
    setCompositionActionId(id);
    try {
      await api.post(`/api/compositions/${id}/restore`);
      setTrashedCompositions((prev) => prev.filter((p) => p.id !== id));
      fetchCompositions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore');
    } finally {
      setCompositionActionId(null);
    }
  }, [fetchCompositions]);

  const handlePermanentDeleteComposition = useCallback(async (id: string) => {
    if (!confirm('Permanently delete this composition? This cannot be undone.')) return;
    setCompositionActionId(id);
    try {
      await api.delete(`/api/compositions/${id}/permanent`);
      setTrashedCompositions((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to permanently delete');
    } finally {
      setCompositionActionId(null);
    }
  }, []);

  // --- Assets ---
  const fetchAssets = useCallback(async (offset = 0, append = false) => {
    setAssetsLoading(true);
    try {
      const data = await api.get<AssetsResponse>(
        `/api/assets?limit=${PAGE_SIZE}&offset=${offset}`,
      );
      setAssets((prev) => (append ? [...prev, ...data.items] : data.items));
      setAssetsTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assets');
    } finally {
      setAssetsLoading(false);
    }
  }, []);

  const fetchTrashedAssets = useCallback(async () => {
    try {
      const data = await api.get<TrashResponse<AssetEntry>>('/api/assets/trash');
      setTrashedAssets(data.items);
    } catch {
      // silent
    }
  }, []);

  const handleDeleteAsset = useCallback(async (id: string) => {
    setAssetActionId(id);
    try {
      await api.delete(`/api/assets/${id}`);
      setAssets((prev) => prev.filter((f) => f.id !== id));
      setAssetsTotal((prev) => prev - 1);
      if (showAssetTrash) fetchTrashedAssets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setAssetActionId(null);
    }
  }, [showAssetTrash, fetchTrashedAssets]);

  const handleRestoreAsset = useCallback(async (id: string) => {
    setAssetActionId(id);
    try {
      await api.post(`/api/assets/${id}/restore`);
      setTrashedAssets((prev) => prev.filter((f) => f.id !== id));
      fetchAssets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore');
    } finally {
      setAssetActionId(null);
    }
  }, [fetchAssets]);

  const handlePermanentDeleteAsset = useCallback(async (id: string) => {
    if (!confirm('Permanently delete this asset? This cannot be undone.')) return;
    setAssetActionId(id);
    try {
      await api.delete(`/api/assets/${id}/permanent`);
      setTrashedAssets((prev) => prev.filter((f) => f.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to permanently delete');
    } finally {
      setAssetActionId(null);
    }
  }, []);

  const handleUploadAsset = useCallback(async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const entry = await api.upload<AssetEntry>('/api/assets', file);
      setAssets((prev) => [entry, ...prev]);
      setAssetsTotal((prev) => prev + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleUploadAsset(file);
      e.target.value = '';
    },
    [handleUploadAsset],
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

  // --- Load data on tab switch ---
  useEffect(() => {
    if (activeTab === 'compositions') {
      fetchCompositions();
    } else {
      fetchAssets();
    }
  }, [activeTab, fetchCompositions, fetchAssets]);

  useEffect(() => {
    if (showCompositionTrash) fetchTrashedCompositions();
  }, [showCompositionTrash, fetchTrashedCompositions]);

  useEffect(() => {
    if (showAssetTrash) fetchTrashedAssets();
  }, [showAssetTrash, fetchTrashedAssets]);

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
            className={`user-page-tab${activeTab === 'compositions' ? ' active' : ''}`}
            onClick={() => setActiveTab('compositions')}
          >
            Compositions
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
          {activeTab === 'compositions' && (
            <CompositionsTabContent
              compositions={compositions}
              total={compositionsTotal}
              loading={compositionsLoading}
              trashedCompositions={trashedCompositions}
              showTrash={showCompositionTrash}
              actionId={compositionActionId}
              onLoadMore={() => fetchCompositions(compositions.length, true)}
              onLoadComposition={(p) => {
                onLoadComposition(p);
                onClose();
              }}
              onDelete={handleDeleteComposition}
              onToggleTrash={() => setShowCompositionTrash((v) => !v)}
              onRestore={handleRestoreComposition}
              onPermanentDelete={handlePermanentDeleteComposition}
              onEnlarge={(images, index) => {
                setEnlargeImages(images);
                setEnlargeIndex(index);
              }}
            />
          )}
          {activeTab === 'images' && (
            <AssetsTabContent
              assets={assets}
              total={assetsTotal}
              loading={assetsLoading}
              trashedAssets={trashedAssets}
              showTrash={showAssetTrash}
              uploading={uploading}
              actionId={assetActionId}
              onLoadMore={() => fetchAssets(assets.length, true)}
              onUpload={() => fileInputRef.current?.click()}
              onUseAsset={handleUseAsset}
              onDelete={handleDeleteAsset}
              onToggleTrash={() => setShowAssetTrash((v) => !v)}
              onRestore={handleRestoreAsset}
              onPermanentDelete={handlePermanentDeleteAsset}
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

// --- Compositions Tab ---

interface CompositionsTabContentProps {
  compositions: Composition[];
  total: number;
  loading: boolean;
  trashedCompositions: Composition[];
  showTrash: boolean;
  actionId: string | null;
  onLoadMore: () => void;
  onLoadComposition: (p: Composition) => void;
  onDelete: (id: string) => void;
  onToggleTrash: () => void;
  onRestore: (id: string) => void;
  onPermanentDelete: (id: string) => void;
  onEnlarge: (images: { src: string; label: string }[], index: number) => void;
}

function CompositionsTabContent({
  compositions,
  total,
  loading,
  trashedCompositions,
  showTrash,
  actionId,
  onLoadMore,
  onLoadComposition,
  onDelete,
  onToggleTrash,
  onRestore,
  onPermanentDelete,
  onEnlarge,
}: CompositionsTabContentProps) {
  const enlargeableImages = compositions
    .filter((p) => p.previewR2Key)
    .map((p) => ({ src: `/api/compositions/${p.id}/preview`, label: p.name }));

  return (
    <>
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
            {compositions.map((p) => {
              const imgIndex = enlargeableImages.findIndex(
                (img) => img.src === `/api/compositions/${p.id}/preview`,
              );
              return (
                <div key={p.id} className="gallery-card">
                  <div className="gallery-card-preview">
                    {p.previewR2Key ? (
                      <img
                        src={`/api/compositions/${p.id}/preview`}
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
                      onClick={() => onLoadComposition(p)}
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
          {compositions.length < total && (
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
          Trash ({trashedCompositions.length}) {showTrash ? '\u25B2' : '\u25BC'}
        </button>
        {showTrash && (
          <div className="user-page-dustbox-content">
            {trashedCompositions.length === 0 ? (
              <div className="gallery-empty">Trash is empty.</div>
            ) : (
              <div className="user-page-dustbox-list">
                {trashedCompositions.map((p) => (
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

// --- Assets Tab ---

interface AssetsTabContentProps {
  assets: AssetEntry[];
  total: number;
  loading: boolean;
  trashedAssets: AssetEntry[];
  showTrash: boolean;
  uploading: boolean;
  actionId: string | null;
  onLoadMore: () => void;
  onUpload: () => void;
  onUseAsset: (entry: AssetEntry) => void;
  onDelete: (id: string) => void;
  onToggleTrash: () => void;
  onRestore: (id: string) => void;
  onPermanentDelete: (id: string) => void;
  onEnlarge: (images: { src: string; label: string }[], index: number) => void;
}

function AssetsTabContent({
  assets,
  total,
  loading,
  trashedAssets,
  showTrash,
  uploading,
  actionId,
  onLoadMore,
  onUpload,
  onUseAsset,
  onDelete,
  onToggleTrash,
  onRestore,
  onPermanentDelete,
  onEnlarge,
}: AssetsTabContentProps) {
  const enlargeableImages = assets
    .filter((f) => f.contentType.startsWith('image/'))
    .map((f) => ({ src: `/api/assets/${f.id}/download`, label: f.filename }));

  return (
    <>
      <div className="user-page-files-actions">
        <button className="btn" onClick={onUpload} disabled={uploading}>
          {uploading ? 'Uploading...' : 'Upload Image'}
        </button>
      </div>

      {loading && assets.length === 0 ? (
        <div className="gallery-loading">
          <div className="processing-spinner" />
          <span>Loading...</span>
        </div>
      ) : assets.length === 0 ? (
        <div className="gallery-empty">No uploaded assets yet.</div>
      ) : (
        <>
          <div className="gallery-grid">
            {assets.map((f) => {
              const imgIndex = enlargeableImages.findIndex(
                (img) => img.src === `/api/assets/${f.id}/download`,
              );
              return (
                <div key={f.id} className="gallery-card">
                  <div className="gallery-card-preview">
                    {f.contentType.startsWith('image/') ? (
                      <img
                        src={`/api/assets/${f.id}/download`}
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
                      onClick={() => onUseAsset(f)}
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
          {assets.length < total && (
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
          Trash ({trashedAssets.length}) {showTrash ? '\u25B2' : '\u25BC'}
        </button>
        {showTrash && (
          <div className="user-page-dustbox-content">
            {trashedAssets.length === 0 ? (
              <div className="gallery-empty">Trash is empty.</div>
            ) : (
              <div className="user-page-dustbox-list">
                {trashedAssets.map((f) => (
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
