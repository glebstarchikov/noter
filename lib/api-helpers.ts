import { NextResponse } from 'next/server'

export function errorResponse(error: string, code: string, status: number) {
  return NextResponse.json({ error, code }, { status })
}
