import React, { useEffect, useState } from 'react';

/**
 * Animated SVG semicircle gauge displaying overall contract risk score (0-100).
 * Needle and arc animate on mount. Color transitions green → amber → red.
 */
export default function RiskGauge({ score = 0 }) {
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    // Animate from 0 to target score
    let frame;
    let start = null;
    const duration = 1200;

    const animate = (timestamp) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(Math.round(eased * score));
      if (progress < 1) {
        frame = requestAnimationFrame(animate);
      }
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [score]);

  // SVG calculations
  const cx = 120, cy = 110, r = 85;
  const startAngle = Math.PI; // 180°
  const endAngle = 0;        // 0° (right side)
  const angleRange = Math.PI;

  // Score-to-angle
  const scoreAngle = startAngle - (animatedScore / 100) * angleRange;

  // Arc path for background
  const arcPath = (start, end) => {
    const x1 = cx + r * Math.cos(start);
    const y1 = cy - r * Math.sin(start);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy - r * Math.sin(end);
    const largeArc = Math.abs(start - end) > Math.PI ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
  };

  // Color based on score
  const getColor = (s) => {
    if (s < 25) return '#16a34a';     // Green
    if (s < 45) return '#65a30d';     // Yellow-Green
    if (s < 60) return '#eab308';     // Amber
    if (s < 80) return '#ea580c';     // Orange
    return '#dc2626';                  // Red
  };

  const color = getColor(animatedScore);
  const label = animatedScore < 30 ? 'LOW RISK' : animatedScore < 60 ? 'MODERATE' : animatedScore < 80 ? 'HIGH RISK' : 'CRITICAL';

  // Needle endpoint
  const needleX = cx + (r - 10) * Math.cos(scoreAngle);
  const needleY = cy - (r - 10) * Math.sin(scoreAngle);

  // Gradient stops for the filled arc
  const filledArcEnd = startAngle - (animatedScore / 100) * angleRange;

  return (
    <div className="risk-gauge-container">
      <svg viewBox="0 0 240 135" width="100%" style={{ maxWidth: '280px' }}>
        {/* Background arc (grey) */}
        <path
          d={arcPath(startAngle, endAngle)}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="14"
          strokeLinecap="round"
        />

        {/* Filled arc (colored by score) */}
        {animatedScore > 0 && (
          <path
            d={arcPath(startAngle, filledArcEnd)}
            fill="none"
            stroke={color}
            strokeWidth="14"
            strokeLinecap="round"
            style={{
              filter: `drop-shadow(0 0 8px ${color}40)`,
              transition: 'stroke 0.3s ease',
            }}
          />
        )}

        {/* Needle */}
        <line
          x1={cx}
          y1={cy}
          x2={needleX}
          y2={needleY}
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          style={{ transition: 'all 0.1s linear' }}
        />

        {/* Center dot */}
        <circle cx={cx} cy={cy} r="5" fill={color} style={{ filter: `drop-shadow(0 0 6px ${color}60)` }} />

        {/* Score text */}
        <text
          x={cx}
          y={cy + 25}
          textAnchor="middle"
          style={{
            fontSize: '28px',
            fontWeight: '800',
            fontFamily: 'Outfit, sans-serif',
            fill: color,
          }}
        >
          {animatedScore}
        </text>

        {/* Label */}
        <text
          x={cx}
          y={cy + 42}
          textAnchor="middle"
          style={{
            fontSize: '9px',
            fontWeight: '600',
            letterSpacing: '0.12em',
            fontFamily: 'Inter, sans-serif',
            fill: 'var(--text-muted)',
          }}
        >
          {label}
        </text>

        {/* Scale labels */}
        <text x="25" y={cy + 8} style={{ fontSize: '8px', fill: 'var(--text-muted)', fontFamily: 'Inter' }}>0</text>
        <text x="210" y={cy + 8} style={{ fontSize: '8px', fill: 'var(--text-muted)', fontFamily: 'Inter' }}>100</text>
      </svg>
    </div>
  );
}
