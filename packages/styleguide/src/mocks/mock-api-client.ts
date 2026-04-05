export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Mock API responses registry
const mockResponses = new Map<string, unknown>();

export function setMockResponse(url: string, data: unknown) {
  mockResponses.set(url, data);
}

function getMockResponse<T>(url: string): T {
  const data = mockResponses.get(url);
  if (data !== undefined) return data as T;
  // Default: return empty results
  return { items: [], total: 0, limit: 20, offset: 0 } as T;
}

export async function fetchBlob(_url: string): Promise<Blob> {
  return new Blob(['mock'], { type: 'image/png' });
}

export const api = {
  get<T>(url: string): Promise<T> {
    return Promise.resolve(getMockResponse<T>(url));
  },
  post<T>(_url: string, _body?: unknown): Promise<T> {
    return Promise.resolve({} as T);
  },
  put<T>(_url: string, _body?: unknown): Promise<T> {
    return Promise.resolve({} as T);
  },
  patch<T>(_url: string, _body?: unknown): Promise<T> {
    return Promise.resolve({} as T);
  },
  delete<T>(_url: string): Promise<T> {
    return Promise.resolve({} as T);
  },
  upload<T>(_url: string, _file: File): Promise<T> {
    return Promise.resolve({} as T);
  },
};
