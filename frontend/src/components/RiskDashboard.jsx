import React, { useState } from 'react';
import {
  AlertOctagon, AlertTriangle, ShieldCheck, HelpCircle,
  Download, ChevronDown, ChevronUp, Copy, Check,
  FileEdit, MessageCircle, Gauge
} from 'lucide-react';
import { downloadReport } from '../api';
import RiskGauge from './RiskGauge';
import RiskDonut from './RiskDonut';

export default function RiskDashboard({ risks, onSelectChunk }) {
  const [expandedCard, setExpandedCard] = useState(null);
  const [activeTab, setActiveTab] = useState({});
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [highlightedRisk, setHighlightedRisk] = useState(null);

  if (!risks) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
        <HelpCircle size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
        <p>No document analysis loaded yet.</p>
      </div>
    );
  }

  const { summary, flags, doc_id } = risks;

  const handleDownloadReport = async () => {
    setIsDownloading(true);
    try {
      await downloadReport(doc_id);
    } catch (err) {
      console.error('Failed to download report:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopyRewrite = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const toggleExpand = (index) => {
    setExpandedCard(expandedCard === index ? null : index);
  };

  const getTabForCard = (index) => activeTab[index] || 'original';
  const setTabForCard = (index, tab) => setActiveTab((prev) => ({ ...prev, [index]: tab }));

  // Severity bar gradient
  const getSeverityColor = (score) => {
    if (score <= 3) return 'var(--low-risk)';
    if (score <= 6) return 'var(--med-risk)';
    return 'var(--high-risk)';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontFamily: 'var(--font-heading)', marginBottom: '0.25rem' }}>
            Contract Risk Diagnostics
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            AI-powered scan with clause rewriting & negotiation strategies.
          </p>
        </div>
        <button
          onClick={handleDownloadReport}
          disabled={isDownloading}
          className="download-report-btn"
          title="Download PDF Risk Report"
        >
          {isDownloading ? (
            <div className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} />
          ) : (
            <Download size={14} />
          )}
          <span>{isDownloading ? 'Generating...' : 'PDF Report'}</span>
        </button>
      </div>

      {/* Visual Analytics Row — Gauge + Donut */}
      <div className="analytics-row">
        <div className="analytics-card">
          <RiskGauge score={summary.overall_score || 0} />
          <p className="analytics-label">Overall Risk Score</p>
        </div>
        <div className="analytics-card">
          <RiskDonut
            summary={summary}
            onSegmentHover={(key) => setHighlightedRisk(key)}
          />
          <p className="analytics-label">Risk Distribution</p>
        </div>
      </div>

      {/* Flagged clause scroll list */}
      <div className="clause-list">
        {flags && flags.length > 0 ? (
          flags.map((f, i) => {
            const isExpanded = expandedCard === i;
            const currentTab = getTabForCard(i);
            const isHighlighted = !highlightedRisk || highlightedRisk === f.risk_level;

            return (
              <div
                key={i}
                className={`clause-card ${f.risk_level} ${isExpanded ? 'expanded' : ''}`}
                style={{
                  opacity: isHighlighted ? 1 : 0.3,
                  transition: 'all 0.3s ease',
                }}
              >
                {/* Main card header */}
                <div
                  className="clause-header"
                  onClick={() => onSelectChunk && onSelectChunk(f.chunk_index)}
                  title="Click to view original source citation"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="clause-title">{f.clause_type}</span>
                    <span className={`risk-badge ${f.risk_level}`}>
                      {f.risk_level}
                    </span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleExpand(i); }}
                    className="expand-btn"
                    title={isExpanded ? 'Collapse' : 'Expand for rewrite & tips'}
                  >
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>

                {/* Severity bar */}
                {f.severity_score && (
                  <div className="severity-bar-container">
                    <div className="severity-bar-track">
                      <div
                        className="severity-bar-fill"
                        style={{
                          width: `${(f.severity_score / 10) * 100}%`,
                          background: getSeverityColor(f.severity_score),
                        }}
                      />
                    </div>
                    <span className="severity-label" style={{ color: getSeverityColor(f.severity_score) }}>
                      {f.severity_score}/10
                    </span>
                  </div>
                )}

                <p className="clause-translation">{f.plain_english}</p>

                {f.concerns && f.concerns.length > 0 && (
                  <ul className="concerns-list">
                    {f.concerns.map((concern, j) => (
                      <li key={j}>{concern}</li>
                    ))}
                  </ul>
                )}

                {/* Expanded section with tabs */}
                {isExpanded && (
                  <div className="clause-expanded">
                    <div className="clause-tabs">
                      <button
                        className={`clause-tab ${currentTab === 'original' ? 'active' : ''}`}
                        onClick={() => setTabForCard(i, 'original')}
                      >
                        <Gauge size={12} /> Original
                      </button>
                      {f.suggested_rewrite && (
                        <button
                          className={`clause-tab ${currentTab === 'rewrite' ? 'active' : ''}`}
                          onClick={() => setTabForCard(i, 'rewrite')}
                        >
                          <FileEdit size={12} /> Suggested Rewrite
                        </button>
                      )}
                      {f.negotiation_tip && (
                        <button
                          className={`clause-tab ${currentTab === 'negotiate' ? 'active' : ''}`}
                          onClick={() => setTabForCard(i, 'negotiate')}
                        >
                          <MessageCircle size={12} /> Negotiation Tip
                        </button>
                      )}
                    </div>

                    <div className="clause-tab-content">
                      {currentTab === 'original' && (
                        <div className="tab-panel">
                          <p className="original-text">"{f.raw_text}"</p>
                        </div>
                      )}
                      {currentTab === 'rewrite' && f.suggested_rewrite && (
                        <div className="tab-panel rewrite">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <p className="rewrite-text">"{f.suggested_rewrite}"</p>
                            <button
                              className="copy-btn"
                              onClick={() => handleCopyRewrite(f.suggested_rewrite, i)}
                              title="Copy to clipboard"
                            >
                              {copiedIndex === i ? <Check size={14} color="var(--low-risk)" /> : <Copy size={14} />}
                            </button>
                          </div>
                        </div>
                      )}
                      {currentTab === 'negotiate' && f.negotiation_tip && (
                        <div className="tab-panel negotiate">
                          <p className="negotiate-text">💬 "{f.negotiation_tip}"</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
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
