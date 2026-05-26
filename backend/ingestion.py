import uuid
import io
import os
from pypdf import PdfReader
from docx import Document as DocxDocument
from langchain_text_splitters import RecursiveCharacterTextSplitter
from sentence_transformers import SentenceTransformer
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct

# ==============================================================================
# Dual-Mode Qdrant Connection Initialization
# ==============================================================================
QDRANT_URL = os.getenv('QDRANT_URL', '').strip()
QDRANT_KEY = os.getenv('QDRANT_API_KEY', '').strip()

if QDRANT_URL and QDRANT_KEY:
    print("[Qdrant] Connecting to Remote Qdrant Cloud...")
    client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_KEY)
else:
    print("[Qdrant] Initializing Local In-Memory instance (Developer Mode)...")
    # Using ":memory:" connects to a local fast in-memory Qdrant database
    client = QdrantClient(":memory:")

COLLECTION = 'legal_docs'

# Embeddings model loaded locally (BAAI/bge-small-en-v1.5)
# This model has 384 dimensions and is highly optimized for semantic search.
print("[Embeddings] Loading BAAI/bge-small-en-v1.5 model...")
try:
    EMBED_MODEL = SentenceTransformer('BAAI/bge-small-en-v1.5')
except Exception as e:
    print(f"[Embeddings] Warning: Failed to load local SentenceTransformer: {e}")
    print("[Embeddings] Initializing fallback light mock embedder...")
    class MockEmbedder:
        def encode(self, text_or_list, **kwargs):
            import numpy as np
            if isinstance(text_or_list, str):
                return np.zeros(384)
            return np.zeros((len(text_or_list), 384))
    EMBED_MODEL = MockEmbedder()

def ensure_collection():
    try:
        existing = [c.name for c in client.get_collections().collections]
        if COLLECTION not in existing:
            print(f"[Qdrant] Creating collection: '{COLLECTION}' with 384 dimensions...")
            client.create_collection(
                collection_name=COLLECTION,
                vectors_config=VectorParams(size=384, distance=Distance.COSINE)
            )
        # Always attempt to create the payload index for doc_id to be safe
        try:
            client.create_payload_index(
                collection_name=COLLECTION,
                field_name="doc_id",
                field_schema="keyword"
            )
        except Exception:
            # Safe catch-all for when index already exists or is in process
            pass
    except Exception as e:
        print(f"[Qdrant] Error checking/creating collection: {e}")

def extract_text(contents: bytes, filename: str) -> str:
    """Parses raw document bytes and returns clean extracted text paragraphs."""
    if filename.lower().endswith('.pdf'):
        reader = PdfReader(io.BytesIO(contents))
        paragraphs = []
        for p in reader.pages:
            txt = p.extract_text()
            if txt:
                paragraphs.append(txt)
        return '\n\n'.join(paragraphs)
    
    elif filename.lower().endswith('.docx'):
        doc = DocxDocument(io.BytesIO(contents))
        return '\n\n'.join(p.text for p in doc.paragraphs if p.text.strip())
        
    return ""

async def ingest_document(contents: bytes, filename: str):
    """Chunks the text, encodes chunks into vectors, and indexes them in Qdrant."""
    ensure_collection()
    
    raw_text = extract_text(contents, filename)
    if not raw_text.strip():
        raise ValueError("Could not extract any readable text from the uploaded document.")
        
    # Text splitter designed for contract clause granular parsing
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=600,
        chunk_overlap=80,
        separators=['\n\n', '\n', '. ', ' ']
    )
    chunks = splitter.split_text(raw_text)
    
    doc_id = str(uuid.uuid4())
    
    # Calculate embeddings
    embeddings = EMBED_MODEL.encode(chunks, batch_size=32, normalize_embeddings=True)
    
    points = []
    for i, (chunk, emb) in enumerate(zip(chunks, embeddings)):
        points.append(
            PointStruct(
                id=str(uuid.uuid4()),
                vector=emb.tolist() if hasattr(emb, 'tolist') else list(emb),
                payload={
                    'doc_id': doc_id,
                    'text': chunk,
                    'chunk_index': i,
                    'filename': filename
                }
            )
        )
        
    client.upsert(collection_name=COLLECTION, points=points)
    print(f"[Ingestion] Successfully ingested '{filename}' (ID: {doc_id}) into {len(chunks)} chunks.")
    return doc_id, len(chunks)
