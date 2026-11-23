const BIOMETRIC_STORAGE_KEY = 'fenestrians_biometric_passkey'

export interface SavedBiometricCredential {
  credentialIdBase64: string
  userId: number
  fullName: string
  registeredAt: string
}

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

export function isBiometricSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential !== 'undefined' &&
    typeof navigator.credentials !== 'undefined'
  )
}

export function getSavedBiometricCredential(): SavedBiometricCredential | null {
  try {
    const raw = localStorage.getItem(BIOMETRIC_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as SavedBiometricCredential) : null
  } catch {
    return null
  }
}

export function removeBiometricCredential(): void {
  try {
    localStorage.removeItem(BIOMETRIC_STORAGE_KEY)
  } catch {
    // Ignore
  }
}

export async function registerBiometricPasskey(params: {
  userId: number
  username: string
  fullName: string
}): Promise<{ success: boolean; error?: string }> {
  if (!isBiometricSupported()) {
    return {
      success: false,
      error: 'Fingerprint / Face ID authentication is not supported on this device or browser.',
    }
  }

  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32))
    const userIdBytes = new TextEncoder().encode(`fenestrians_user_${params.userId}`)

    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: 'Fenestrians Network',
          id: window.location.hostname,
        },
        user: {
          id: userIdBytes,
          name: params.username || `member_${params.userId}`,
          displayName: params.fullName,
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 60000,
      },
    })) as PublicKeyCredential | null

    if (!credential) {
      return { success: false, error: 'Biometric setup was cancelled.' }
    }

    const saved: SavedBiometricCredential = {
      credentialIdBase64: bufferToBase64Url(credential.rawId),
      userId: params.userId,
      fullName: params.fullName,
      registeredAt: new Date().toISOString(),
    }

    localStorage.setItem(BIOMETRIC_STORAGE_KEY, JSON.stringify(saved))
    return { success: true }
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Could not register device biometrics.',
    }
  }
}

export async function verifyBiometricPasskey(): Promise<{
  success: boolean
  userId?: number
  error?: string
}> {
  const saved = getSavedBiometricCredential()
  if (!saved) {
    return {
      success: false,
      error: 'No Fingerprint / Face ID linked on this device yet. Sign in once and enable it in Settings.',
    }
  }

  if (!isBiometricSupported()) {
    return {
      success: false,
      error: 'Biometric authentication is not available on this browser.',
    }
  }

  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32))
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [
          {
            id: base64UrlToBuffer(saved.credentialIdBase64),
            type: 'public-key',
          },
        ],
        userVerification: 'required',
        timeout: 60000,
      },
    })

    if (!assertion) {
      return { success: false, error: 'Biometric verification cancelled.' }
    }

    return { success: true, userId: saved.userId }
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Biometric verification failed.',
    }
  }
}
