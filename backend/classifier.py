import os
import json
from qdrant_client.models import Filter, FieldCondition, MatchValue
from ingestion import client, COLLECTION

# Re-use GROQ configuration
GROQ_KEY = os.getenv('GROQ_API_KEY', '').strip()

if GROQ_KEY:
    try:
        from langchain_groq import ChatGroq
        llm = ChatGroq(api_key=GROQ_KEY, model_name='llama3-8b-8192', temperature=0)
        print("[Classifier] Initialized ChatGroq for automated Red-Flag Classification.")
    except Exception as e:
        print(f"[Classifier] Error initializing ChatGroq: {e}. Using local heuristic classifier.")
        llm = None
else:
    print("[Classifier] GROQ_API_KEY not found in env. Running in local heuristic classifier mode.")
    llm = None

RISK_PROMPT = '''Analyze this legal clause and respond ONLY with valid JSON inside a code block or as raw string:
{{
  "clause_type": "string (e.g. Indemnification, Termination, Liability, Arbitration, Governing Law)",
  "risk_level": "low | medium | high",
  "plain_english": "1-2 sentence plain English explanation of what this term means for a non-lawyer",
  "concerns": ["list of specific items or concerns the signer should watch out for"]
}}
Clause: {clause}'''

RISK_KEYWORDS = {
    'indemnif': ('Indemnification', 'high', 
                 'You are committing to pay for legal fees or losses suffered by the other party due to specific triggers.',
                 ['Verify if this clause is mutual (both parties hold each other harmless).', 'Limit indemnification strictly to direct, proven damages. Avoid broad third-party claims.']),
    'liabilit': ('Limitation of Liability', 'high', 
                 'Limits the financial compensation you can recover if the other party breaches the contract.',
                 ['Check if liability is capped. If capped at $0 or token amounts, it favors the breaching party.', 'Make sure the liability cap is reciprocal and proportional to the contract value.']),
    'terminat': ('Termination Clause', 'medium', 
                 'Outlines how, when, and under what conditions the agreement can be ended by either party.',
                 ['Confirm if there is a "termination for convenience" (e.g. 30 days written notice) without penalty.', 'Ensure that obligations (like confidentiality) which survive termination are clearly defined.']),
    'arbitrat': ('Arbitration & Dispute Resolution', 'medium', 
                 'Requires you to waive your right to a court trial and resolve disputes through private binding arbitration.',
                 ['Understand that arbitration is private and has limited appeal options.', 'Confirm who pays the cost of the arbitration proceedings.']),
    'non-compet': ('Non-Compete Covenant', 'high', 
                  'Prevents you from working with competitors or launching a competing business in a specific region for a set duration.',
                  ['Check if the geographic scope and duration are reasonable (e.g., under 1 year).', 'Ensure it is narrow enough not to prevent you from earning a livelihood.']),
    'confidentiali': ('Confidentiality & NDA', 'low', 
                      'Safeguards sensitive business details disclosed during discussions or collaborations.',
                      ['Verify that the definition of confidential info is clear and not overly broad.', 'Ensure standard exceptions exist (e.g., information already public, or legally subpoenaed).']),
    'govern': ('Governing Law & Jurisdiction', 'low', 
               'Defines which state/country laws apply and where any lawsuits must be filed.',
               ['Ensure the chosen jurisdiction is not extremely remote or expensive for you to travel to.', 'Preferred is standard local state or neutral territory.'])
}

def heuristic_classify(text: str, chunk_index: int) -> dict:
    """Uses robust regex/keyword rules to extract premium-grade mock legal flags."""
    text_lower = text.lower()
    for kw, (c_type, r_level, summary, concerns) in RISK_KEYWORDS.items():
        if kw in text_lower:
            return {
                "clause_type": c_type,
                "risk_level": r_level,
                "plain_english": f"[LOCAL RULE] {summary}",
                "concerns": concerns,
                "chunk_index": chunk_index,
                "raw_text": text[:300]
            }
    return None

async def classify_clauses(doc_id: str):
    """Scans vectors matching doc_id and compiles automated risk flags."""
    # Scroll points belonging to this document from Qdrant
    results = client.scroll(
        collection_name=COLLECTION,
        limit=100,
        scroll_filter=Filter(
            must=[
                FieldCondition(key='doc_id', match=MatchValue(value=doc_id))
            ]
        ),
        with_payload=True
    )[0]
    
    flags = []
    
    for r in results:
        payload = r.payload
        text = payload['text']
        chunk_idx = payload['chunk_index']
        
        # Check if text contains any risk keyword
        has_risk = any(kw in text.lower() for kw in RISK_KEYWORDS.keys())
        
        if has_risk:
            if llm is not None:
                try:
                    prompt = RISK_PROMPT.format(clause=text)
                    resp = await llm.ainvoke(prompt)
                    # Clean response string to ensure parseable JSON
                    content = resp.content.strip()
                    if "```json" in content:
                        content = content.split("```json")[1].split("```")[0].strip()
                    elif "```" in content:
                        content = content.split("```")[1].split("```")[0].strip()
                        
                    data = json.loads(content)
                    data['chunk_index'] = chunk_idx
                    data['raw_text'] = text
                    flags.append(data)
                except Exception as e:
                    print(f"[Classifier] Failed to parse LLM response: {e}. Using heuristic fallback.")
                    h_flag = heuristic_classify(text, chunk_idx)
                    if h_flag:
                        flags.append(h_flag)
            else:
                # Heuristic Rule Engine
                h_flag = heuristic_classify(text, chunk_idx)
                if h_flag:
                    flags.append(h_flag)
                    
    # Compile count metrics
    summary = {
        'high': sum(1 for f in flags if f['risk_level'] == 'high'),
        'medium': sum(1 for f in flags if f['risk_level'] == 'medium'),
        'low': sum(1 for f in flags if f['risk_level'] == 'low')
    }
    
    return {
        'doc_id': doc_id,
        'flags': flags,
        'summary': summary
    }
