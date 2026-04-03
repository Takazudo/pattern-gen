/**
 * Seed mock data for MSW handlers.
 * Provides realistic in-memory data stores for development.
 */

export interface MockUser {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string;
  nickname: string | null;
  photoUrl: string | null;
  createdAt: number;
}

export interface MockPattern {
  id: string;
  name: string;
  configJson: string;
  patternType: string;
  previewR2Key: string | null;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface MockFile {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  createdAt: number;
  deletedAt: number | null;
}

const now = Date.now();
const day = 24 * 60 * 60 * 1000;

export const mockUser: MockUser = {
  id: 'mock-user-1',
  email: 'user@example.com',
  emailVerified: true,
  name: 'Test User',
  nickname: 'tester',
  photoUrl: '/api/me/photo',
  createdAt: now - 30 * day,
};

export const initialPatterns: MockPattern[] = [
  {
    id: 'pat-001',
    name: 'Warm Woodblock',
    configJson: JSON.stringify({ type: 'wood-block', size: 800, zoom: 1, colorScheme: 'warm-sunset', slug: 'warm-woodblock' }),
    patternType: 'wood-block',
    previewR2Key: 'users/mock-user-1/previews/pat-001.png',
    createdAt: now - 10 * day,
    updatedAt: now - 10 * day,
    deletedAt: null,
  },
  {
    id: 'pat-002',
    name: 'Ocean Voronoi',
    configJson: JSON.stringify({ type: 'voronoi', size: 800, zoom: 1, colorScheme: 'ocean-deep', slug: 'ocean-voronoi' }),
    patternType: 'voronoi',
    previewR2Key: 'users/mock-user-1/previews/pat-002.png',
    createdAt: now - 9 * day,
    updatedAt: now - 8 * day,
    deletedAt: null,
  },
  {
    id: 'pat-003',
    name: 'Forest Chevron',
    configJson: JSON.stringify({ type: 'chevron', size: 600, zoom: 1.5, colorScheme: 'forest-green', slug: 'forest-chevron' }),
    patternType: 'chevron',
    previewR2Key: null,
    createdAt: now - 7 * day,
    updatedAt: now - 7 * day,
    deletedAt: null,
  },
  {
    id: 'pat-004',
    name: 'Noise Gradient',
    configJson: JSON.stringify({ type: 'perlin-noise', size: 1024, zoom: 2, colorScheme: 'pastel-dream', slug: 'noise-gradient' }),
    patternType: 'perlin-noise',
    previewR2Key: 'users/mock-user-1/previews/pat-004.png',
    createdAt: now - 5 * day,
    updatedAt: now - 4 * day,
    deletedAt: null,
  },
  {
    id: 'pat-005',
    name: 'Hexagonal Grid',
    configJson: JSON.stringify({ type: 'hexagon', size: 800, zoom: 1, colorScheme: 'monochrome', slug: 'hex-grid' }),
    patternType: 'hexagon',
    previewR2Key: 'users/mock-user-1/previews/pat-005.png',
    createdAt: now - 3 * day,
    updatedAt: now - 3 * day,
    deletedAt: null,
  },
  {
    id: 'pat-006',
    name: 'Striped Waves',
    configJson: JSON.stringify({ type: 'wave', size: 800, zoom: 1, colorScheme: 'warm-sunset', slug: 'striped-waves' }),
    patternType: 'wave',
    previewR2Key: null,
    createdAt: now - 2 * day,
    updatedAt: now - 2 * day,
    deletedAt: null,
  },
  {
    id: 'pat-007',
    name: 'Celtic Knots',
    configJson: JSON.stringify({ type: 'celtic-knot', size: 800, zoom: 1, colorScheme: 'earth-tones', slug: 'celtic-knots' }),
    patternType: 'celtic-knot',
    previewR2Key: 'users/mock-user-1/previews/pat-007.png',
    createdAt: now - 1 * day,
    updatedAt: now - 1 * day,
    deletedAt: null,
  },
  {
    id: 'pat-008',
    name: 'Diamond Tiles',
    configJson: JSON.stringify({ type: 'diamond', size: 600, zoom: 1, colorScheme: 'cool-blue', slug: 'diamond-tiles' }),
    patternType: 'diamond',
    previewR2Key: 'users/mock-user-1/previews/pat-008.png',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  },
];

export const initialTrashedPatterns: MockPattern[] = [
  {
    id: 'pat-trash-001',
    name: 'Old Circles',
    configJson: JSON.stringify({ type: 'circles', size: 800, zoom: 1, colorScheme: 'warm-sunset', slug: 'old-circles' }),
    patternType: 'circles',
    previewR2Key: null,
    createdAt: now - 20 * day,
    updatedAt: now - 20 * day,
    deletedAt: now - 1 * day,
  },
  {
    id: 'pat-trash-002',
    name: 'Broken Grid',
    configJson: JSON.stringify({ type: 'grid', size: 800, zoom: 1, colorScheme: 'monochrome', slug: 'broken-grid' }),
    patternType: 'grid',
    previewR2Key: 'users/mock-user-1/previews/pat-trash-002.png',
    createdAt: now - 15 * day,
    updatedAt: now - 15 * day,
    deletedAt: now - 2 * day,
  },
];

export const initialFiles: MockFile[] = [
  {
    id: 'file-001',
    filename: 'background.png',
    contentType: 'image/png',
    sizeBytes: 245_000,
    createdAt: now - 8 * day,
    deletedAt: null,
  },
  {
    id: 'file-002',
    filename: 'logo.svg',
    contentType: 'image/svg+xml',
    sizeBytes: 12_400,
    createdAt: now - 6 * day,
    deletedAt: null,
  },
  {
    id: 'file-003',
    filename: 'texture.jpg',
    contentType: 'image/jpeg',
    sizeBytes: 890_000,
    createdAt: now - 4 * day,
    deletedAt: null,
  },
  {
    id: 'file-004',
    filename: 'overlay.png',
    contentType: 'image/png',
    sizeBytes: 156_000,
    createdAt: now - 2 * day,
    deletedAt: null,
  },
  {
    id: 'file-005',
    filename: 'icon-set.png',
    contentType: 'image/png',
    sizeBytes: 67_800,
    createdAt: now - 1 * day,
    deletedAt: null,
  },
];

export const initialTrashedFiles: MockFile[] = [
  {
    id: 'file-trash-001',
    filename: 'old-banner.jpg',
    contentType: 'image/jpeg',
    sizeBytes: 420_000,
    createdAt: now - 25 * day,
    deletedAt: now - 3 * day,
  },
];
