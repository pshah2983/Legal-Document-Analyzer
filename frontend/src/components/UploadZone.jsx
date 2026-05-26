import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { uploadDoc } from '../api';

export default function UploadZone({ onIngested }) {
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);
  const [fileName, setFileName] = useState('');

  const onDrop = useCallback(
    async (acceptedFiles) => {
      if (acceptedFiles.length === 0) return;
      const file = acceptedFiles[0];

      setFileName(file.name);
      setIsUploading(true);
      setError(null);
      setProgress(0);

      try {
        const response = await uploadDoc(file, (percent) => {
          setProgress(percent);
        });
        onIngested(response.data.doc_id, file.name);
      } catch (err) {
        console.error(err);
        setError(
          err.response?.data?.detail ||
            'Failed to upload and parse your contract. Please try again.'
        );
        setIsUploading(false);
      }
    },
    [onIngested]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
        '.docx',
      ],
    },
  });

  return (
    <div className="glass-panel" style={{ maxWidth: '600px', margin: '4rem auto' }}>
      <div
        {...getRootProps()}
        className={`upload-wrapper ${isDragActive ? 'active' : ''}`}
      >
        <input {...getInputProps()} />
        <div className="upload-icon-box">
          {isUploading ? (
            <div className="spinner" style={{ width: '40px', height: '40px' }} />
          ) : (
            <Upload size={36} />
          )}
        </div>

        {isUploading ? (
          <div style={{ textAlign: 'center', width: '100%' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)' }}>
              Analyzing Document Structure...
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Reading: {fileName}
            </p>
            <div className="progress-container" style={{ margin: '1.5rem auto' }}>
              <div className="progress-bar-bg">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="progress-label">
                <span>{progress === 100 ? 'Chunking & Embedding...' : 'Uploading File'}</span>
                <span>{progress}%</span>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: '600' }}>
              Drag & Drop Your Contract
            </h3>
            <p style={{ color: 'var(--text-muted)', margin: '0.5rem 0' }}>
              Supports PDF and DOCX files up to 10MB
            </p>
            <span
              style={{
                display: 'inline-block',
                marginTop: '1rem',
                fontSize: '0.85rem',
                background: 'rgba(79, 70, 229, 0.1)',
                padding: '0.4rem 0.8rem',
                borderRadius: '8px',
                color: 'var(--accent)',
                fontWeight: '500',
              }}
            >
              Browse files
            </span>
          </div>
        )}
      </div>

      {error && (
        <div
          style={{
            marginTop: '1.5rem',
            padding: '1rem',
            background: 'var(--high-risk-bg)',
            border: '1px solid var(--high-risk-border)',
            borderRadius: '10px',
            color: 'var(--high-risk)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            fontSize: '0.85rem',
          }}
        >
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
