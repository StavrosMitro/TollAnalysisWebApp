import React from 'react';

/**
 * TollAnalysis mark: a motorway that forks at an interchange, with a data point
 * at the junction. Original inline SVG - no external logo. Reads at 24-32px.
 *
 *   <BrandMark />                     just the glyph (inherits currentColor)
 *   <BrandMark badge size={30} />     glyph inside the brand tile
 */
export default function BrandMark({ badge = false, size = 24, title }) {
  const glyph = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : 'true'}
      aria-label={title}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      {/* road trunk + fork */}
      <path
        d="M12 23V13M12 13L6.5 3M12 13L17.5 3"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* lane divider on the trunk */}
      <path d="M12 20.5v-1.6M12 17.3v-1.6" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.55" />
      {/* interchange data point */}
      <circle cx="12" cy="13" r="2.6" fill={badge ? 'var(--teal-400, #38c5d6)' : 'currentColor'} />
    </svg>
  );

  if (!badge) return glyph;

  return (
    <span
      style={{
        width: size,
        height: size,
        display: 'grid',
        placeItems: 'center',
        borderRadius: 'var(--radius-sm)',
        background: 'linear-gradient(150deg, var(--navy-700), var(--navy-900))',
        color: '#fff',
        flexShrink: 0,
      }}
    >
      {React.cloneElement(glyph, { width: Math.round(size * 0.66), height: Math.round(size * 0.66) })}
    </span>
  );
}
