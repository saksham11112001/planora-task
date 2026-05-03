/**
 * Cloudflare R2 storage client (S3-compatible, zero egress fees).
 *
 * Required env vars (all must be set to activate R2):
 *   R2_ACCOUNT_ID          – Cloudflare account ID (found in dashboard URL)
 *   R2_ACCESS_KEY_ID       – R2 API token "Access Key ID"
 *   R2_SECRET_ACCESS_KEY   – R2 API token "Secret Access Key"
 *   R2_BUCKET_NAME         – bucket name (default: floatup-attachments)
 *
 * When env vars are absent the helper functions throw with a clear message
 * so callers can detect R2 as unconfigured and fall back gracefully.
 */
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// ── Configuration ─────────────────────────────────────────────────────────────

const R2_ACCOUNT_ID       = process.env.R2_ACCOUNT_ID
const R2_ACCESS_KEY_ID    = process.env.R2_ACCESS_KEY_ID
const R2_SECRET_ACCESS_KEY= process.env.R2_SECRET_ACCESS_KEY
export const R2_BUCKET    = process.env.R2_BUCKET_NAME ?? 'floatup-attachments'

/**
 * True when all required R2 environment variables are present.
 * Use this in upload routes to decide whether to use R2 or a fallback.
 */
export const R2_CONFIGURED =
  Boolean(R2_ACCOUNT_ID) &&
  Boolean(R2_ACCESS_KEY_ID) &&
  Boolean(R2_SECRET_ACCESS_KEY)

// ── Client (lazy — only constructed when vars are present) ────────────────────

function getR2Client(): S3Client {
  if (!R2_CONFIGURED) {
    throw new Error(
      'R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY in your environment.'
    )
  }
  return new S3Client({
    region:   'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId:     R2_ACCESS_KEY_ID!,
      secretAccessKey: R2_SECRET_ACCESS_KEY!,
    },
  })
}

// Singleton — created once on first use (after env is verified)
let _r2: S3Client | null = null
function r2(): S3Client {
  if (!_r2) _r2 = getR2Client()
  return _r2
}

// ── Operations ────────────────────────────────────────────────────────────────

/**
 * Upload a file buffer to R2. Throws if R2 is not configured.
 */
export async function uploadToR2(
  key:         string,
  body:        Buffer | Uint8Array,
  contentType: string,
): Promise<void> {
  await r2().send(new PutObjectCommand({
    Bucket:      R2_BUCKET,
    Key:         key,
    Body:        body,
    ContentType: contentType,
  }))
}

/**
 * Delete an object from R2. Silently ignores missing keys.
 * No-ops if R2 is not configured.
 */
export async function deleteFromR2(key: string): Promise<void> {
  if (!R2_CONFIGURED) return
  try {
    await r2().send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }))
  } catch {
    // Key not found — nothing to delete
  }
}

/**
 * Generate a time-limited presigned download URL.
 *
 * @param key        R2 object key (= storage_path stored in DB)
 * @param expiresIn  Seconds until URL expires (default 300, max 604800 = 7 days)
 * @param fileName   When set, adds Content-Disposition: attachment header
 */
export async function r2SignedUrl(
  key:       string,
  expiresIn = 300,
  fileName?: string,
): Promise<string> {
  const cmd = new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key:    key,
    ...(fileName
      ? { ResponseContentDisposition: `attachment; filename="${fileName.replace(/"/g, '')}"` }
      : {}),
  })
  return getSignedUrl(r2(), cmd, { expiresIn })
}
