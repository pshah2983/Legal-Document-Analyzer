import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, MessageSquare, Trash2, Sparkles, Zap, CheckCircle2, ShieldAlert, AlertTriangle, Bookmark, BookOpen, AlertCircle } from 'lucide-react';
import { queryDocStream, clearChat } from '../api';

const SUGGESTED_QUESTIONS = [
  { text: 'What are the termination terms?', icon: '🔚' },
  { text: 'Is liability capped?', icon: '⚖️' },
  { text: 'Who pays for arbitration?', icon: '🏛️' },
  { text: 'Is the non-compete enforceable?', icon: '🚫' },
  { text: 'What IP rights am I giving up?', icon: '💡' },
  { text: 'Summarize the key obligations', icon: '📋' },
];

export default function ChatPanel({ docId, onSourcesFetched }) {
  const [messages, setMessages] = useState([
    {
      sender: 'ai',
      text: 'Hello! I\'ve finished parsing your agreement. Ask me anything about its terms — I\'ll cite exact clauses and flag risky language.\n\nTry one of the suggested questions below, or type your own.',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [chatHistory, setChatHistory] = useState([]);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, streamingText]);

  // Expose input ref for keyboard shortcut focus
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleSend = async (questionOverride = null) => {
    const userText = (questionOverride || input).trim();
    if (!userText || isLoading) return;

    setInput('');
    setShowSuggestions(false);
    setMessages((prev) => [...prev, { sender: 'user', text: userText }]);
    setIsLoading(true);
    setStreamingText('');

    // Build history for context
    const history = chatHistory.slice(-10);

    try {
      let fullResponse = '';

      await queryDocStream(
        docId,
        userText,
        (token) => {
          fullResponse += token;
          setStreamingText(fullResponse);
        },
        (result) => {
          // Stream complete — commit the message
          setMessages((prev) => [
            ...prev,
            { sender: 'ai', text: fullResponse },
          ]);
          setStreamingText('');

          // Update conversation history
          setChatHistory((prev) => [
            ...prev,
            { role: 'user', content: userText },
            { role: 'assistant', content: fullResponse },
          ]);

          if (onSourcesFetched && result.sources) {
            onSourcesFetched(result.sources);
          }
        },
        history
      );
    } catch (err) {
      console.error(err);
      setStreamingText('');
      setMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: 'Sorry, I encountered an error searching the document. Please verify the backend service is running and try again.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = async () => {
    try {
      await clearChat(docId);
    } catch (_) {
      // Server clear is best-effort
    }
    setChatHistory([]);
    setMessages([
      {
        sender: 'ai',
        text: 'Conversation cleared. Ask me anything about the contract!',
      },
    ]);
    setShowSuggestions(true);
  };

  const handleSuggestionClick = (text) => {
    handleSend(text);
  };

  // Advanced Markdown-to-JSX section and block formatter for structured AI responses
  const formatResponse = (text) => {
    if (!text) return null;

    // Helper: Split text into structured sections by ### heading
    const parseMessageToSections = (rawText) => {
      if (!rawText) return [];
      
      // If the text does not contain '###', it's just a regular chat message (no sections)
      if (!rawText.includes('###')) {
        return [{ title: null, content: rawText }];
      }
      
      const sections = [];
      const rawParts = rawText.split('###');
      
      rawParts.forEach((part, index) => {
        if (index === 0) {
          if (part.trim()) {
            sections.push({ title: null, content: part.trim() });
          }
          return;
        }
        
        const lines = part.split('\n');
        const title = lines[0].trim();
        const content = lines.slice(1).join('\n').trim();
        
        sections.push({ title, content });
      });
      
      return sections;
    };

    // Helper: Determine styling classes, custom icons, and titles for structured sections
    const getSectionIconAndTitle = (secTitle) => {
      const lowerTitle = (secTitle || '').toLowerCase();
      
      if (lowerTitle.includes('summary')) {
        return {
          icon: <Sparkles size={15} color="var(--accent)" />,
          className: 'section-summary',
          formattedTitle: 'Executive Summary'
        };
      }
      if (lowerTitle.includes('key points')) {
        return {
          icon: <CheckCircle2 size={15} color="var(--low-risk)" />,
          className: 'section-keypoints',
          formattedTitle: 'Key Diagnostic Points'
        };
      }
      if (lowerTitle.includes('risks') || lowerTitle.includes('concerns')) {
        return {
          icon: <ShieldAlert size={15} color="var(--high-risk)" />,
          className: 'section-risks',
          formattedTitle: 'Red Flags & Risks'
        };
      }
      
      return {
        icon: <Bookmark size={15} color="var(--primary)" />,
        className: 'section-generic',
        formattedTitle: secTitle
      };
    };

    // Helper: Parse and render inner content of a section line-by-line
    const renderSectionContent = (content) => {
      if (!content) return null;
      
      const lines = content.split('\n');
      const renderedElements = [];
      
      lines.forEach((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        
        // 1. Check for Developer Offline Mode notice banner
        if (trimmed.includes('[DEVELOPER OFFLINE MODE]')) {
          const bannerText = trimmed.replace('[DEVELOPER OFFLINE MODE]', '').trim();
          renderedElements.push(
            <div key={`offline-${idx}`} className="offline-warning-banner">
              <div className="offline-warning-header">
                <Zap size={14} className="offline-warning-icon" />
                <span>DEVELOPER OFFLINE MODE</span>
              </div>
              <p className="offline-warning-text">
                Local semantic search successfully retrieved matching clauses. To activate production-grade reasoning, configure your <code>GROQ_API_KEY</code> in the backend <code>.env</code> file.
              </p>
              {bannerText && <p className="offline-warning-extra">{bannerText}</p>}
            </div>
          );
          return;
        }
        
        // 2. Check if the line itself (bullet or not) represents a contract clause snippet
        let rawText = trimmed;
        let isBullet = false;
        if (trimmed.startsWith('*') || trimmed.startsWith('-')) {
          rawText = trimmed.replace(/^[\*\-]\s*/, '').trim();
          isBullet = true;
        }
        
        const sectionMatch = rawText.match(/^(Section\s+\d+(\.\d+)?|2\.\s+Specific|Party\s+[A-B]\s+Representative)/i);
        
        if (sectionMatch) {
          const dashIdx = rawText.indexOf(' — ');
          const hyphenIdx = rawText.indexOf(' - ');
          const separatorIdx = dashIdx !== -1 ? dashIdx : hyphenIdx;
          
          let headerText = "Retrieved Contract Clause";
          let bodyText = rawText;
          
          if (separatorIdx !== -1) {
            headerText = rawText.substring(0, separatorIdx).trim();
            bodyText = rawText.substring(separatorIdx + 3).trim();
          }
          
          renderedElements.push(
            <div key={`clause-${idx}`} className="legal-snippet-box animate-pulse-border">
              <div className="legal-snippet-header">
                <BookOpen size={12} color="var(--accent)" />
                <span>{headerText}</span>
                <span className="legal-snippet-badge">Grounded Citation</span>
              </div>
              <p className="legal-snippet-body">{bodyText}</p>
            </div>
          );
          return;
        }
        
        // 3. Handle standard bullets
        if (isBullet) {
          const boldParts = rawText.split(/(\*\*[^*]+\*\*)/g);
          renderedElements.push(
            <div key={`bullet-${idx}`} className="bullet-row animate-fade-in">
              <span className="bullet-marker">•</span>
              <p className="bullet-text">
                {boldParts.map((part, pidx) => {
                  if (part.startsWith('**') && part.endsWith('**')) {
                    return (
                      <strong key={pidx} className="bullet-bold">
                        {part.replace(/\*\*/g, '')}
                      </strong>
                    );
                  }
                  return <span key={pidx}>{part}</span>;
                })}
              </p>
            </div>
          );
          return;
        }
        
        // 4. Standard text line formatting with bold split
        const boldParts = trimmed.split(/(\*\*[^*]+\*\*)/g);
        renderedElements.push(
          <p key={`para-${idx}`} className="standard-chat-text">
            {boldParts.map((part, pidx) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return (
                  <strong key={pidx} className="bullet-bold">
                    {part.replace(/\*\*/g, '')}
                  </strong>
                );
              }
              return <span key={pidx}>{part}</span>;
            })}
          </p>
        );
      });
      
      return renderedElements;
    };

    const sections = parseMessageToSections(text);
    
    return sections.map((sec, idx) => {
      if (sec.title === null) {
        // Render simple content directly (e.g. initial message)
        return (
          <div key={`generic-${idx}`} className="chat-generic-block animate-fade-in">
            {renderSectionContent(sec.content)}
          </div>
        );
      }
      
      const { icon, className, formattedTitle } = getSectionIconAndTitle(sec.title);
      
      return (
        <div 
          key={`sec-${idx}`} 
          className={`chat-section-card ${className} animate-slide-up`} 
          style={{ animationDelay: `${idx * 0.08}s` }}
        >
          <div className="section-card-header">
            {icon}
            <h4>{formattedTitle}</h4>
          </div>
          <div className="section-card-body">
            {renderSectionContent(sec.content)}
          </div>
        </div>
      );
    });
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
          <div className="chat-header-icon">
            <Bot size={20} color="var(--accent)" />
          </div>
          <div>
            <h3>Contract Analyst Chat</h3>
            <span style={{ fontSize: '0.7rem', color: 'var(--low-risk)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Sparkles size={10} /> Grounded on document context • Multi-turn memory
            </span>
          </div>
        </div>
        {chatHistory.length > 0 && (
          <button
            onClick={handleClearChat}
            className="clear-chat-btn"
            title="Clear conversation history"
          >
            <Trash2 size={14} />
            <span>Clear</span>
          </button>
        )}
      </div>

      <div className="chat-history">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`chat-message ${m.sender}`}
            style={{
              alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start',
              animationDelay: `${i * 0.05}s`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
              {m.sender === 'user' ? <User size={12} /> : <Bot size={12} color="var(--accent)" />}
              <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.8 }}>
                {m.sender === 'user' ? 'You' : 'Analyst AI'}
              </span>
            </div>
            <div>{m.sender === 'user' ? <p>{m.text}</p> : formatResponse(m.text)}</div>
          </div>
        ))}

        {/* Streaming response in progress */}
        {isLoading && streamingText && (
          <div className="chat-message ai" style={{ alignSelf: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <Bot size={12} color="var(--accent)" />
              <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.8 }}>
                Analyst AI
              </span>
              <span className="streaming-indicator" />
            </div>
            <div>{formatResponse(streamingText)}</div>
          </div>
        )}

        {/* Loading spinner when waiting for first token */}
        {isLoading && !streamingText && (
          <div className="chat-message ai" style={{ alignSelf: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Searching clauses...</span>
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Suggested Question Chips */}
      {showSuggestions && !isLoading && (
        <div className="suggestion-chips">
          <div className="suggestion-chips-label">
            <Zap size={12} color="var(--accent)" />
            <span>Quick Questions</span>
          </div>
          <div className="suggestion-chips-row">
            {SUGGESTED_QUESTIONS.map((q, i) => (
              <button
                key={i}
                className="suggestion-chip"
                onClick={() => handleSuggestionClick(q.text)}
                style={{ animationDelay: `${i * 0.08}s` }}
              >
                <span>{q.icon}</span>
                <span>{q.text}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="chat-input-wrapper">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about this contract... (⌘K to focus)"
          className="chat-input"
          disabled={isLoading}
        />
        <button type="submit" className="chat-send-btn" disabled={isLoading || !input.trim()}>
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
