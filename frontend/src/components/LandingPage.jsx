import React from 'react';
import {
  ShieldAlert,
  MessageSquare,
  BarChart3,
  FileEdit,
  Download,
  Zap,
  ArrowRight,
  Upload,
  Cpu,
  Bookmark,
  CheckCircle,
  FileCheck
} from 'lucide-react';

export default function LandingPage({ onEnterHub, docId, fileName }) {
  const features = [
    {
      icon: <ShieldAlert size={28} className="feature-icon-alert" />,
      title: "Semantic Risk Classifier",
      description: "Automated diagnostics scanned across 10 distinct contract clause types, grading severity into High, Medium, and Low levels."
    },
    {
      icon: <MessageSquare size={28} className="feature-icon-chat" />,
      title: "RAG Conversational AI",
      description: "Ask detailed questions, debate unilateral definitions, and interrogate your contract with streaming SSE support & conversation memory."
    },
    {
      icon: <FileEdit size={28} className="feature-icon-edit" />,
      title: "Pro-Drafting & Rewrites",
      description: "Get context-specific alternative drafting suggestions, inline rewrites, and senior-level negotiation tips to protect your interest."
    },
    {
      icon: <BarChart3 size={28} className="feature-icon-chart" />,
      title: "Rich Analytics Dashboard",
      description: "Experience modern semi-circle SVG risk gauges and interactive donut segment charts with automatic cross-filtering capabilities."
    },
    {
      icon: <Download size={28} className="feature-icon-download" />,
      title: "Custom PDF Executive Reports",
      description: "Generate professionally branded PDF summaries in one click, including flagged clause registers, risk tables, and executive summaries."
    },
    {
      icon: <Zap size={28} className="feature-icon-offline" />,
      title: "Zero-Creds Offline Mode",
      description: "Runs fully locally without any external LLM keys using a fallback local heuristic parser and in-memory vector indexing."
    }
  ];

  const steps = [
    {
      icon: <Upload size={22} />,
      title: "1. Drop Document",
      desc: "Drop PDF/DOCX contract. The system securely segments, tokenizes, and indexes the text chunks."
    },
    {
      icon: <Cpu size={22} />,
      title: "2. Scan & Diagnose",
      desc: "Automated vectors classify clause risks, generating executive summaries and context-specific drafting recommendations."
    },
    {
      icon: <ArrowRight size={22} />,
      title: "3. Query & Refine",
      desc: "Ask the grounded RAG assistant follow-ups, select rewrites, and export branded diagnostic reports."
    }
  ];

  return (
    <div className="landing-container">
      {/* Hero Glows */}
      <div className="landing-glow landing-glow-1" />
      <div className="landing-glow landing-glow-2" />

      {/* Hero Section */}
      <section className="landing-hero">
        <div className="hero-badge animate-fade-in">
          <span className="badge-glow-dot"></span>
          <span className="badge-text">✨ Transform Contract Auditing with Diagnostics AI</span>
        </div>

        <h1 className="hero-title animate-slide-up">
          Instant Legal Risk Auditing <br />
          <span className="gradient-text">& RAG Intelligence</span>
        </h1>

        <p className="hero-subtitle animate-slide-up-delayed">
          Upload any PDF or DOCX agreement to scan for 10 core risks, get professional drafting rewrites, download custom executive reports, and query an assistant with complete grounding and source citations.
        </p>

        <div className="hero-actions animate-slide-up-delayed-more">
          <button onClick={onEnterHub} className="cta-btn primary-cta">
            <span>{docId ? "Resume Analysis" : "Start Diagnostic Hub"}</span>
            <ArrowRight size={18} className="cta-arrow" />
          </button>
          <a href="#features" className="cta-btn secondary-cta">
            Explore Core Features
          </a>
        </div>

        {/* Dynamic Mockup Preview */}
        <div className="hero-mockup-wrapper animate-float">
          <div className="mockup-frame glass-panel">
            <div className="mockup-header">
              <span className="window-dot red"></span>
              <span className="window-dot yellow"></span>
              <span className="window-dot green"></span>
              <span className="window-title">Diagnostics Workspace Console</span>
            </div>
            <div className="mockup-content">
              {/* Left Column: Visual Charts */}
              <div className="mockup-side">
                <div className="mockup-card">
                  <span className="card-label">Contract Risk Score</span>
                  <div className="mockup-gauge">
                    <svg viewBox="0 0 100 55" className="gauge-svg">
                      <path d="M 10,50 A 40,40 0 0,1 90,50" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" strokeLinecap="round" />
                      <path d="M 10,50 A 40,40 0 0,1 80,20" fill="none" stroke="url(#mockup-gauge-grad)" strokeWidth="8" strokeLinecap="round" strokeDasharray="125" strokeDashoffset="45" />
                      <defs>
                        <linearGradient id="mockup-gauge-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#10b981" />
                          <stop offset="60%" stopColor="#f59e0b" />
                          <stop offset="100%" stopColor="#ef4444" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="gauge-text">72</div>
                    <div className="gauge-sub">MEDIUM RISK</div>
                  </div>
                </div>

                <div className="mockup-card">
                  <span className="card-label">Identified Clauses (10 Categories)</span>
                  <div className="mockup-bar"><div className="bar-fill high" style={{ width: '45%' }}></div><span className="bar-lbl">Unilateral Indemnity (Severe)</span></div>
                  <div className="mockup-bar"><div className="bar-fill med" style={{ width: '70%' }}></div><span className="bar-lbl">Limitation of Liability (Unbalanced)</span></div>
                  <div className="mockup-bar"><div className="bar-fill low" style={{ width: '85%' }}></div><span className="bar-lbl">Governing Law (Standard)</span></div>
                </div>
              </div>

              {/* Right Column: Chat RAG Simulator */}
              <div className="mockup-side mockup-chat-side">
                <div className="mockup-chat-bubble ai">
                  <div className="bubble-header"><Bookmark size={10} /> <span>Diagnostics Summary</span></div>
                  <p>Analyzed <strong>Section 2.3 (Binding Arbitration)</strong>. Flagged extreme waiver of jury trials. Suggest mutual resolution wording below...</p>
                </div>
                <div className="mockup-chat-bubble user">
                  <p>Is liability capped in this document?</p>
                </div>
                <div className="mockup-chat-bubble ai">
                  <div className="bubble-header"><Zap size={10} /> <span>Grounded RAG Answer</span></div>
                  <p>Yes, <strong>Section 2.2</strong> caps Contractor liability at $5,000, leaving Client exposure uncapped. Recommendation: request reciprocal cap.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Step by Step Workflow */}
      <section className="landing-steps">
        <div className="steps-container glass-panel">
          {steps.map((st, i) => (
            <div key={i} className="step-item">
              <div className="step-icon-wrapper">
                {st.icon}
              </div>
              <div className="step-text">
                <h4>{st.title}</h4>
                <p>{st.desc}</p>
              </div>
              {i < steps.length - 1 && <div className="step-arrow" />}
            </div>
          ))}
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="landing-features">
        <div className="features-header">
          <h2 className="section-title">End-to-End Diagnostic Modules</h2>
          <p className="section-subtitle">A professional platform built for prompt, clear, and comprehensive legal intelligence.</p>
        </div>

        <div className="features-grid">
          {features.map((f, i) => (
            <div key={i} className="feature-card glass-panel" style={{ animationDelay: `${i * 0.05}s` }}>
              <div className="feature-card-glow" />
              <div className="feature-icon-box">
                {f.icon}
              </div>
              <h3 className="feature-card-title">{f.title}</h3>
              <p className="feature-card-desc">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Active File Banner CTA if a file is already loaded */}
      {docId && (
        <section className="landing-active-file animate-slide-up">
          <div className="active-banner glass-panel">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div className="active-file-icon">
                <FileCheck size={24} color="var(--low-risk)" />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>Active Contract Loaded</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.1rem 0 0 0' }}>{fileName}</p>
              </div>
            </div>
            <button onClick={onEnterHub} className="cta-btn primary-cta active-btn">
              Resume Analysis Console
              <ArrowRight size={16} />
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
