/**
 * Centralized API client for calling the FastAPI backend.
 *
 * Server Actions use this to route mutations through the backend API
 * rather than talking directly to Supabase. The backend handles business
 * logic, validation, and database writes while respecting Supabase RLS
 * via the user's JWT.
 */

import { createClient } from "@/lib/supabase/server";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/+$/, "") ??
  "http://localhost:8000";

const API_PREFIX = "/api/v1";

/**
 * Retrieves the current Supabase access token from the server-side session.
 * Returns null if there is no active session.
 */
async function getAccessToken(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  } catch {
    return null;
  }
}

export interface BackendErrorBody {
  detail?: string;
  message?: string;
  error_code?: string;
}

export class BackendError extends Error {
  status: number;
  errorCode?: string;

  constructor(status: number, message: string, errorCode?: string) {
    super(message);
    this.name = "BackendError";
    this.status = status;
    this.errorCode = errorCode;
  }
}

/**
 * Low-level fetch wrapper for the backend API. Injects the Supabase JWT
 * as a Bearer token and handles error responses uniformly.
 */
async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit & { params?: Record<string, string> } = {},
): Promise<T> {
  const token = await getAccessToken();
  if (!token) {
    throw new BackendError(401, "Not authenticated");
  }

  const { params, ...fetchOptions } = options;

  let url = `${BACKEND_URL}${API_PREFIX}${path}`;
  if (params) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...(fetchOptions.headers as Record<string, string> | undefined),
  };

  const resp = await fetch(url, {
    ...fetchOptions,
    headers,
    cache: "no-store",
  });

  if (!resp.ok) {
    let detail = `Backend returned status ${resp.status}`;
    let errorCode: string | undefined;
    try {
      const body: BackendErrorBody = await resp.json();
      detail = body.detail ?? body.message ?? detail;
      errorCode = body.error_code;
    } catch {
      // response body wasn't JSON
    }
    throw new BackendError(resp.status, detail, errorCode);
  }

  // Some endpoints return 204 No Content
  if (resp.status === 204) {
    return undefined as T;
  }

  return resp.json() as Promise<T>;
}

// ────────────────────────────────────────────────────────
// Convenience methods
// ────────────────────────────────────────────────────────

export const api = {
  get: <T = unknown>(path: string, params?: Record<string, string>) =>
    apiFetch<T>(path, { method: "GET", params }),

  post: <T = unknown>(path: string, body?: unknown) =>
    apiFetch<T>(path, {
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  put: <T = unknown>(path: string, body?: unknown) =>
    apiFetch<T>(path, {
      method: "PUT",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  patch: <T = unknown>(path: string, body?: unknown) =>
    apiFetch<T>(path, {
      method: "PATCH",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  delete: <T = unknown>(path: string, params?: Record<string, string>) =>
    apiFetch<T>(path, { method: "DELETE", params }),
};
