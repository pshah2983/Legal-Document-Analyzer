import os
from dotenv import load_dotenv

# Load environment variables from .env file BEFORE importing ingestion/retrieval
load_dotenv()

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from models import QueryRequest, QueryResponse, RiskAnalysisResponse
from ingestion import ingest_document
from retrieval import query_rag
from classifier import classify_clauses

# Initialize FastAPI application
app = FastAPI(
    title='Legal RAG API',
    description='Decoupled FastAPI backend for indexing and analyzing legal agreements.',
    version='1.0.0'
)

# Enable CORS for frontend clients (development and production hosts)
app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],  # Allow all during local pair-programming, restrict in production
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*']
)

@app.get('/')
def read_root():
    return {
        "status": "online",
        "service": "Legal Document Analyzer API",
        "mode": "Developer Offline Fallback" if not os.getenv("GROQ_API_KEY") else "Full LLM Production Mode"
    }

@app.post('/upload')
async def upload(file: UploadFile = File(...)):
    """Accepts PDF and DOCX files, extracts text, chunks, embeds, and indexes them."""
    allowed_types = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
    
    # Extract filename extension as backup check
    filename = file.filename or ""
    is_valid_ext = filename.lower().endswith('.pdf') or filename.lower().endswith('.docx')
    
    if file.content_type not in allowed_types and not is_valid_ext:
        raise HTTPException(
            status_code=400, 
            detail='Invalid file format. Only PDF and DOCX documents are supported.'
        )
        
    try:
        contents = await file.read()
        doc_id, chunk_count = await ingest_document(contents, filename)
        return {
            'doc_id': doc_id, 
            'chunks': chunk_count,
            'filename': filename
        }
    except Exception as e:
        print(f"[Upload Error] {e}")
        raise HTTPException(
            status_code=500, 
            detail=f'Failed to process contract document: {str(e)}'
        )

@app.post('/query')
async def query(req: QueryRequest):
    """Answers user queries grounded inside their uploaded contract context."""
    try:
        result = await query_rag(req.doc_id, req.question)
        return result
    except Exception as e:
        print(f"[Query Error] {e}")
        raise HTTPException(
            status_code=500, 
            detail=f'Failed to query document: {str(e)}'
        )

@app.get('/risks/{doc_id}')
async def risks(doc_id: str):
    """Automatically scans document for legal clauses and scores risk flags."""
    try:
        result = await classify_clauses(doc_id)
        return result
    except Exception as e:
        print(f"[Classifier Error] {e}")
        raise HTTPException(
            status_code=500, 
            detail=f'Failed to analyze risks: {str(e)}'
        )
