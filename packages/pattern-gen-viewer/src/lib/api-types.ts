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

export interface Composition {
  id: string;
  name: string;
  configJson: string;
  patternType: string;
  previewR2Key: string | null;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface CompositionsResponse {
  items: Composition[];
  total: number;
  limit: number;
  offset: number;
}

export interface AssetEntry {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  notes: string | null;
  createdAt: number;
  deletedAt: number | null;
}

export interface TrashResponse<T> {
  items: T[];
  total: number;
}

export interface AssetsResponse {
  items: AssetEntry[];
  total: number;
  limit: number;
  offset: number;
}

export interface FontFavorite {
  fontFamily: string;
  createdAt: number;
}
