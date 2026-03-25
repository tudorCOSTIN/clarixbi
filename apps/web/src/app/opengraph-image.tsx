import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'ClarixBI — Business Intelligence for Romanian SMBs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    <div
      style={{
        background: 'linear-gradient(135deg, #0a1628 0%, #1a2d4f 100%)',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontFamily: 'system-ui',
      }}
    >
      <div style={{ fontSize: 72, fontWeight: 700, letterSpacing: -2, display: 'flex' }}>
        <span style={{ color: '#1565C0' }}>Clarix</span>
        <span style={{ color: '#00BCD4' }}>BI</span>
      </div>
      <div style={{ fontSize: 28, marginTop: 16, color: '#94a3b8' }}>
        Business Intelligence for Romanian SMBs
      </div>
    </div>,
    { ...size },
  );
}
