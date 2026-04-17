'use client'

type AuthMeResponse = {
  user?: {
    id?: string
    name?: string
    email?: string
    roleCode?: string
    sellerCode?: string
  }
} | null

let inFlightAuthMe: Promise<AuthMeResponse> | null = null
let lastAuthMeValue: AuthMeResponse = null
let lastAuthMeAt = 0

type FetchAuthMeOptions = {
  force?: boolean
  ttlMs?: number
}

export async function fetchAuthMeCached(options: FetchAuthMeOptions = {}): Promise<AuthMeResponse> {
  const { force = false, ttlMs = 5000 } = options
  const now = Date.now()

  if (!force && lastAuthMeValue && now - lastAuthMeAt < ttlMs) {
    return lastAuthMeValue
  }

  if (!force && inFlightAuthMe) {
    return inFlightAuthMe
  }

  inFlightAuthMe = fetch('/api/auth/me', { cache: 'no-store' })
    .then((response) => (response.ok ? response.json() : null))
    .catch(() => null)
    .finally(() => {
      inFlightAuthMe = null
    })

  const result = await inFlightAuthMe
  if (result) {
    lastAuthMeValue = result
    lastAuthMeAt = Date.now()
  }
  return result
}

