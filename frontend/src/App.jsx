import React, { useState, useEffect, useCallback } from 'react';
import UploadZone from './components/UploadZone';
import RiskDashboard from './components/RiskDashboard';
import ChatPanel from './components/ChatPanel';
import SourceViewer from './components/SourceViewer';
import LandingPage from './components/LandingPage';
import { getRisks } from './api';
import { ShieldAlert, RefreshCw, FileCheck, Sun, Moon, Keyboard, Layout } from 'lucide-react';

export default function App() {
  const [docId, setDocId] = useState(null);
  const [fileName, setFileName] = useState('');
  const [risks, setRisks] = useState(null);
  const [sources, setSources] = useState([]);
  const [activeChunkIndex, setActiveChunkIndex] = useState(null);
  const [isLoadingRisks, setIsLoadingRisks] = useState(false);
  const [view, setView] = useState('landing'); // 'landing' or 'app'
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('lda-theme') || 'dark';
  });

  // Apply theme on mount and change
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('lda-theme', theme);
  }, [theme]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      // Cmd/Ctrl + U → trigger upload (when no doc loaded)
      if ((e.metaKey || e.ctrlKey) && e.key === 'u') {
        e.preventDefault();
        if (docId) {
          handleReset();
        }
      }
      // Escape → clear focus
      if (e.key === 'Escape') {
        document.activeElement?.blur();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [docId]);

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
          score: 1.0,
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
    const panel = document.querySelector('.sources-panel');
    if (panel) {
      panel.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <div className="app-container">
      {/* Dynamic Header */}
      <header className="glass-panel" style={{ padding: '1.25rem 2rem' }}>
        <div 
          className="logo-container" 
          style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}
          onClick={() => setView('landing')}
          title="Go to Product Overview"
        >
          <div className="logo-icon-wrapper">
            <ShieldAlert size={28} color="var(--accent)" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.6rem' }}>Legal Agreement Diagnostics</h1>
            <p>RAG Legal Assistant & Automated red-flag risk classifier</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* View switcher */}
          {view === 'landing' ? (
            <button 
              onClick={() => setView('app')} 
              className="header-action-btn"
              style={{ background: 'var(--primary)', color: 'white', border: 'none' }}
              title="Open Diagnostics Workspace Console"
            >
              <Layout size={12} />
              <span>Workspace Console</span>
            </button>
          ) : (
            <button 
              onClick={() => setView('landing')} 
              className="header-action-btn"
              title="Go back to Landing Page"
            >
              <Layout size={12} />
              <span>Product Overview</span>
            </button>
          )}

          {docId && view === 'app' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div className="active-file-badge">
                <FileCheck size={14} color="var(--low-risk)" />
                <span style={{ fontWeight: '500' }}>{fileName}</span>
              </div>
              <button onClick={handleReset} className="header-action-btn" title="Analyze a new document (⌘U)">
                <RefreshCw size={12} /> Analyze New
              </button>
            </div>
          )}

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="theme-toggle-btn"
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </header>

      {/* Main Workflow View */}
      {view === 'landing' ? (
        <LandingPage onEnterHub={() => setView('app')} docId={docId} fileName={fileName} />
      ) : !docId ? (
        <UploadZone onIngested={handleIngested} />
      ) : (
        <main style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div className="main-workspace">
            {/* Left Column: Risks Overview */}
            <div className="glass-panel risk-panel">
              {isLoadingRisks ? (
                <div className="loading-state">
                  <div className="loading-pulse">
                    <div className="spinner" style={{ width: '40px', height: '40px' }} />
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    Analyzing legal text clauses...
                  </p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', opacity: 0.6 }}>
                    Scanning for risks, generating rewrites & tips
                  </p>
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
        <div className="footer-content">
          <p>© 2026 Legal Document Analyzer. Powered by FastAPI, React, & LangChain RAG.</p>
          <div className="footer-shortcuts">
            <Keyboard size={12} />
            <span>⌘K Chat</span>
            <span>⌘U Upload</span>
            <span>Esc Clear</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
