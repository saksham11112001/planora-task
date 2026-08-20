import { ImageResponse } from 'next/og'

/**
 * Social share card, rendered as a real PNG.
 *
 * The metadata previously pointed og:image and twitter:image at
 * /og-image.svg. No major social platform renders SVG for a share card —
 * Facebook, LinkedIn, WhatsApp, Slack and X all require PNG or JPEG — so
 * every link to upfloat.co was shared with a blank preview. The asset looked
 * correct in a browser, which is why it read as done.
 *
 * Generating it here instead of committing a binary keeps the card in sync
 * with the brand automatically, and Next renders and caches it at build time.
 * Both the marketing site and the MSME sub-site inherit it unless they define
 * their own opengraph-image file.
 *
 * Layout note: this is rendered by Satori, not a browser. Every element that
 * has more than one child needs an explicit display:flex, and only a subset of
 * CSS is supported — keep it to flexbox, colours and text.
 */

export const runtime = 'edge'
export const alt = 'upFloat — practice management for CA and CPA firms'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          backgroundColor: '#f0fdfa',
          backgroundImage: 'linear-gradient(135deg, #f0fdfa 0%, #e0f2fe 100%)',
        }}
      >
        {/* Brand lockup */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '80px',
              height: '80px',
              borderRadius: '20px',
              backgroundColor: '#0d9488',
              color: '#ffffff',
              fontSize: '38px',
              fontWeight: 800,
            }}
          >
            uF
          </div>
          <div style={{ display: 'flex', fontSize: '48px', fontWeight: 800, color: '#0d9488' }}>
            upFloat
          </div>
        </div>

        {/* Headline */}
        <div
          style={{
            display: 'flex',
            marginTop: '56px',
            fontSize: '56px',
            fontWeight: 700,
            color: '#0f172a',
            lineHeight: 1.15,
            maxWidth: '900px',
          }}
        >
          Practice management for CA &amp; CPA firms
        </div>

        {/* Subhead */}
        <div
          style={{
            display: 'flex',
            marginTop: '28px',
            fontSize: '30px',
            color: '#475569',
            maxWidth: '900px',
          }}
        >
          Statutory compliance calendars, recurring work, approvals and client portals — in one place.
        </div>

        <div style={{ display: 'flex', marginTop: '48px', fontSize: '26px', color: '#0d9488', fontWeight: 600 }}>
          upfloat.co
        </div>
      </div>
    ),
    size,
  )
}
