import { useState, useCallback } from 'react';
import { useAuth } from '../contexts/auth-context.js';
import { api } from '../lib/api-client.js';
import type { FileEntry } from '../lib/api-types.js';

interface ImageUploadProps {
  file: File | null;
}

export function ImageUpload({ file }: ImageUploadProps) {
  const { isAuthenticated } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);

  const handleUpload = useCallback(async () => {
    if (!file) return;
    setUploading(true);
    try {
      await api.upload<FileEntry>('/api/files', file);
      setUploaded(true);
      setTimeout(() => setUploaded(false), 2000);
    } catch {
      // silent
    } finally {
      setUploading(false);
    }
  }, [file]);

  if (!isAuthenticated || !file) return null;

  return (
    <button
      className="btn image-upload-btn"
      onClick={handleUpload}
      disabled={uploading}
      title="Upload to My Files"
    >
      {uploading ? 'Uploading...' : uploaded ? 'Uploaded!' : 'Upload to My Files'}
    </button>
  );
}
