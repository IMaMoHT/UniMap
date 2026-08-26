import './Fountain.css';

interface FountainProps {
  x: number;
  y: number;
  size?: number;
}

/** Two-tier animated courtyard fountain in the UniMap brand palette. */
export default function Fountain({ x, y, size = 300 }: FountainProps) {
  return (
    <div className="fountain" style={{ left: x, top: y, width: size, height: size }}>
      <svg viewBox="0 0 300 300" width={size} height={size}>
        <defs>
          <radialGradient id="fnt-pool" cx="50%" cy="42%" r="62%">
            <stop offset="0%" stopColor="#8fdcd3" />
            <stop offset="65%" stopColor="#3fa9a0" />
            <stop offset="100%" stopColor="#2b827c" />
          </radialGradient>
          <linearGradient id="fnt-stone" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fbfaf6" />
            <stop offset="100%" stopColor="#d9d5c8" />
          </linearGradient>
          <linearGradient id="fnt-bowl" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#cfd8d5" />
          </linearGradient>
          <filter id="fnt-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="6" stdDeviation="10" floodColor="#0b2a27" floodOpacity="0.28" />
          </filter>
        </defs>

        <g filter="url(#fnt-shadow)">
          {/* Outer stone basin */}
          <circle cx="150" cy="150" r="140" fill="url(#fnt-stone)" stroke="#2b3440" strokeWidth="4" />
          <circle cx="150" cy="150" r="126" fill="#c7d0cd" />
          {/* Water pool */}
          <circle cx="150" cy="150" r="118" fill="url(#fnt-pool)" />
        </g>

        {/* Ripples */}
        <circle className="fountain__ripple" cx="150" cy="150" r="104" fill="none" stroke="#f0fbf8" strokeWidth="3.5" />
        <circle className="fountain__ripple fountain__ripple--2" cx="150" cy="150" r="104" fill="none" stroke="#f0fbf8" strokeWidth="3.5" />
        <circle className="fountain__ripple fountain__ripple--3" cx="150" cy="150" r="104" fill="none" stroke="#f0fbf8" strokeWidth="3.5" />

        {/* Lower tier bowl */}
        <ellipse cx="150" cy="152" rx="66" ry="60" fill="url(#fnt-bowl)" stroke="#2b3440" strokeWidth="3" />
        <ellipse cx="150" cy="146" rx="58" ry="50" fill="url(#fnt-pool)" />

        {/* Column + upper bowl */}
        <rect x="142" y="96" width="16" height="60" rx="6" fill="url(#fnt-bowl)" stroke="#2b3440" strokeWidth="2" />
        <ellipse cx="150" cy="100" rx="34" ry="14" fill="url(#fnt-bowl)" stroke="#2b3440" strokeWidth="2.5" />
        <ellipse cx="150" cy="98" rx="27" ry="9" fill="url(#fnt-pool)" />
        <circle cx="150" cy="80" r="6" fill="#e9c46a" stroke="#b3893b" strokeWidth="1.5" />

        {/* Water: central jet */}
        <rect className="fountain__jet" x="146" y="52" width="8" height="46" rx="4" fill="#eafaf7" opacity="0.9" />

        {/* Arcing streams from the upper bowl to the pool */}
        <g fill="none" stroke="#eafaf7" strokeWidth="3.4" strokeLinecap="round">
          <path className="fountain__stream" d="M150 72 C 176 92, 196 118, 198 150" />
          <path className="fountain__stream fountain__stream--b" d="M150 72 C 124 92, 104 118, 102 150" />
          <path className="fountain__stream fountain__stream--c" d="M150 74 C 172 96, 186 124, 186 150" opacity="0.85" />
          <path className="fountain__stream fountain__stream--d" d="M150 74 C 128 96, 114 124, 114 150" opacity="0.85" />
          <path className="fountain__stream fountain__stream--e" d="M150 76 C 162 100, 168 128, 166 150" opacity="0.7" />
          <path className="fountain__stream fountain__stream--f" d="M150 76 C 138 100, 132 128, 134 150" opacity="0.7" />
        </g>

        {/* Droplets */}
        <circle className="fountain__drop" cx="150" cy="120" r="5" fill="#eafaf7" />
        <circle className="fountain__drop fountain__drop--b" cx="132" cy="124" r="4" fill="#dff6f2" />
        <circle className="fountain__drop fountain__drop--c" cx="168" cy="124" r="4" fill="#dff6f2" />
      </svg>
    </div>
  );
}
