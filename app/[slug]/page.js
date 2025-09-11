import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import MapView from './MapView' // ← MapView 側が 'use client' なのでそのままOK

export default async function MapSlugPage({ params }) {
  // ✅ Next.js 15：params は await してから取り出す
  const { slug } = await params

  // ✅ headers() も await が必要
  const h = await headers()
  const host = h.get('host')
  const proto = process.env.VERCEL ? 'https' : 'http'

  const res = await fetch(`${proto}://${host}/api/maps/${encodeURIComponent(slug)}`, {
    cache: 'no-store',
  })

  if (!res.ok) {
    if (res.status === 404) notFound()
    throw new Error(`Failed to fetch map meta: ${res.status}`)
  }

  const data = await res.json()
  if (!data.ok || !data.map) notFound()

  const map = data.map
  const initialView = {
    lng: map.center_lon ?? 139.719,
    lat: map.center_lat ?? 35.681,
    zoom: map.zoom ?? 12,
    styleUrl:
      map.style_url ??
      `${process.env.NEXT_PUBLIC_MAP_STYLE || 'https://api.maptiler.com/maps/streets/style.json'}?key=${process.env.NEXT_PUBLIC_MAP_KEY || ''}`,
    language: map.language ?? 'ja',
  }

  return (
    <div className="w-full h-[100dvh]">
      <MapView slug={slug} initialView={initialView} />
    </div>
  )
}
