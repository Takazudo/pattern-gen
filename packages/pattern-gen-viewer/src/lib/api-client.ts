export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function refreshToken(): Promise<boolean> {
  try {
    const res = await fetch('/auth/refresh', {
      method: 'POST',
      credentials: 'same-origin',
    });
    return res.ok;
  } catch {
    return false;
  }
}

function parseBody<T>(res: Response): Promise<T> {
  const ct = res.headers.get('content-type') ?? '';
  if (res.status === 204 || !ct.includes('application/json')) {
    return Promise.resolve({} as T);
  }
  return res.json() as Promise<T>;
}

async function request<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    credentials: 'same-origin',
  });

  if (res.status === 401) {
    const refreshed = await refreshToken();
    if (refreshed) {
      const retry = await fetch(url, {
        ...options,
        credentials: 'same-origin',
      });
      if (!retry.ok) {
        throw new ApiError(retry.status, `API error: ${retry.status}`);
      }
      return parseBody<T>(retry);
    }
    throw new ApiError(401, 'Unauthorized');
  }

  if (!res.ok) {
    throw new ApiError(res.status, `API error: ${res.status}`);
  }

  return parseBody<T>(res);
}

/** Fetch a binary response with same-origin credentials and 401 auto-refresh. */
export async function fetchBlob(url: string): Promise<Blob> {
  let res = await fetch(url, { credentials: 'same-origin' });
  if (res.status === 401) {
    const refreshed = await refreshToken();
    if (refreshed) {
      res = await fetch(url, { credentials: 'same-origin' });
    }
    if (!res.ok) throw new ApiError(res.status, `Fetch error: ${res.status}`);
  }
  if (!res.ok) throw new ApiError(res.status, `Fetch error: ${res.status}`);
  return res.blob();
}

export const api = {
  get<T>(url: string): Promise<T> {
    return request<T>(url);
  },

  post<T>(url: string, body?: unknown): Promise<T> {
    return request<T>(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body != null ? JSON.stringify(body) : undefined,
    });
  },

  put<T>(url: string, body?: unknown): Promise<T> {
    return request<T>(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: body != null ? JSON.stringify(body) : undefined,
    });
  },

  patch<T>(url: string, body?: unknown): Promise<T> {
    return request<T>(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: body != null ? JSON.stringify(body) : undefined,
    });
  },

  delete<T>(url: string): Promise<T> {
    return request<T>(url, { method: 'DELETE' });
  },

  upload<T>(url: string, file: File): Promise<T> {
    return request<T>(url, {
      method: 'POST',
      headers: { 'Content-Type': file.type },
      body: file,
    });
  },
};
