// app/api/[[...route]]/route.js
import app from '@/lib/pois/app.js'
export const runtime = 'edge'
export const GET = (req) => app.fetch(req)
export const POST = GET
