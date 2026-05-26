import React, { useState } from 'react';
import UploadZone from './components/UploadZone';
import RiskDashboard from './components/RiskDashboard';
import ChatPanel from './components/ChatPanel';
import SourceViewer from './components/SourceViewer';
import { getRisks } from './api';
import { ShieldAlert, RefreshCw, FileCheck } from 'lucide-react';

export default function App() {
  const [docId, setDocId] = useState(null);
  const [fileName, setFileName] = useState('');
  const [risks, setRisks] = useState(null);
  const [sources, setSources] = useState([]);
  const [activeChunkIndex, setActiveChunkIndex] = useState(null);
  const [isLoadingRisks, setIsLoadingRisks] = useState(false);

  const handleIngested = async (id, name) => {
    setDocId(id);
    setFileName(name);
    setIsLoadingRisks(true);

    try {
      const data = await getRisks(id);
      setRisks(data);
      
      // Auto-load baseline source citations from the flagged risk clauses
      if (data.flags && data.flags.length > 0) {
        const baselineSources = data.flags.map((f) => ({
          text: f.raw_text,
          chunk_index: f.chunk_index,
          score: 1.0, // Indicated direct flag matches
        }));
        setSources(baselineSources);
      }
    } catch (err) {
      console.error('Failed to load risk analysis', err);
    } finally {
      setIsLoadingRisks(false);
    }
  };

  const handleReset = () => {
    setDocId(null);
    setFileName('');
    setRisks(null);
    setSources([]);
    setActiveChunkIndex(null);
  };

  const handleSelectChunk = (idx) => {
    setActiveChunkIndex(idx);
    // Scroll down to the citation references smoothly
    const panel = document.querySelector('.sources-panel');
    if (panel) {
      panel.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="app-container">
      {/* Dynamic Header */}
      <header className="glass-panel" style={{ padding: '1.25rem 2rem' }}>
        <div className="logo-container" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <ShieldAlert size={28} color="var(--accent)" />
          <div>
            <h1 style={{ fontSize: '1.6rem' }}>Legal Agreement Diagnostics</h1>
            <p>RAG Legal Assistant & Automated red-flag risk classifier</p>
          </div>
        </div>

        {docId && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.85rem',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-color)',
                padding: '0.4rem 0.8rem',
                borderRadius: '8px',
              }}
            >
              <FileCheck size={14} color="var(--low-risk)" />
              <span style={{ fontWeight: '500' }}>{fileName}</span>
            </div>
            <button
              onClick={handleReset}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.8rem',
                background: 'transparent',
                border: '1px solid var(--border-color)',
                color: 'var(--text-muted)',
                padding: '0.4rem 0.8rem',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'var(--transition-smooth)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent)';
                e.currentTarget.style.color = 'var(--text-main)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-color)';
                e.currentTarget.style.color = 'var(--text-muted)';
              }}
            >
              <RefreshCw size={12} /> Analyze New
            </button>
          </div>
        )}
      </header>

      {/* Main Workflow View */}
      {!docId ? (
        <UploadZone onIngested={handleIngested} />
      ) : (
        <main style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div className="main-workspace">
            {/* Left Column: Risks Overview */}
            <div className="glass-panel" style={{ height: '700px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              {isLoadingRisks ? (
                <div style={{ display: 'flex', flex1: 1, height: '100%', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
                  <div className="spinner" style={{ width: '40px', height: '40px' }} />
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Analyzing legal text clauses...</p>
                </div>
              ) : (
                <RiskDashboard risks={risks} onSelectChunk={handleSelectChunk} />
              )}
            </div>

            {/* Right Column: Q&A Chat */}
            <ChatPanel docId={docId} onSourcesFetched={setSources} />
          </div>

          {/* Citations Grounding Container */}
          <div className="glass-panel" style={{ padding: '1.5rem 2rem' }}>
            <SourceViewer sources={sources} activeChunkIndex={activeChunkIndex} />
          </div>
        </main>
      )}

      <footer>
        <p>© 2026 Legal Document Analyzer. Decoupled Architecture MVP. Powered by FastAPI & React.</p>
      </footer>
    </div>
  );
}
