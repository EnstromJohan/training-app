import { useId } from "react";

/** Atmospheric mountain scene used until a real photo is added (dark, warm dusk). */
export function HeroArt() {
  const id = useId().replace(/:/g, "");
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 560" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id={`sky-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b2724" />
          <stop offset="0.45" stopColor="#4a3a30" />
          <stop offset="0.62" stopColor="#2a2421" />
          <stop offset="1" stopColor="#141312" />
        </linearGradient>
        <radialGradient id={`sun-${id}`} cx="0.72" cy="0.42" r="0.5">
          <stop offset="0" stopColor="#f6b07c" stopOpacity="0.55" />
          <stop offset="0.35" stopColor="#e08a55" stopOpacity="0.18" />
          <stop offset="1" stopColor="#e08a55" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`far-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5d4a3f" />
          <stop offset="1" stopColor="#3a302b" />
        </linearGradient>
        <linearGradient id={`mid-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#38302b" />
          <stop offset="1" stopColor="#221e1b" />
        </linearGradient>
        <linearGradient id={`mist-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c99a78" stopOpacity="0" />
          <stop offset="0.5" stopColor="#c99a78" stopOpacity="0.12" />
          <stop offset="1" stopColor="#c99a78" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`fade-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.55" stopColor="#141312" stopOpacity="0" />
          <stop offset="1" stopColor="#141312" stopOpacity="1" />
        </linearGradient>
        <filter id={`grain-${id}`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.09 0" />
        </filter>
      </defs>
      <rect width="400" height="560" fill={`url(#sky-${id})`} />
      <rect width="400" height="560" fill={`url(#sun-${id})`} />
      {/* far ridge with snow */}
      <path d="M0 300 L48 262 L86 284 L150 212 L196 250 L232 228 L290 168 L338 222 L372 204 L400 226 L400 560 L0 560 Z" fill={`url(#far-${id})`} />
      <path d="M150 212 L168 232 L158 236 L146 222 Z M290 168 L310 192 L298 196 L286 182 L280 186 Z M232 228 L244 240 L236 242 Z" fill="#b8a597" opacity="0.55" />
      <rect y="250" width="400" height="90" fill={`url(#mist-${id})`} />
      {/* mid ridge */}
      <path d="M0 360 L70 310 L120 338 L188 286 L262 334 L318 300 L400 346 L400 560 L0 560 Z" fill={`url(#mid-${id})`} />
      <path d="M188 286 L210 302 L196 300 Z" fill="#6f5d50" opacity="0.5" />
      {/* foreground */}
      <path d="M0 430 L96 388 L176 414 L262 380 L340 410 L400 396 L400 560 L0 560 Z" fill="#1b1917" />
      <path d="M0 480 L120 450 L240 470 L330 446 L400 462 L400 560 L0 560 Z" fill="#151312" />
      <rect width="400" height="560" fill={`url(#fade-${id})`} />
      <rect width="400" height="560" filter={`url(#grain-${id})`} />
    </svg>
  );
}
