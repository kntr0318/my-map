export const runtime = 'edge';

export async function GET(req, { params }) {
  return Response.json({ ok: true, from: 'next-direct', params });
}
