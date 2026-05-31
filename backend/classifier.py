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

# ==============================================================================
# Enhanced LLM Classification Prompt (with rewriting + negotiation)
# ==============================================================================
RISK_PROMPT = '''You are a senior contract attorney. Analyze this legal clause and respond ONLY with valid JSON (no markdown code blocks, no extra text):
{{
  "clause_type": "string (e.g. Indemnification, Termination, Liability, Arbitration, Governing Law, Non-Compete, Confidentiality)",
  "risk_level": "low | medium | high",
  "severity_score": number from 1 (minor concern) to 10 (critical legal risk),
  "plain_english": "1-2 sentence plain English explanation of what this term means for a non-lawyer",
  "concerns": ["list of specific items or concerns the signer should watch out for"],
  "suggested_rewrite": "Rewrite this clause to be more balanced and fair to both parties. Keep legal precision but remove one-sided language.",
  "negotiation_tip": "A single powerful sentence the signer can use when negotiating this clause with the other party."
}}
Clause: {clause}'''

# ==============================================================================
# Enhanced Keyword Rules with Rewrites & Negotiation Tips
# ==============================================================================
RISK_KEYWORDS = {
    'indemnif': {
        'clause_type': 'Indemnification',
        'risk_level': 'high',
        'severity_score': 8,
        'plain_english': 'You are committing to pay for legal fees or losses suffered by the other party due to specific triggers.',
        'concerns': [
            'Verify if this clause is mutual (both parties hold each other harmless).',
            'Limit indemnification strictly to direct, proven damages. Avoid broad third-party claims.'
        ],
        'suggested_rewrite': 'Each Party shall indemnify, defend, and hold harmless the other Party from claims arising from the indemnifying Party\'s negligence, willful misconduct, or material breach of this Agreement, limited to direct damages not exceeding the total fees paid under this Agreement.',
        'negotiation_tip': 'I\'d like this indemnification to be mutual and capped at the total contract value — can we adjust it so neither party bears unlimited exposure?'
    },
    'liabilit': {
        'clause_type': 'Limitation of Liability',
        'risk_level': 'high',
        'severity_score': 9,
        'plain_english': 'Limits the financial compensation you can recover if the other party breaches the contract.',
        'concerns': [
            'Check if liability is capped. If capped at $0 or token amounts, it favors the breaching party.',
            'Make sure the liability cap is reciprocal and proportional to the contract value.'
        ],
        'suggested_rewrite': 'Neither Party shall be liable for indirect, incidental, or consequential damages. Each Party\'s total aggregate liability shall not exceed the greater of (a) the total fees paid under this Agreement in the 12 months preceding the claim, or (b) $50,000.',
        'negotiation_tip': 'The current liability cap seems disproportionate — I\'d suggest tying it to the total contract value so both parties have meaningful recourse.'
    },
    'terminat': {
        'clause_type': 'Termination Clause',
        'risk_level': 'medium',
        'severity_score': 5,
        'plain_english': 'Outlines how, when, and under what conditions the agreement can be ended by either party.',
        'concerns': [
            'Confirm if there is a "termination for convenience" (e.g. 30 days written notice) without penalty.',
            'Ensure that obligations (like confidentiality) which survive termination are clearly defined.'
        ],
        'suggested_rewrite': 'Either Party may terminate this Agreement for convenience upon 30 days\' written notice, or immediately for cause upon material breach that remains uncured for 15 business days after written notice. Upon termination, all accrued obligations and payment for services rendered shall survive.',
        'negotiation_tip': 'I\'d like both parties to have equal termination rights with a reasonable cure period — can we add a 30-day notice for convenience and a 15-day cure window for cause?'
    },
    'arbitrat': {
        'clause_type': 'Arbitration & Dispute Resolution',
        'risk_level': 'medium',
        'severity_score': 6,
        'plain_english': 'Requires you to waive your right to a court trial and resolve disputes through private binding arbitration.',
        'concerns': [
            'Understand that arbitration is private and has limited appeal options.',
            'Confirm who pays the cost of the arbitration proceedings.'
        ],
        'suggested_rewrite': 'Any dispute arising from this Agreement shall first be subject to good-faith negotiation for 30 days. If unresolved, disputes shall be settled by binding arbitration under [AAA/JAMS] rules, with costs shared equally between the Parties. The arbitration shall take place in a mutually agreed location.',
        'negotiation_tip': 'I\'d prefer we add a mandatory negotiation period before arbitration, and split the arbitration costs equally rather than having one party bear the full expense.'
    },
    'non-compet': {
        'clause_type': 'Non-Compete Covenant',
        'risk_level': 'high',
        'severity_score': 8,
        'plain_english': 'Prevents you from working with competitors or launching a competing business in a specific region for a set duration.',
        'concerns': [
            'Check if the geographic scope and duration are reasonable (e.g., under 1 year).',
            'Ensure it is narrow enough not to prevent you from earning a livelihood.'
        ],
        'suggested_rewrite': 'During the term of this Agreement and for a period of 6 months thereafter, the Receiving Party agrees not to directly solicit clients served under this Agreement. This restriction shall not prevent the Receiving Party from engaging in their general profession or accepting work from other clients.',
        'negotiation_tip': 'The non-compete scope seems overly broad — I\'d like to narrow it to a non-solicitation of specific clients served under this contract, limited to 6 months post-termination.'
    },
    'confidentiali': {
        'clause_type': 'Confidentiality & NDA',
        'risk_level': 'low',
        'severity_score': 3,
        'plain_english': 'Safeguards sensitive business details disclosed during discussions or collaborations.',
        'concerns': [
            'Verify that the definition of confidential info is clear and not overly broad.',
            'Ensure standard exceptions exist (e.g., information already public, or legally subpoenaed).'
        ],
        'suggested_rewrite': 'Each Party agrees to maintain the confidentiality of Confidential Information for a period of 3 years after disclosure. Confidential Information excludes: (a) publicly available information, (b) information independently developed, (c) information received from a third party without restriction, and (d) information required to be disclosed by law.',
        'negotiation_tip': 'The confidentiality definition should include standard carve-outs for publicly available information and legal obligations — can we add those exceptions?'
    },
    'govern': {
        'clause_type': 'Governing Law & Jurisdiction',
        'risk_level': 'low',
        'severity_score': 2,
        'plain_english': 'Defines which state/country laws apply and where any lawsuits must be filed.',
        'concerns': [
            'Ensure the chosen jurisdiction is not extremely remote or expensive for you to travel to.',
            'Preferred is standard local state or neutral territory.'
        ],
        'suggested_rewrite': 'This Agreement shall be governed by and construed in accordance with the laws of the State of [Your State], without regard to conflict of law principles. Any legal proceedings shall be brought in the state or federal courts located in [Your County], [Your State].',
        'negotiation_tip': 'I\'d prefer the governing law to be my home state or a mutually convenient neutral jurisdiction — can we agree on a location that works for both parties?'
    },
    'waiver': {
        'clause_type': 'Waiver of Rights',
        'risk_level': 'high',
        'severity_score': 7,
        'plain_english': 'You may be giving up important legal protections or rights, such as the right to sue or join a class action.',
        'concerns': [
            'Check exactly which rights are being waived — some waivers may not be enforceable.',
            'Be cautious of blanket waivers that cover future unknown claims.'
        ],
        'suggested_rewrite': 'No waiver of any provision of this Agreement shall be effective unless made in writing and signed by the waiving Party. A waiver of any term or condition shall not be construed as a waiver of any subsequent breach or condition.',
        'negotiation_tip': 'I\'m not comfortable with a blanket waiver — can we limit this to specific, enumerated rights and require any waiver to be in writing?'
    },
    'intellectual property': {
        'clause_type': 'Intellectual Property Assignment',
        'risk_level': 'high',
        'severity_score': 9,
        'plain_english': 'Transfers ownership of creative work, inventions, or code you produce to the other party.',
        'concerns': [
            'Determine if the IP assignment covers only work product created under this contract.',
            'Ensure pre-existing IP and tools you bring to the project remain yours.'
        ],
        'suggested_rewrite': 'All Work Product created specifically for the Client under this Agreement shall be assigned to the Client upon full payment. The Contractor retains ownership of all pre-existing materials, tools, and general knowledge, and grants the Client a perpetual, non-exclusive license to use such materials as incorporated in the Work Product.',
        'negotiation_tip': 'I need to retain ownership of my pre-existing tools and frameworks — can we add a carve-out so only the deliverables created specifically for this project transfer to you?'
    },
    'force majeure': {
        'clause_type': 'Force Majeure',
        'risk_level': 'low',
        'severity_score': 2,
        'plain_english': 'Excuses a party from performing if extraordinary events occur (natural disasters, pandemics, etc.).',
        'concerns': [
            'Check if both parties benefit from this clause equally.',
            'Verify the list of qualifying events is reasonable and not too narrow.'
        ],
        'suggested_rewrite': 'Neither Party shall be liable for failure to perform due to causes beyond its reasonable control, including but not limited to acts of God, government actions, epidemics, natural disasters, or war. The affected Party shall provide prompt notice and use commercially reasonable efforts to resume performance.',
        'negotiation_tip': 'This clause looks standard — just make sure it applies equally to both parties and includes a duty to resume performance when the event ends.'
    }
}

def heuristic_classify(text: str, chunk_index: int) -> dict:
    """Uses robust regex/keyword rules to extract premium-grade mock legal flags with rewrites."""
    text_lower = text.lower()
    for kw, data in RISK_KEYWORDS.items():
        if kw in text_lower:
            return {
                "clause_type": data['clause_type'],
                "risk_level": data['risk_level'],
                "severity_score": data['severity_score'],
                "plain_english": f"[LOCAL RULE] {data['plain_english']}",
                "concerns": data['concerns'],
                "suggested_rewrite": data['suggested_rewrite'],
                "negotiation_tip": data['negotiation_tip'],
                "chunk_index": chunk_index,
                "raw_text": text[:300]
            }
    return None

async def classify_clauses(doc_id: str):
    """Scans vectors matching doc_id and compiles automated risk flags with rewrites."""
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
                    # Ensure severity_score exists
                    if 'severity_score' not in data:
                        data['severity_score'] = 5
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
    high_count = sum(1 for f in flags if f['risk_level'] == 'high')
    medium_count = sum(1 for f in flags if f['risk_level'] == 'medium')
    low_count = sum(1 for f in flags if f['risk_level'] == 'low')
    
    # Calculate overall risk score (0-100)
    if flags:
        severity_scores = [f.get('severity_score', 5) for f in flags]
        # Weighted: high risks count more toward overall score
        weighted = (high_count * 15) + (medium_count * 8) + (low_count * 2)
        avg_severity = sum(severity_scores) / len(severity_scores)
        overall_score = min(100, int((weighted + avg_severity * 3)))
    else:
        overall_score = 0
    
    summary = {
        'high': high_count,
        'medium': medium_count,
        'low': low_count,
        'overall_score': overall_score
    }
    
    return {
        'doc_id': doc_id,
        'flags': flags,
        'summary': summary
    }
