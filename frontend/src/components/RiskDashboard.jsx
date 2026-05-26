import React from 'react';
import { AlertOctagon, AlertTriangle, ShieldCheck, HelpCircle } from 'lucide-react';

export default function RiskDashboard({ risks, onSelectChunk }) {
  if (!risks) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
        <HelpCircle size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
        <p>No document analysis loaded yet.</p>
      </div>
    );
  }

  const { summary, flags } = risks;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h2 style={{ fontSize: '1.4rem', fontFamily: 'var(--font-heading)', marginBottom: '0.25rem' }}>
          Contract Risk Diagnostics
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Automated scan identifying potential liabilities and standard red-flags.
        </p>
      </div>

      {/* Metrics breakdown cards */}
      <div className="metrics-row">
        <div className="metric-card high">
          <div className="label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <AlertOctagon size={12} color="var(--high-risk)" /> High Risk
          </div>
          <div className="value" style={{ color: 'var(--high-risk)' }}>
            {summary.high || 0}
          </div>
        </div>

        <div className="metric-card medium">
          <div className="label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <AlertTriangle size={12} color="var(--med-risk)" /> Med Risk
          </div>
          <div className="value" style={{ color: 'var(--med-risk)' }}>
            {summary.medium || 0}
          </div>
        </div>

        <div className="metric-card low">
          <div className="label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <ShieldCheck size={12} color="var(--low-risk)" /> Low Risk
          </div>
          <div className="value" style={{ color: 'var(--low-risk)' }}>
            {summary.low || 0}
          </div>
        </div>
      </div>

      {/* Flagged clause scroll list */}
      <div className="clause-list">
        {flags && flags.length > 0 ? (
          flags.map((f, i) => (
            <div
              key={i}
              className={`clause-card ${f.risk_level}`}
              onClick={() => onSelectChunk && onSelectChunk(f.chunk_index)}
              title="Click to view original source citation"
            >
              <div className="clause-header">
                <span className="clause-title">{f.clause_type}</span>
                <span className={`risk-badge ${f.risk_level}`}>
                  {f.risk_level}
                </span>
              </div>
              <p className="clause-translation">{f.plain_english}</p>
              {f.concerns && f.concerns.length > 0 && (
                <ul className="concerns-list">
                  {f.concerns.map((concern, j) => (
                    <li key={j}>{concern}</li>
                  ))}
                </ul>
              )}
            </div>
          ))
        ) : (
          <div
            style={{
              textAlign: 'center',
              padding: '2rem',
              color: 'var(--text-muted)',
              border: '1px dashed var(--border-color)',
              borderRadius: '12px',
              fontSize: '0.9rem',
            }}
          >
            🎉 No critical risks identified in this agreement.
          </div>
        )}
      </div>
    </div>
  );
}
