'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ShareIcon } from '@heroicons/react/24/outline'

export default function Header() {
    const pathname = usePathname()
    const [map, setMap] = useState(null)

    useEffect(() => {
        // URLからslugを抽出（例: /demo-tokyo → "demo-tokyo"）
        const parts = pathname.split('/')
        const slug = parts[1] || null

        if (!slug) return

        const fetchMap = async () => {
            try {
                const res = await fetch(`/api/maps/${slug}`)
                if (!res.ok) return
                const data = await res.json()
                setMap(data.map)
            } catch (err) {
                console.error('failed to load map', err)
            }
        }

        fetchMap()
    }, [pathname])

    const handleShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: map?.title || 'マップ',
                    url: window.location.href,
                })
            } catch (e) {
                console.log('share canceled or unsupported', e)
            }
        } else {
            // Fallback: URLコピー
            navigator.clipboard.writeText(window.location.href)
            alert('URLをコピーしました')
        }
    }

    return (
        <header className="fixed top-2.5 left-0 w-full z-50 px-3 md:top-4 md:px-6">
            <div className="mx-auto max-w-6xl py-1 bg-white/90 backdrop-blur shadow-md rounded-full border border-slate-200">
                <div className="px-6 flex items-center justify-between gap-4">
                    {/* 左側: ロゴ＋タイトル */}
                    <div className="flex items-center gap-3">
                        {map?.poi_icon_url && (
                            <img
                                src={map.poi_icon_url}
                                alt="logo"
                                className="h-6 w-6 object-contain rounded-full"
                            />
                        )}
                        <span className="font-bold text-slate-900">
                            {map?.title ?? 'マップ'}
                        </span>
                    </div>

                    {/* 右側: 共有ボタン */}
                    <button
                        onClick={handleShare}
                        className="inline-flex items-center justify-center rounded-md p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                        aria-label="共有"
                    >
                        <ShareIcon className="h-6 w-6" />
                    </button>
                </div>
            </div>
        </header>
    )
}
