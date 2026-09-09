import type { AdminData, AvatarAdminSettings, Post, ResumeData, SiteData, SiteSettings, Work } from './types';

let csrfToken = '';

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('content-type') && !(init.body instanceof FormData)) headers.set('content-type', 'application/json');
  if (csrfToken && ['POST', 'PUT', 'PATCH', 'DELETE'].includes((init.method || 'GET').toUpperCase())) headers.set('x-csrf-token', csrfToken);
  const response = await fetch(url, { ...init, headers, credentials: 'same-origin' });
  if (!response.ok) {
    const raw = await response.text();
    let message = raw;
    try { message = (JSON.parse(raw) as { error?: string }).error || raw; } catch { /* use raw response */ }
    const error = new Error(message || `Request failed (${response.status})`);
    Object.assign(error, { status: response.status });
    throw error;
  }
  return response.json() as Promise<T>;
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const api = {
  login: async (email: string, password: string) => {
    const result = await request<{ user: { id: string; email: string; name: string }; csrfToken: string }>('/api/auth/login', json('POST', { email, password }));
    csrfToken = result.csrfToken;
    return result;
  },
  logout: () => request<{ ok: true }>('/api/auth/logout', { method: 'POST' }).then(result => { csrfToken = ''; return result; }),
  publicData: () => request<SiteData>('/api/public/bootstrap'),
  chatAvatar: (messages: Array<{role:'user'|'assistant';content:string}>) => request<{ reply:string; source:'preset'|'ai'|'fallback' }>('/api/public/avatar/chat', json('POST', { messages })),
  submitContact: (body: {name:string;contact:string;email:string;message:string}) => request<{ok:true;id:string;feishu:string}>('/api/public/contact', json('POST', body)),
  adminData: async () => {
    // Rehydrate the CSRF token after a refresh or when the admin opens in a new tab.
    if (!csrfToken) {
      const session = await request<{ csrfToken: string }>('/api/auth/me');
      csrfToken = session.csrfToken;
    }
    return request<AdminData>('/api/admin/bootstrap');
  },
  createWork: (work: Partial<Work>) => request<Work>('/api/admin/works', json('POST', work)),
  updateWork: (id: string, work: Partial<Work>) => request<Work>(`/api/admin/works/${id}`, json('PUT', work)),
  deleteWork: (id: string) => request<{ ok: true }>(`/api/admin/works/${id}`, { method: 'DELETE' }),
  createPost: (post: Partial<Post>) => request<Post>('/api/admin/posts', json('POST', post)),
  updatePost: (id: string, post: Partial<Post>) => request<Post>(`/api/admin/posts/${id}`, json('PUT', post)),
  deletePost: (id: string) => request<{ ok: true }>(`/api/admin/posts/${id}`, { method: 'DELETE' }),
  deleteMedia: (id: string) => request<{ ok: true }>(`/api/admin/media/${id}`, { method: 'DELETE' }),
  deleteContact: (id: string) => request<{ ok: true }>(`/api/admin/contacts/${id}`, { method: 'DELETE' }),
  updateResume: (resume: ResumeData) => request<ResumeData>('/api/admin/resume', json('PUT', resume)),
  updateSettings: (settings: SiteSettings) => request<SiteSettings>('/api/admin/settings', json('PUT', settings)),
  updateAvatar: (avatar: AvatarAdminSettings) => request<AvatarAdminSettings>('/api/admin/avatar', json('PUT', avatar)),
  upload: async (file: File) => {
    const body = new FormData();
    body.append('file', file);
    return request<{ id: string; name: string; url: string; content_type: string; size: number }>(
      '/api/admin/upload',
      { method: 'POST', body },
    );
  },
};
