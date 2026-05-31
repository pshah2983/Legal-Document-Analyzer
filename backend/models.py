from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

class ChatMessage(BaseModel):
    role: str = Field(..., description="'user' or 'assistant'")
    content: str = Field(..., description="Message content")

class QueryRequest(BaseModel):
    doc_id: str = Field(..., description="UUID of the ingested legal document")
    question: str = Field(..., description="Question to ask about the contract")
    chat_history: Optional[List[ChatMessage]] = Field(default=None, description="Previous conversation turns for multi-turn context")

class SourceSnippet(BaseModel):
    text: str = Field(..., description="Snippet of retrieved contract text")
    chunk_index: int = Field(..., description="Index of the paragraph chunk")
    score: float = Field(..., description="Semantic cosine similarity score")

class QueryResponse(BaseModel):
    answer: str = Field(..., description="AI generated legal explanation")
    sources: List[SourceSnippet] = Field(default_list=[], description="Sourced context chunks")

class RiskFlag(BaseModel):
    clause_type: str = Field(..., description="Legal term (e.g. Indemnification, Liability)")
    risk_level: str = Field(..., description="low | medium | high")
    plain_english: str = Field(..., description="Simple summary of what the term does")
    concerns: List[str] = Field(default_list=[], description="Action items or concerns for the signer")
    chunk_index: int = Field(..., description="Document chunk index matching flag")
    raw_text: str = Field(..., description="Direct snippet of raw contract language")
    suggested_rewrite: Optional[str] = Field(default=None, description="A fairer, more balanced version of this clause")
    negotiation_tip: Optional[str] = Field(default=None, description="One-liner the user can use in negotiation")
    severity_score: Optional[int] = Field(default=None, description="Risk severity from 1 (minor) to 10 (critical)")

class RiskSummary(BaseModel):
    high: int = Field(0, description="Number of High Risk flags")
    medium: int = Field(0, description="Number of Medium Risk flags")
    low: int = Field(0, description="Number of Low Risk flags")
    overall_score: Optional[int] = Field(default=None, description="Weighted overall risk score 0-100")

class RiskAnalysisResponse(BaseModel):
    doc_id: str = Field(..., description="UUID of the document analyzed")
    flags: List[RiskFlag] = Field(default_list=[], description="Identified clauses and assessments")
    summary: RiskSummary = Field(..., description="Risk count metrics breakdown")
