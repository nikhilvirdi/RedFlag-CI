import { env } from './env'
import { getToken } from './storage'

export type ApiError = Error & { status?: number; body?: unknown }

function makeError(message: string, status?: number, body?: unknown): ApiError {
  const err = new Error(message) as ApiError
  err.status = status
  err.body = body
  return err
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken()
  const headers = new Headers(init?.headers ?? {})

  headers.set('Accept', 'application/json')
  if (!headers.has('Content-Type') && init?.body) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(`${env.apiBase}${path}`, {
    ...init,
    headers,
  })

  const contentType = res.headers.get('content-type') ?? ''
  const isJson = contentType.includes('application/json')
  const body = isJson ? await res.json().catch(() => undefined) : await res.text().catch(() => undefined)

  if (!res.ok) {
    const msg =
      typeof body === 'object' && body && 'error' in (body as any)
        ? String((body as any).error)
        : `Request failed (${res.status})`
    throw makeError(msg, res.status, body)
  }

  return body as T
}

