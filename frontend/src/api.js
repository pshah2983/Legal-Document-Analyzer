import axios from 'axios';

// Pull backend endpoint from environment variables or default to localhost for development
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const client = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const uploadDoc = async (file, onProgress) => {
  const formData = new FormData();
  formData.append('file', file);

  return client.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        onProgress(percentCompleted);
      }
    },
  });
};

export const queryDoc = async (docId, question, chatHistory = null) => {
  const payload = {
    doc_id: docId,
    question: question,
  };
  if (chatHistory && chatHistory.length > 0) {
    payload.chat_history = chatHistory;
  }
  const response = await client.post('/query', payload);
  return response.data;
};

/**
 * Streams the LLM response token-by-token via SSE.
 * @param {string} docId - UUID of the document
 * @param {string} question - User question
 * @param {Function} onToken - Called with each token string
 * @param {Function} onComplete - Called with { sources } when stream finishes
 * @param {Array} chatHistory - Previous conversation turns
 */
export const queryDocStream = async (docId, question, onToken, onComplete, chatHistory = null) => {
  const payload = {
    doc_id: docId,
    question: question,
  };
  if (chatHistory && chatHistory.length > 0) {
    payload.chat_history = chatHistory;
  }

  const response = await fetch(`${API_BASE}/query/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Stream request failed: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop(); // Keep incomplete line in buffer

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const data = JSON.parse(trimmed);
        if (data.done) {
          onComplete && onComplete({ sources: data.sources || [] });
        } else if (data.token) {
          onToken && onToken(data.token);
        }
      } catch (e) {
        // Skip malformed lines
      }
    }
  }
};

export const getRisks = async (docId) => {
  const response = await client.get(`/risks/${docId}`);
  return response.data;
};

export const clearChat = async (docId) => {
  const response = await client.post(`/chat/clear/${docId}`);
  return response.data;
};

export const downloadReport = async (docId) => {
  const response = await client.get(`/report/${docId}`, {
    responseType: 'blob',
  });
  // Trigger browser download
  const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `risk_report_${docId.slice(0, 8)}.pdf`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};
