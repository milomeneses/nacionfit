// Shared types between the Mi Cocina client and server.

/** A user as exposed to clients — never includes the password hash. */
export interface User {
  id: number;
  email: string;
  name: string;
  heightCm: number | null;
  targetWeightKg: number | null;
  targetDate: string | null; // ISO date (YYYY-MM-DD)
  timezone: string;
  createdAt: string; // ISO timestamp
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  heightCm?: number | null;
  targetWeightKg?: number | null;
  targetDate?: string | null;
  timezone?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/** Response returned by /register and /login. */
export interface AuthResponse extends AuthTokens {
  user: User;
}

export interface ErrorResponse {
  error: string;
}
