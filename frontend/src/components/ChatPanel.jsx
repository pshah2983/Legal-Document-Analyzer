import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, MessageSquare } from 'lucide-react';
import { queryDoc } from '../api';

export default function ChatPanel({ docId, onSourcesFetched }) {
  const [messages, setMessages] = useState([
    {
      sender: 'ai',
      text: 'Hello! I have completed parsing your agreement. Ask me any specific questions about its terms, liability limits, or termination criteria.',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userText = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { sender: 'user', text: userText }]);
    setIsLoading(true);

    try {
      const data = await queryDoc(docId, userText);
      
      setMessages((prev) => [
        ...prev,
        { sender: 'ai', text: data.answer },
      ]);
      
      if (onSourcesFetched && data.sources) {
        onSourcesFetched(data.sources);
      }
    } catch (err) {
      console.error(err);
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

  // Ultra-clean formatter that renders Markdown-style structural responses into styled JSX
  const formatResponse = (text) => {
    if (!text) return null;
    
    return text.split('\n').map((line, idx) => {
      const trimmed = line.trim();
      
      if (trimmed.startsWith('###')) {
        return (
          <h3 key={idx} style={{ marginTop: '1rem', marginBottom: '0.25rem', color: 'var(--text-main)', fontSize: '1.05rem' }}>
            {trimmed.replace('###', '').trim()}
          </h3>
        );
      }
      if (trimmed.startsWith('*') || trimmed.startsWith('-')) {
        const content = trimmed.substring(1).trim();
        return (
          <ul key={idx} style={{ marginLeft: '1.25rem', marginBottom: '0.4rem', listStyleType: 'square' }}>
            <li>{content}</li>
          </ul>
        );
      }
      if (trimmed) {
        return <p key={idx} style={{ marginBottom: '0.5rem', color: 'var(--text-muted)' }}>{line}</p>;
      }
      return <div key={idx} style={{ height: '0.5rem' }} />;
    });
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <Bot size={20} color="var(--accent)" />
        <div>
          <h3>Contract Analyst Chat</h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--low-risk)' }}>
            Grounded directly on document context
          </span>
        </div>
      </div>

      <div className="chat-history">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`chat-message ${m.sender}`}
            style={{
              alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start',
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
        {isLoading && (
          <div className="chat-message ai" style={{ alignSelf: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Scanning clauses...</span>
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      <form onSubmit={handleSend} className="chat-input-wrapper">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about this contract..."
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
