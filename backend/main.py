import os
from dotenv import load_dotenv

# Load environment variables from .env file BEFORE importing ingestion/retrieval
load_dotenv()

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, Response
from models import QueryRequest, QueryResponse, RiskAnalysisResponse
from ingestion import ingest_document
from retrieval import query_rag, query_rag_stream, clear_chat_history
from classifier import classify_clauses

# Initialize FastAPI application
app = FastAPI(
    title='Legal RAG API',
    description='Decoupled FastAPI backend for indexing and analyzing legal agreements.',
    version='2.0.0'
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
        "version": "2.0.0",
        "mode": "Developer Offline Fallback" if not os.getenv("GROQ_API_KEY") else "Full LLM Production Mode",
        "features": ["streaming", "conversation_memory", "clause_rewriting", "pdf_report"]
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
    """Answers user queries grounded inside their uploaded contract context with conversation memory."""
    try:
        # Convert chat_history from Pydantic models to dicts if provided
        history = None
        if req.chat_history:
            history = [{"role": m.role, "content": m.content} for m in req.chat_history]
        result = await query_rag(req.doc_id, req.question, history)
        return result
    except Exception as e:
        print(f"[Query Error] {e}")
        raise HTTPException(
            status_code=500, 
            detail=f'Failed to query document: {str(e)}'
        )

@app.post('/query/stream')
async def query_stream(req: QueryRequest):
    """Streams the LLM response token-by-token via Server-Sent Events (SSE)."""
    try:
        history = None
        if req.chat_history:
            history = [{"role": m.role, "content": m.content} for m in req.chat_history]
        
        return StreamingResponse(
            query_rag_stream(req.doc_id, req.question, history),
            media_type='text/event-stream',
            headers={
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no',
            }
        )
    except Exception as e:
        print(f"[Stream Error] {e}")
        raise HTTPException(
            status_code=500, 
            detail=f'Failed to stream response: {str(e)}'
        )

@app.post('/chat/clear/{doc_id}')
async def clear_chat(doc_id: str):
    """Clears conversation memory for a specific document."""
    clear_chat_history(doc_id)
    return {"status": "cleared", "doc_id": doc_id}

@app.get('/risks/{doc_id}')
async def risks(doc_id: str):
    """Automatically scans document for legal clauses and scores risk flags with suggested rewrites."""
    try:
        result = await classify_clauses(doc_id)
        return result
    except Exception as e:
        print(f"[Classifier Error] {e}")
        raise HTTPException(
            status_code=500, 
            detail=f'Failed to analyze risks: {str(e)}'
        )

@app.get('/report/{doc_id}')
async def generate_report(doc_id: str):
    """Generates a downloadable PDF risk analysis report."""
    try:
        from report import build_pdf_report
        risk_data = await classify_clauses(doc_id)
        pdf_bytes = build_pdf_report(risk_data)
        return Response(
            content=pdf_bytes,
            media_type='application/pdf',
            headers={
                'Content-Disposition': f'attachment; filename="risk_report_{doc_id[:8]}.pdf"'
            }
        )
    except ImportError:
        raise HTTPException(
            status_code=501, 
            detail='PDF report generation requires the reportlab package. Install it with: pip install reportlab'
        )
    except Exception as e:
        print(f"[Report Error] {e}")
        raise HTTPException(
            status_code=500, 
            detail=f'Failed to generate report: {str(e)}'
        )
