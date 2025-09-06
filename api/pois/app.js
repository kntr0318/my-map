// api/pois/app.js
import { Hono } from 'hono';
import { rowsToFeatureCollection } from '../../lib/geojson.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

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
  const tagsArr = (tags ? String(tags).split(',').filter(Boolean) : null);

  const rows = await callRpc('pois_in_bbox', {
    p_map_slug: map,
    p_min_lon: minLon, p_min_lat: minLat, p_max_lon: maxLon, p_max_lat: maxLat,
    p_tags: tagsArr,
  });
  return c.json(rowsToFeatureCollection(rows), 200, {
    'Cache-Control': 'public, max-age=15, stale-while-revalidate=60',
  });
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

export default app;
