import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Agents Trail',
    short_name: 'Agents Trail',
    description: 'Local session tracing and replay dashboard for AI coding agents.',
    start_url: '/all/dashboard',
    display: 'standalone',
    background_color: '#070b09',
    theme_color: '#ffb000',
    icons: [
      {
        src: '/brand/agent-trail-icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/brand/agent-trail-icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
