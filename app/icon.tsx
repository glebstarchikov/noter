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
                    gap: 2,
                }}
            >
                {/* AudioLines motif — 6 asymmetric bars matching lucide AudioLines */}
                <div style={{ width: 2, height: 4, background: 'white', borderRadius: 1 }} />
                <div style={{ width: 2, height: 15, background: 'white', borderRadius: 1 }} />
                <div style={{ width: 2, height: 24, background: 'white', borderRadius: 1 }} />
                <div style={{ width: 2, height: 9, background: 'white', borderRadius: 1 }} />
                <div style={{ width: 2, height: 17, background: 'white', borderRadius: 1 }} />
                <div style={{ width: 2, height: 4, background: 'white', borderRadius: 1 }} />
            </div>
        ),
        { ...size }
    )
}
