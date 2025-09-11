// api/pois/app.js
import { Hono } from 'hono';
import { rowsToFeatureCollection } from '@/lib/geojson.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const DEFAULT_POI_COLOR = 'rgba(90, 90, 90, 1)'

const app = new Hono(); // ← 最初に定義してから使う

// Supabase RPC 呼び出し
async function callRpc(fn, payload) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`RPC ${fn} ${res.status}: ${text}`);
  }
  return res.json();
}

// maps のデフォルト取得
async function fetchMapDefaults(slug) {
  const url =
    `${SUPABASE_URL}/rest/v1/maps` +
    `?slug=eq.${encodeURIComponent(slug)}` +
    `&select=poi_color,poi_icon_url,poi_icon_size` +
    `&limit=1`;

  const r = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    cache: 'no-store',
  });
  if (!r.ok) return {};
  const rows = await r.json();
  if (!rows?.length) return {};
  return {
    color: rows[0].poi_color || null,
    icon_url: rows[0].poi_icon_url || null,
    icon_size: rows[0].poi_icon_size || null,
  };
}

// rows から GeoJSON を作るときに properties を拡張
function rowsToFeatureCollectionWithStyle(rows, defaults) {
  return {
    type: 'FeatureCollection',
    features: rows.map((r) => ({
      type: 'Feature',
      properties: {
        id: r.id,
        title: r.title,
        // 個別 > デフォルト > フォールバック
        color: r.color || defaults.color || 'rgba(0, 0, 0, 1)',
        icon_url: r.icon_url || defaults.icon_url || null,
        icon_size: r.icon_size || defaults.icon_size || 0.9,
      },
      geometry: { type: 'Point', coordinates: [r.lon, r.lat] },
    })),
  };
}

// ヘルスチェック: /api/pois/health
app.get('/api/pois/health', async (c) => {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    return c.json({ ok: true, status: r.status });
  } catch (e) {
    const cause = e.cause || {};
    return c.json({
      ok: false,
      error: String(e),
      cause: {
        name: cause.name,
        code: cause.code,
        errno: cause.errno,
        syscall: cause.syscall,
        hostname: cause.hostname,
        address: cause.address,
        port: cause.port,
      },
    }, 500);
  }
});

// /api/pois?map=...&bbox=...
app.get('/api/pois', async (c) => {
  const { map, bbox, tags } = c.req.query();
  if (!map || !bbox) return c.json({ error: 'map and bbox are required' }, 400);

  const [minLon, minLat, maxLon, maxLat] = bbox.split(',').map(Number);
  if ([minLon, minLat, maxLon, maxLat].some(Number.isNaN)) {
    return c.json({ error: 'invalid bbox' }, 400);
  }
  const tagsArr = tags ? String(tags).split(',').filter(Boolean) : null;

  // ① デフォルト取得
  const defaults = await fetchMapDefaults(map);

  // ② POI 取得（既存 RPC）
  const rows = await callRpc('pois_in_bbox', {
    p_map_slug: map,
    p_min_lon: minLon, p_min_lat: minLat,
    p_max_lon: maxLon, p_max_lat: maxLat,
    p_tags: tagsArr,
  });

  // ③ GeoJSON 拡張
  return c.json(
    rowsToFeatureCollectionWithStyle(rows, defaults),
    200,
    { 'Cache-Control': 'public, max-age=15, stale-while-revalidate=60' }
  );
});

// /api/pois/nearby?map=...&lon=...&lat=...&radius=...
app.get('/api/pois/nearby', async (c) => {
  const { map, lon, lat, radius = '2000', tags } = c.req.query();
  if (!map || !lon || !lat) return c.json({ error: 'map, lon, lat are required' }, 400);
  const tagsArr = (tags ? String(tags).split(',').filter(Boolean) : null);

  const rows = await callRpc('pois_nearby', {
    p_map_slug: map,
    p_lon: Number(lon), p_lat: Number(lat),
    p_radius_m: Number(radius), p_tags: tagsArr,
  });
  return c.json(rowsToFeatureCollection(rows), 200, {
    'Cache-Control': 'public, max-age=15, stale-while-revalidate=60',
  });
});

app.all('/api/pois/*', (c) => c.json({ ok:false, msg:'no match', path: c.req.path }, 404));

// lib/pois/app.js （追記）
app.get('/api/maps/:slug', async (c) => {
  const { slug } = c.req.param()
  const url =
    `${SUPABASE_URL}/rest/v1/maps` +
    `?slug=eq.${encodeURIComponent(slug)}` +
    `&select=slug,title,poi_icon_url` +
    `&limit=1`

  const r = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    // ここはキャッシュなしでOK（お好みで調整）
    cache: 'no-store',
  })

  if (!r.ok) return c.json({ ok:false, status:r.status }, r.status)
  const rows = await r.json()
  if (!rows.length) return c.json({ ok:false, msg:'map not found' }, 404)

  return c.json({ ok:true, map: rows[0] })
})


export default app;
