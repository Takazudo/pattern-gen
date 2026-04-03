export interface AuthUser {
  id: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  nickname: string | null;
  pictureUrl: string | null;
  photoUrl: string | null;
  createdAt: number;
}

export interface Pattern {
  id: string;
  name: string;
  configJson: string;
  patternType: string;
  previewR2Key: string | null;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface PatternsResponse {
  items: Pattern[];
  total: number;
  limit: number;
  offset: number;
}

export interface FileEntry {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  createdAt: number;
  deletedAt: number | null;
}

export interface TrashResponse<T> {
  items: T[];
  total: number;
}

export interface FilesResponse {
  items: FileEntry[];
  total: number;
  limit: number;
  offset: number;
}
