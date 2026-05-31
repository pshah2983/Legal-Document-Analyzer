import os
import json
import asyncio
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, AIMessage
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

# ==============================================================================
# Multi-Turn Conversation Prompt (with history support)
# ==============================================================================
PROMPT = ChatPromptTemplate.from_messages([
    ('system', '''You are a senior legal document analyst with expertise in contract review.
Use ONLY the provided contract context to answer questions. Be precise and cite specific language.
Flag risky, one-sided, or ambiguous language.

Format your response as:
### Summary
A concise overview of the answer.

### Key Points
- Bullet point findings from the contract text.

### Risks & Concerns
- Any risks, red flags, or items the signer should watch for.

If the answer is not in the provided contract context, explicitly state: "This information is not present in the uploaded contract."

Contract Context:
{context}'''),
    MessagesPlaceholder(variable_name="chat_history"),
    ('human', '{question}')
])

# ==============================================================================
# In-Memory Conversation Store (keyed by doc_id)
# ==============================================================================
conversation_store: dict = {}

def get_chat_history(doc_id: str) -> list:
    """Retrieve conversation history for a document."""
    return conversation_store.get(doc_id, [])

def save_chat_turn(doc_id: str, question: str, answer: str):
    """Persist a Q&A turn in conversation memory (max 10 turns)."""
    if doc_id not in conversation_store:
        conversation_store[doc_id] = []
    conversation_store[doc_id].append(HumanMessage(content=question))
    conversation_store[doc_id].append(AIMessage(content=answer))
    # Keep only last 10 messages (5 turns) to avoid token overflow
    if len(conversation_store[doc_id]) > 10:
        conversation_store[doc_id] = conversation_store[doc_id][-10:]

def clear_chat_history(doc_id: str):
    """Clear conversation memory for a document."""
    conversation_store.pop(doc_id, None)

def _build_history_messages(chat_history: list = None, doc_id: str = None) -> list:
    """Build LangChain message objects from client-sent history or server store."""
    if chat_history:
        messages = []
        for msg in chat_history[-10:]:  # Last 5 turns
            if msg.get('role') == 'user':
                messages.append(HumanMessage(content=msg['content']))
            elif msg.get('role') == 'assistant':
                messages.append(AIMessage(content=msg['content']))
        return messages
    elif doc_id:
        return get_chat_history(doc_id)
    return []


def generate_mock_rag_response(question: str, context_chunks: list) -> str:
    """Generates a clean mock answer based on actual retrieved contract chunks."""
    joined_chunks = "\n".join(f"- {c.strip()}" for c in context_chunks)
    return f"""### Summary
[DEVELOPER OFFLINE MODE] Local semantic search successfully retrieved {len(context_chunks)} matching clauses from your contract. This response is compiled by the local parser. To receive full Llama 3.5 generative analysis, please paste your `GROQ_API_KEY` into the backend `.env` file.

### Key Points (Extracted Context)
* **Direct Match Found:** The document contains semantic references to your query.
* **Retrieved Snippets:**
{joined_chunks}

### Risks & Concerns
* **Verification Recommended:** Please inspect the exact legal terminology in the **"Source Citations"** tab below.
* **Key Terms Identified:** If this query relates to liability, indemnification, or termination, ensure standard caps are in place.
"""


def _retrieve_chunks(doc_id: str, question: str, limit: int = 5):
    """Encode question and retrieve top-k vector chunks from Qdrant."""
    q_emb = list(EMBED_MODEL.embed([question]))[0]
    
    response = client.query_points(
        collection_name=COLLECTION,
        query=q_emb.tolist() if hasattr(q_emb, 'tolist') else list(q_emb),
        limit=limit,
        query_filter=Filter(
            must=[
                FieldCondition(key='doc_id', match=MatchValue(value=doc_id))
            ]
        )
    )
    results = response.points
    
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
    return context, context_texts, sources


async def query_rag(doc_id: str, question: str, chat_history: list = None):
    """Retrieves top 5 vector chunks for similarity, and builds the grounded answer with conversation memory."""
    context, context_texts, sources = _retrieve_chunks(doc_id, question)
    
    # Build conversation history
    history_messages = _build_history_messages(chat_history, doc_id)
    
    # Execute LLM chain or fall back to Mock
    if llm is not None:
        try:
            chain = PROMPT | llm
            response = await chain.ainvoke({
                'context': context, 
                'question': question,
                'chat_history': history_messages
            })
            answer = response.content
        except Exception as e:
            print(f"[Retrieval] Error calling Groq LLM: {e}")
            answer = generate_mock_rag_response(question, context_texts)
    else:
        answer = generate_mock_rag_response(question, context_texts)
    
    # Save to server-side conversation memory
    save_chat_turn(doc_id, question, answer)
        
    return {
        'answer': answer,
        'sources': sources
    }


async def query_rag_stream(doc_id: str, question: str, chat_history: list = None):
    """Async generator that yields SSE tokens for streaming chat responses."""
    context, context_texts, sources = _retrieve_chunks(doc_id, question)
    
    # Build conversation history
    history_messages = _build_history_messages(chat_history, doc_id)
    
    full_answer = ""
    
    if llm is not None:
        try:
            chain = PROMPT | llm
            async for chunk in chain.astream({
                'context': context,
                'question': question,
                'chat_history': history_messages
            }):
                token = chunk.content if hasattr(chunk, 'content') else str(chunk)
                if token:
                    full_answer += token
                    yield json.dumps({"token": token, "done": False}) + "\n"
        except Exception as e:
            print(f"[Streaming] Error calling Groq LLM: {e}")
            fallback = generate_mock_rag_response(question, context_texts)
            full_answer = fallback
            # Stream the mock response in chunks to simulate streaming
            for i in range(0, len(fallback), 20):
                yield json.dumps({"token": fallback[i:i+20], "done": False}) + "\n"
                await asyncio.sleep(0.02)
    else:
        fallback = generate_mock_rag_response(question, context_texts)
        full_answer = fallback
        # Stream the mock response in small chunks
        for i in range(0, len(fallback), 12):
            yield json.dumps({"token": fallback[i:i+12], "done": False}) + "\n"
            await asyncio.sleep(0.025)
    
    # Save to server-side conversation memory
    save_chat_turn(doc_id, question, full_answer)
    
    # Final event with sources
    yield json.dumps({"token": "", "done": True, "sources": sources}) + "\n"
