import { ImageResponse } from 'next/og';
import { MARK_COLOURS, MARK_PATH, MARK_TRANSFORM } from './mark';

/** The home-screen icon on iOS (P10-10): the mark on full-bleed ink; the system rounds the corners. */
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    <div style={{ display: 'flex', width: '100%', height: '100%', background: MARK_COLOURS.ink }}>
      <svg
        width={size.width}
        height={size.height}
        viewBox="0 0 512 512"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path transform={MARK_TRANSFORM} fill={MARK_COLOURS.ember} d={MARK_PATH} />
      </svg>
    </div>,
    size,
  );
}
