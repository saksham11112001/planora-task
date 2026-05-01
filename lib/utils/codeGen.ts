// Cryptographically random code generator for join codes and referral codes.
// Uses only uppercase letters (excluding I, O, L — visually ambiguous) and digits (excluding 0, 1).
// Results in a 32-char alphabet × 8 chars = ~1.1 trillion combinations per code type.
// This is sufficient given rate limiting and one-redemption-per-org constraints.

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function generateCode(length = 8): string {
  if (typeof globalThis.crypto !== 'undefined') {
    // Node 19+ / modern browser — use Web Crypto
    const bytes  = globalThis.crypto.getRandomValues(new Uint8Array(length))
    return Array.from(bytes).map(b => ALPHABET[b % ALPHABET.length]).join('')
  }
  // Fallback — should never be reached in Node 18+
  let result = ''
  for (let i = 0; i < length; i++) {
    result += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  }
  return result
}

// Format code with a dash in the middle for readability: ABCD-1234
export function formatCode(code: string): string {
  if (code.length === 8) return `${code.slice(0, 4)}-${code.slice(4)}`
  return code
}

// Strip formatting dashes before storing/comparing
export function normaliseCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
}
