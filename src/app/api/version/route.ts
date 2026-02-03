import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    version: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'dev',
    commit: process.env.VERCEL_GIT_COMMIT_SHA || 'unknown',
    branch: process.env.VERCEL_GIT_COMMIT_REF || 'unknown',
    deployed: process.env.VERCEL_GIT_COMMIT_DATE || new Date().toISOString(),
  })
}
// deploy trigger Tue Feb  3 10:16:27 EST 2026
