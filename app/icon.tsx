import { ImageResponse } from 'next/og'

export const size = {
    width: 32,
    height: 32,
}
export const contentType = 'image/png'

export default function Icon() {
    return new ImageResponse(
        (
            <div
                style={{
                    width: 32,
                    height: 32,
                    borderRadius: 7,
                    background: '#171717',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 3,
                }}
            >
                {/* AudioLines icon — 3 vertical bars */}
                <div style={{ width: 3, height: 14, background: 'white', borderRadius: 2 }} />
                <div style={{ width: 3, height: 22, background: 'white', borderRadius: 2 }} />
                <div style={{ width: 3, height: 10, background: 'white', borderRadius: 2 }} />
            </div>
        ),
        { ...size }
    )
}
