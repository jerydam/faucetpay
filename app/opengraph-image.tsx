import { ImageResponse } from 'next/og'

// Route segment config
export const runtime = 'edge'

// Image metadata
export const alt = 'FaucetDrops - Automated onchain reward and engagement platform 💧'
export const size = {
  width: 1200,
  height: 630,
}

export const contentType = '/default/jpeg'

// Image generation
export default async function Image() {
  return new ImageResponse(
    (
      // ImageResponse JSX element
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#020817', // Dark slate background matching standard shadcn/ui theme
          backgroundImage: 'radial-gradient(circle at 25px 25px, #1e293b 2%, transparent 0%), radial-gradient(circle at 75px 75px, #1e293b 2%, transparent 0%)',
          backgroundSize: '100px 100px',
        }}
      >
        {/* Glow Effect behind text */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '600px',
            height: '600px',
            background: 'radial-gradient(circle, rgba(56, 189, 248, 0.15) 0%, rgba(2, 8, 23, 0) 70%)',
            borderRadius: '50%',
          }}
        />

        {/* Main Title */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 80,
            fontWeight: 800,
            color: 'white',
            letterSpacing: '-0.02em',
            zIndex: 10,
          }}
        >
          <span style={{ marginRight: 20 }}>💧</span>
          FaucetDrops
        </div>

        {/* Subtitle */}
        <div
          style={{
            marginTop: 20,
            fontSize: 32,
            fontWeight: 500,
            color: '#94a3b8', // Slate-400
            zIndex: 10,
          }}
        >
          Automated onchain reward and engagement platform
        </div>

        {/* URL Pill */}
        <div
          style={{
            marginTop: 50,
            padding: '10px 30px',
            backgroundColor: 'rgba(56, 189, 248, 0.1)', // Light blue tint
            border: '1px solid rgba(56, 189, 248, 0.2)',
            borderRadius: '50px',
            fontSize: 20,
            color: '#38bdf8', // Sky-400
            zIndex: 10,
          }}
        >
          FaucetDrops.io
        </div>
      </div>
    ),
    // ImageResponse options
    {
      ...size,
    }
  )
}