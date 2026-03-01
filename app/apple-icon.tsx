import { ImageResponse } from 'next/og'

export const size = {
    width: 180,
    height: 180,
}
export const contentType = 'image/png'

export default function AppleIcon() {
    return new ImageResponse(
        (
            <div
                style={{
                    width: 180,
                    height: 180,
                    borderRadius: 37,
                    background: '#171717',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 16,
                }}
            >
                {/* AudioLines icon — 3 vertical bars */}
                <div style={{ width: 16, height: 80, background: 'white', borderRadius: 8 }} />
                <div style={{ width: 16, height: 120, background: 'white', borderRadius: 8 }} />
                <div style={{ width: 16, height: 56, background: 'white', borderRadius: 8 }} />
            </div>
        ),
        { ...size }
    )
}
