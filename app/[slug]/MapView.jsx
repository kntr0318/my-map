'use client'
import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'

// 円＋三角のピン型アイコンをCanvasで描画
async function generatePinnedCircleIcon({ color = '#000', iconUrl = null, size = 64 }) {
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')

    // --- 背景円 ---
    const svgH = 24
    const tipOrig = (22 / svgH) * size                 // 元の先端Y
    const dy = size - tipOrig                          // 先端が下端(size)に来る補正量
    const cx = (10 / svgH) * size
    const cy = (8 / svgH) * size + dy
    const r = (8 / svgH) * size

    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()

    // --- 下向き三角 ---
    const triY = (16 / svgH) * size + dy
    const triTipY = size - 1                           // ほぼ下端に合わせる
    const triLeftX = (8 / svgH) * size
    const triRightX = (12 / svgH) * size
    const triTipX = (10 / svgH) * size

    ctx.beginPath()
    ctx.moveTo(triLeftX, triY)
    ctx.lineTo(triRightX, triY)
    ctx.lineTo(triTipX, triTipY)
    ctx.closePath()
    ctx.fillStyle = color
    ctx.fill()



    // 画像があれば中央に丸くクリップして描画
    if (iconUrl) {
        const img = await new Promise((resolve, reject) => {
            const image = new Image()
            image.crossOrigin = 'anonymous'
            image.onload = () => resolve(image)
            image.onerror = reject
            image.src = iconUrl
        })
        const insetR = r * 0.65
        const insetD = insetR * 2
        const ox = cx - insetR
        const oy = cy - insetR

        ctx.save()
        ctx.beginPath()
        ctx.arc(cx, cy, insetR, 0, Math.PI * 2)
        ctx.clip()
        ctx.drawImage(img, ox, oy, insetD, insetD)
        ctx.restore()
    }

    return await createImageBitmap(canvas)
}


export default function MapView({ slug, initialView }) {
    const mapRef = useRef(null)
    const containerRef = useRef(null)

    // ★ ベースSource/Layerを必ず用意
    const ensureBaseLayers = async (m) => {

        if (!m.getSource('pois')) {
            m.addSource('pois', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] },
            })
        }
        if (!m.getLayer('poi-unclustered-pin')) {
            m.addLayer({
                id: 'poi-unclustered-pin',
                type: 'symbol',
                source: 'pois',
                filter: ['!', ['has', 'point_count']],
                layout: {
                    'icon-image': ['get', 'image_id'], // 初期は既存のデフォルトピンを使う
                    'icon-size': ['coalesce', ['get', 'icon_size'], 1.5],
                    'icon-size': 1.3,
                    'icon-anchor': 'bottom',
                    'icon-allow-overlap': true,
                },
            })
        }
        if (!m.getLayer('poi-unclustered-logo')) {
            m.addLayer({
                id: 'poi-unclustered-logo',
                type: 'symbol',
                source: 'pois',
                filter: ['all', ['!', ['has', 'point_count']], ['has', 'icon_url']],
                layout: {
                    'icon-image': ['get', 'icon_url'],
                    'icon-size': ['coalesce', ['get', 'icon_size'], 0.6],
                    'icon-anchor': 'center',
                    'icon-allow-overlap': true,
                    'icon-offset': [0, -6],
                },
            })
        }
    }

    useEffect(() => {
        if (mapRef.current) return

        const m = new maplibregl.Map({
            container: containerRef.current,
            style: initialView.styleUrl,
            center: [initialView.lng, initialView.lat],
            zoom: initialView.zoom,
            hash: true,
        })
        mapRef.current = m

        m.on('load', async () => {
            await ensureBaseLayers(m)

            const load = async () => {
                const mm = mapRef.current
                if (!mm) return

                const b = mm.getBounds()
                const bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].join(',')
                const geo = await fetch(`/api/pois?map=${encodeURIComponent(slug)}&bbox=${bbox}`).then(r => r.json())

                // 必要な色/ロゴを事前登録
                const colors = new Set()
                const logos = new Set()
                for (const f of geo.features || []) {
                    const color = f.properties?.color || 'rgba(42, 42, 42, 1)'
                    const iconUrl = f.properties?.icon_url || null
                    const key = `poi-${f.properties.id}`  // 各POIごとにユニークなID

                    if (!mm.hasImage(key)) {
                        const img = await generatePinnedCircleIcon({ color, iconUrl, size: 64 })
                        mm.addImage(key, img, { pixelRatio: 2 })
                    }
                    f.properties.image_id = key
                }

                const src = mm.getSource('pois')
                if (src && src.type === 'geojson') src.setData(geo)
            }

            await load()
            m.on('moveend', load)
        })

        return () => {
            mapRef.current?.remove()
            mapRef.current = null
        }
    }, [slug, initialView])

    return <div ref={containerRef} className="w-full h-full" />
}
