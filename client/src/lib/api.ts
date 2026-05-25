import type {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  User,
} from '@mi-cocina/shared';

const ACCESS_KEY = 'mc.accessToken';
const REFRESH_KEY = 'mc.refreshToken';

export const tokenStore = {
  get access() {
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY);
  },
  set(tokens: { accessToken: string; refreshToken: string }) {
    localStorage.setItem(ACCESS_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

async function parseError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error ?? `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

export async function register(body: RegisterRequest): Promise<AuthResponse> {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as AuthResponse;
  tokenStore.set(data);
  return data;
}

export async function login(body: LoginRequest): Promise<AuthResponse> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as AuthResponse;
  tokenStore.set(data);
  return data;
}

export async function fetchMe(): Promise<User> {
  const res = await fetch('/api/auth/me', {
    headers: { Authorization: `Bearer ${tokenStore.access ?? ''}` },
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as User;
}
