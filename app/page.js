'use client';
import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';

export default function Home() {
  const mapRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (mapRef.current) return;
    const styleUrl = `${process.env.NEXT_PUBLIC_MAP_STYLE}?key=${process.env.NEXT_PUBLIC_MAP_KEY}`;

    const map = new maplibregl.Map({
    container: 'map',
    style: styleUrl,              // ← これで道路・建物・ラベルがしっかり出ます
    center: [139.7006, 35.6595],
    zoom: 12
    });
    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.on('load', () => setReady(true));
    mapRef.current = map;
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;

    const fetchPois = async () => {
      const b = map.getBounds();
      const bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].join(',');
      try {
        const res = await fetch(`/api/pois?map=demo-tokyo&bbox=${bbox}`);
        if (!res.ok) return;
        const geojson = await res.json();

        if (map.getSource('pois')) {
          map.getSource('pois').setData(geojson);
        } else {
          map.addSource('pois', { type: 'geojson', data: geojson, cluster: true, clusterRadius: 50 });
          map.addLayer({ id: 'cluster', type: 'circle', source: 'pois', filter: ['has', 'point_count'],
            paint: { 'circle-radius': ['step', ['get','point_count'], 14, 50, 20, 150, 28], 'circle-opacity': 0.8 } });
          map.addLayer({ id: 'cluster-count', type: 'symbol', source: 'pois', filter: ['has','point_count'],
            layout: { 'text-field': '{point_count_abbreviated}', 'text-size': 12 } });
          map.addLayer({ id: 'poi', type: 'circle', source: 'pois', filter: ['!', ['has','point_count']],
            paint: { 'circle-radius': 6, 'circle-opacity': 0.9 } });
        }
      } catch (_) {}
    };

    fetchPois();
    map.on('moveend', fetchPois);
    return () => map.off('moveend', fetchPois);
  }, [ready]);

  return <div id="map" className="w-screen h-screen" />;
}
