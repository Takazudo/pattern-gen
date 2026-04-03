export interface AuthUser {
  id: string;
  email: string;
  name: string;
  picture_url?: string;
}

export interface Pattern {
  id: string;
  name: string;
  config_json: string;
  pattern_type: string;
  preview_r2_key?: string;
  created_at: string;
  updated_at: string;
}

export interface PatternsResponse {
  patterns: Pattern[];
  total: number;
}

export interface FileEntry {
  id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  created_at: string;
}

export interface FilesResponse {
  files: FileEntry[];
  total: number;
}
