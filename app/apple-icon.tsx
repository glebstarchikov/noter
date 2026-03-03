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
                    gap: 10,
                }}
            >
                {/* AudioLines motif — 6 asymmetric bars matching lucide AudioLines */}
                <div style={{ width: 12, height: 23, background: 'white', borderRadius: 6 }} />
                <div style={{ width: 12, height: 83, background: 'white', borderRadius: 6 }} />
                <div style={{ width: 12, height: 135, background: 'white', borderRadius: 6 }} />
                <div style={{ width: 12, height: 53, background: 'white', borderRadius: 6 }} />
                <div style={{ width: 12, height: 98, background: 'white', borderRadius: 6 }} />
                <div style={{ width: 12, height: 23, background: 'white', borderRadius: 6 }} />
            </div>
        ),
        { ...size }
    )
}
