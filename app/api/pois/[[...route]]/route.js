import app from '@/api/pois/app.js';

// ローカル検証は Node.js ランタイムの方が安定
export const runtime = 'nodejs';

export const GET  = (req) => app.fetch(req);
export const POST = (req) => app.fetch(req);