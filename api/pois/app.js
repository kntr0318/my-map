import { Hono } from 'hono';
import { rowsToFeatureCollection } from '../../lib/geojson.js';

const app = new Hono();
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

async function callRpc(fn, payload) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`RPC ${fn} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

app.get('/', async (c) => {
  const { map, bbox, tags } = c.req.query();
  if (!map || !bbox) return c.json({ error: 'map and bbox are required' }, 400);
  const [minLon, minLat, maxLon, maxLat] = bbox.split(',').map(Number);
  if ([minLon, minLat, maxLon, maxLat].some(Number.isNaN)) return c.json({ error: 'invalid bbox' }, 400);
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

app.get('/nearby', async (c) => {
  const { map, lon, lat, radius = '2000', tags } = c.req.query();
  if (!map || !lon || !lat) return c.json({ error: 'map, lon, lat are required' }, 400);
  const tagsArr = (tags ? String(tags).split(',').filter(Boolean) : null);

  const rows = await callRpc('pois_nearby', {
    p_map_slug: map, p_lon: Number(lon), p_lat: Number(lat),
    p_radius_m: Number(radius), p_tags: tagsArr,
  });
  return c.json(rowsToFeatureCollection(rows), 200, {
    'Cache-Control': 'public, max-age=15, stale-while-revalidate=60',
  });
});

export default app;
