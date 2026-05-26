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

export const queryDoc = async (docId, question) => {
  const response = await client.post('/query', {
    doc_id: docId,
    question: question,
  });
  return response.data;
};

export const getRisks = async (docId) => {
  const response = await client.get(`/risks/${docId}`);
  return response.data;
};
