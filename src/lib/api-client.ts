// Thin fetch wrappers. All requests are same-origin relative paths.
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(init?.headers || {}),
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error((data as any)?.error || `Request failed (${res.status})`) as Error & {
      status?: number
    }
    err.status = res.status
    throw err
  }
  return data as T
}

export const apiGet = <T>(path: string) => api<T>(path)
export const apiPost = <T>(path: string, body: unknown) =>
  api<T>(path, { method: "POST", body: JSON.stringify(body) })
export const apiPatch = <T>(path: string, body: unknown) =>
  api<T>(path, { method: "PATCH", body: JSON.stringify(body) })
export const apiDelete = <T>(path: string) =>
  api<T>(path, { method: "DELETE" })
export const apiForm = <T>(path: string, form: FormData) =>
  api<T>(path, { method: "POST", body: form })
