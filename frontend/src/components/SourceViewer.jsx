import React from 'react';
import { Bookmark, Percent } from 'lucide-react';

export default function SourceViewer({ sources, activeChunkIndex }) {
  if (!sources || sources.length === 0) {
    return null;
  }

  return (
    <div className="sources-panel">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <Bookmark size={18} color="var(--accent)" />
        <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)' }}>
          Reference Citations & Grounding Context
        </h3>
      </div>
      <div className="sources-grid">
        {sources.map((s, idx) => {
          const isActive = activeChunkIndex === s.chunk_index;
          return (
            <div
              key={idx}
              className="source-card"
              style={{
                borderColor: isActive ? 'var(--accent)' : 'var(--border-color)',
                background: isActive ? 'rgba(168, 85, 247, 0.05)' : 'rgba(255, 255, 255, 0.01)',
                boxShadow: isActive ? '0 0 15px rgba(168, 85, 247, 0.15)' : 'none',
                transform: isActive ? 'scale(1.02)' : 'none',
              }}
            >
              <div className="source-header">
                <span>Chunk #{s.chunk_index + 1}</span>
                <span className="source-score" style={{ display: 'flex', alignItems: 'center', gap: '0.1rem' }}>
                  <Percent size={10} /> Similarity: {(s.score * 100).toFixed(0)}%
                </span>
              </div>
              <p className="source-text">"{s.text}"</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
