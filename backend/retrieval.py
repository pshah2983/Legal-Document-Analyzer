import os
from langchain_core.prompts import ChatPromptTemplate
from qdrant_client.models import Filter, FieldCondition, MatchValue
from ingestion import client, COLLECTION, EMBED_MODEL

# Load GROQ API configuration
GROQ_KEY = os.getenv('GROQ_API_KEY', '').strip()

# Initialize LangChain Groq model if available
if GROQ_KEY:
    try:
        from langchain_groq import ChatGroq
        llm = ChatGroq(api_key=GROQ_KEY, model_name='llama3-8b-8192', temperature=0.1)
        print("[LLM] Initialized ChatGroq with Llama 3 8B model.")
    except Exception as e:
        print(f"[LLM] Error initializing ChatGroq: {e}. Falling back to Developer Mock LLM.")
        llm = None
else:
    print("[LLM] GROQ_API_KEY not found in env. Initializing Developer Mock LLM mode.")
    llm = None

PROMPT = ChatPromptTemplate.from_messages([
    ('system', '''You are a legal document analyst.
Use ONLY the provided context. Be precise. Flag risky language.
Format: Summary, Key Points (bullets), Risks (if any).
Context:\n{context}'''),
    ('human', '{question}')
])

def generate_mock_rag_response(question: str, context_chunks: list) -> str:
    """Generates a clean mock answer based on actual retrieved contract chunks."""
    joined_chunks = "\n- ".join(c[:150] + "..." for c in context_chunks)
    return f"""### Summary
[DEVELOPER OFFLINE MODE] Local semantic search successfully retrieved {len(context_chunks)} matching clauses from your contract. This response is compiled by the local parser. To receive full Llama 3.5 generative analysis, please paste your `GROQ_API_KEY` into the backend `.env` file.

### Key Points (Extracted Context)
* **Direct Match Found:** The document contains semantic references to your query.
* **Retrieved Snippets:**
  - {joined_chunks}

### Risks & Concerns
* **Verification Recommended:** Please inspect the exact legal terminology in the **"Source Citations"** tab below.
* **Key Terms Identified:** If this query relates to liability, indemnification, or termination, ensure standard caps are in place.
"""

async def query_rag(doc_id: str, question: str):
    """Retrieves top 5 vector chunks for similarity, and builds the grounded answer."""
    # Encode question using same embedding model
    q_emb = EMBED_MODEL.encode([question], normalize_embeddings=True)[0]
    
    # Run similarity query filtering by document ID
    response = client.query_points(
        collection_name=COLLECTION,
        query=q_emb.tolist() if hasattr(q_emb, 'tolist') else list(q_emb),
        limit=5,
        query_filter=Filter(
            must=[
                FieldCondition(key='doc_id', match=MatchValue(value=doc_id))
            ]
        )
    )
    results = response.points
    
    # Extract source records
    sources = []
    context_texts = []
    for r in results:
        context_texts.append(r.payload['text'])
        sources.append({
            'text': r.payload['text'],
            'chunk_index': r.payload['chunk_index'],
            'score': round(r.score, 3)
        })
        
    context = '\n\n---\n\n'.join(context_texts)
    
    # Execute LLM chain or fall back to Mock
    if llm is not None:
        try:
            chain = PROMPT | llm
            response = await chain.ainvoke({'context': context, 'question': question})
            answer = response.content
        except Exception as e:
            print(f"[Retrieval] Error calling Groq LLM: {e}")
            answer = generate_mock_rag_response(question, context_texts)
    else:
        answer = generate_mock_rag_response(question, context_texts)
        
    return {
        'answer': answer,
        'sources': sources
    }
