export const API_URL = (import.meta.env.API_URL || 'http://localhost:5000').replace(/\/$/, '')

export async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const message = data?.errors?.join?.(', ') || data?.message || `Request failed with status ${response.status}`
    throw new Error(message)
  }
  return data as T
}
