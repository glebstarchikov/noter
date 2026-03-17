import { NextResponse } from 'next/server'

export function errorResponse(error: string, code: string, status: number) {
  return NextResponse.json({ error, code }, { status })
}

export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json({ data, error: null }, { status })
}
