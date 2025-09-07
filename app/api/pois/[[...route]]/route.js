import app from '../../../../api/pois/app.js';

export const runtime = 'edge';

export const GET = (req) => {
  const url = new URL(req.url);
  req.url = url.pathname.replace(/^\/api\/pois/, '') || '/'; // パスを修正
  return app.fetch(req);
};

export const POST = (req) => {
  const url = new URL(req.url);
  req.url = url.pathname.replace(/^\/api\/pois/, '') || '/'; // パスを修正
  return app.fetch(req);
};