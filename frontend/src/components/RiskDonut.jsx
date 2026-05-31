import React, { useEffect, useState } from 'react';

/**
 * Animated SVG donut chart showing risk distribution (High/Medium/Low).
 * Hover segments to see counts. Center shows animated total.
 */
export default function RiskDonut({ summary, onSegmentHover }) {
  const [animProgress, setAnimProgress] = useState(0);
  const [hoveredSegment, setHoveredSegment] = useState(null);

  const high = summary?.high || 0;
  const medium = summary?.medium || 0;
  const low = summary?.low || 0;
  const total = high + medium + low;

  useEffect(() => {
    let frame;
    let start = null;
    const duration = 1000;

    const animate = (timestamp) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimProgress(eased);
      if (progress < 1) {
        frame = requestAnimationFrame(animate);
      }
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [total]);

  if (total === 0) {
    return (
      <div className="donut-container">
        <svg viewBox="0 0 200 200" width="100%" style={{ maxWidth: '200px' }}>
          <circle cx="100" cy="100" r="70" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="20" />
          <text x="100" y="95" textAnchor="middle" style={{ fontSize: '14px', fill: 'var(--low-risk)', fontFamily: 'Outfit', fontWeight: '700' }}>✓</text>
          <text x="100" y="115" textAnchor="middle" style={{ fontSize: '9px', fill: 'var(--text-muted)', fontFamily: 'Inter' }}>No Risks</text>
        </svg>
      </div>
    );
  }

  const cx = 100, cy = 100, r = 70;
  const circumference = 2 * Math.PI * r;

  // Calculate segments
  const segments = [];
  if (high > 0) segments.push({ count: high, color: 'var(--high-risk)', label: 'High', key: 'high' });
  if (medium > 0) segments.push({ count: medium, color: 'var(--med-risk)', label: 'Medium', key: 'medium' });
  if (low > 0) segments.push({ count: low, color: 'var(--low-risk)', label: 'Low', key: 'low' });

  let accumulated = 0;
  const arcs = segments.map((seg) => {
    const fraction = seg.count / total;
    const dashLength = fraction * circumference * animProgress;
    const gapLength = circumference - dashLength;
    const offset = -(accumulated * circumference) + (circumference * 0.25); // Start from top
    accumulated += fraction;

    return {
      ...seg,
      dashArray: `${dashLength} ${gapLength}`,
      dashOffset: offset,
    };
  });

  const displayLabel = hoveredSegment
    ? `${hoveredSegment.count} ${hoveredSegment.label}`
    : total;

  return (
    <div className="donut-container">
      <svg viewBox="0 0 200 200" width="100%" style={{ maxWidth: '200px' }}>
        {/* Background ring */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="22" />

        {/* Segment arcs */}
        {arcs.map((arc, i) => (
          <circle
            key={arc.key}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={arc.color}
            strokeWidth={hoveredSegment?.key === arc.key ? '26' : '20'}
            strokeDasharray={arc.dashArray}
            strokeDashoffset={arc.dashOffset}
            strokeLinecap="round"
            style={{
              transition: 'stroke-width 0.2s ease, filter 0.2s ease',
              filter: hoveredSegment?.key === arc.key ? `drop-shadow(0 0 10px ${arc.color})` : 'none',
              cursor: 'pointer',
            }}
            onMouseEnter={() => {
              setHoveredSegment(arc);
              onSegmentHover && onSegmentHover(arc.key);
            }}
            onMouseLeave={() => {
              setHoveredSegment(null);
              onSegmentHover && onSegmentHover(null);
            }}
          />
        ))}

        {/* Center text */}
        <text
          x={cx}
          y={hoveredSegment ? cy - 2 : cy + 2}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{
            fontSize: hoveredSegment ? '16px' : '28px',
            fontWeight: '800',
            fontFamily: 'Outfit, sans-serif',
            fill: hoveredSegment ? hoveredSegment.color : 'var(--text-main)',
            transition: 'all 0.2s ease',
          }}
        >
          {displayLabel}
        </text>
        {!hoveredSegment && (
          <text
            x={cx}
            y={cy + 20}
            textAnchor="middle"
            style={{
              fontSize: '9px',
              fill: 'var(--text-muted)',
              fontFamily: 'Inter, sans-serif',
              letterSpacing: '0.08em',
            }}
          >
            CLAUSES FLAGGED
          </text>
        )}
        {hoveredSegment && (
          <text
            x={cx}
            y={cy + 16}
            textAnchor="middle"
            style={{
              fontSize: '8px',
              fill: 'var(--text-muted)',
              fontFamily: 'Inter, sans-serif',
              letterSpacing: '0.06em',
            }}
          >
            RISK
          </text>
        )}
      </svg>

      {/* Legend */}
      <div className="donut-legend">
        {segments.map((seg) => (
          <div
            key={seg.key}
            className="donut-legend-item"
            onMouseEnter={() => {
              setHoveredSegment(seg);
              onSegmentHover && onSegmentHover(seg.key);
            }}
            onMouseLeave={() => {
              setHoveredSegment(null);
              onSegmentHover && onSegmentHover(null);
            }}
            style={{
              opacity: hoveredSegment && hoveredSegment.key !== seg.key ? 0.4 : 1,
            }}
          >
            <span className="donut-legend-dot" style={{ background: seg.color }} />
            <span className="donut-legend-label">{seg.label}</span>
            <span className="donut-legend-count" style={{ color: seg.color }}>{seg.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
