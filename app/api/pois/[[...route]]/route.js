// app/api/pois/[[...route]]/route.js
import app from '../../../../api/pois/app.js';
export const runtime = 'edge';
export const GET  = (req) => app.fetch(req);
export const POST = (req) => app.fetch(req);
