// Thin API client for the backend. Auth uses httpOnly cookies, so every
// request sends credentials and we never touch tokens in JS.

const API_BASE =
  import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1";

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

async function request(path, { method = "GET", body, _retry } = {}) {
  const res = await fetch(API_BASE + path, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  // Access token expired? Try a single silent refresh, then replay the request.
  const isAuthCall = path.startsWith("/auth/");
  if (res.status === 401 && !_retry && !isAuthCall) {
    const refreshed = await fetch(API_BASE + "/auth/refresh", {
      method: "POST",
      credentials: "include",
    });
    if (refreshed.ok) return request(path, { method, body, _retry: true });
  }

  if (res.status === 204) return null;

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const raw = data?.message ?? res.statusText ?? "Request failed";
    throw new ApiError(Array.isArray(raw) ? raw.join(", ") : raw, res.status, data);
  }
  return data;
}

export const api = {
  register: (email, password) =>
    request("/auth/register", { method: "POST", body: { email, password } }),
  login: (email, password) =>
    request("/auth/login", { method: "POST", body: { email, password } }),
  logout: () => request("/auth/logout", { method: "POST" }),
  me: () => request("/auth/me"),

  listCalculations: () => request("/calculations"),
  createCalculation: (payload) =>
    request("/calculations", { method: "POST", body: payload }),
  updateCalculation: (id, payload) =>
    request(`/calculations/${id}`, { method: "PATCH", body: payload }),
  deleteCalculation: (id) =>
    request(`/calculations/${id}`, { method: "DELETE" }),
};
