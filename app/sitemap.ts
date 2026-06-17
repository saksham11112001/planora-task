import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://upfloat.co'
  return [
    { url: base,                         lastModified: new Date(), changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${base}/professionals`,      lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/msme-landing`,       lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/partners`,           lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/login`,              lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.5 },
    { url: `${base}/privacy`,            lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${base}/terms`,              lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },
  ]
}
