/**
 * Authenticated fetch wrapper — attaches JWT token from localStorage.
 */
export async function apiFetch(url: string, opts?: RequestInit): Promise<Response> {
  const headers = new Headers(opts?.headers);

  if (typeof window !== "undefined") {
    const token = localStorage.getItem("mir_token");
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  return fetch(url, { ...opts, headers });
}
