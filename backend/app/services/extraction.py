import logging
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
import httpx
import json

logger = logging.getLogger(__name__)


class Decision(BaseModel):
    title: str
    description: str
    confidence: float
    participants: List[str]
    meeting_id: int


class ActionItem(BaseModel):
    task: str
    owner: Optional[str] = None
    deadline: Optional[datetime] = None
    status: str = "pending"
    meeting_id: int


class Blocker(BaseModel):
    description: str
    severity: str = "medium"
    meeting_id: int


class Topic(BaseModel):
    name: str
    keywords: List[str] = []
    meeting_id: int


class MeetingExtraction(BaseModel):
    decisions: List[Decision]
    action_items: List[ActionItem]
    blockers: List[Blocker]
    topics: List[Topic]
    participants: List[str]


EXTRACTION_PROMPT = """You are a meeting analysis assistant. Extract structured information from the following meeting transcript.

For each decision mentioned, identify:
- What was decided
- Who participated in the decision
- The context/description

For each action item, identify:
- The task
- Who owns it (if mentioned)
- Any deadline mentioned

For each blocker, identify:
- What is blocking progress
- Severity (high/medium/low)

Transcript:
{transcript}

Respond with ONLY a valid JSON object (no markdown, no explanation) containing:
{{
  "decisions": [{{"title": "...", "description": "...", "confidence": 0.0-1.0, "participants": ["..."]}}],
  "action_items": [{{"task": "...", "owner": "...", "deadline": "YYYY-MM-DD or null", "status": "pending"}}],
  "blockers": [{{"description": "...", "severity": "high/medium/low"}}],
  "topics": [{{"name": "...", "keywords": ["..."]}}],
  "participants": ["name1", "name2"]
}}

If nothing of a certain type is found, return an empty array."""


class ExtractionService:
    def __init__(self):
        self.ollama_available = False
        self._check_ollama()
    
    def _check_ollama(self):
        try:
            import httpx
            response = httpx.get("http://localhost:11434/api/tags", timeout=5.0)
            if response.status_code == 200:
                self.ollama_available = True
                logger.info("Ollama is available for extraction")
        except Exception as e:
            logger.warning(f"Ollama not available: {e}")
    
    async def extract_structured(self, text: str, meeting_id: int) -> MeetingExtraction:
        logger.info(f"Extracting from transcript for meeting {meeting_id}, {len(text)} chars")
        
        if self.ollama_available:
            result = await self._extract_with_ollama(text, meeting_id)
            if result.decisions or result.action_items or result.blockers:
                logger.info(f"Ollama extraction found {len(result.decisions)} decisions, {len(result.action_items)} actions")
                return result
        
        logger.info("Using heuristic extraction fallback")
        return await self._extract_heuristic(text, meeting_id)
    
    async def _extract_with_ollama(self, text: str, meeting_id: int) -> MeetingExtraction:
        try:
            import httpx
            import json
            
            prompt = EXTRACTION_PROMPT.format(transcript=text[:4000])
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "http://localhost:11434/api/generate",
                    json={
                        "model": "llama3.2:3b",
                        "prompt": prompt,
                        "stream": False,
                        "format": "json"
                    },
                    timeout=120.0
                )
            
            if response.status_code == 200:
                result = response.json()
                content = result.get("response", "{}")
                
                try:
                    data = json.loads(content)
                    return MeetingExtraction(
                        decisions=[Decision(**{**d, "meeting_id": meeting_id}) for d in data.get("decisions", [])],
                        action_items=[ActionItem(**{**a, "meeting_id": meeting_id}) for a in data.get("action_items", [])],
                        blockers=[Blocker(**{**b, "meeting_id": meeting_id}) for b in data.get("blockers", [])],
                        topics=[Topic(**{**t, "meeting_id": meeting_id}) for t in data.get("topics", [])],
                        participants=data.get("participants", [])
                    )
                except Exception as e:
                    logger.error(f"Failed to parse extraction: {e}")
            
            return MeetingExtraction(
                decisions=[],
                action_items=[],
                blockers=[],
                topics=[],
                participants=[]
            )
        except Exception as e:
            logger.error(f"Ollama extraction failed: {e}")
            return await self._extract_heuristic(text, meeting_id)
    
    async def _extract_heuristic(self, text: str, meeting_id: int) -> MeetingExtraction:
        text_lower = text.lower()
        
        decisions = []
        action_items = []
        blockers = []
        participants = []
        
        import re
        
        name_pattern = r'\b([A-Z][a-z]+ [A-Z][a-z]+)\b'
        names = re.findall(name_pattern, text)
        participants = list(set(names))[:5]
        
        decision_patterns = [
            "decided to", "we will", "going to", "agreed to",
            "decision:", "resolved to", "concluded that", "we're going with"
        ]
        
        for pattern in decision_patterns:
            if pattern in text_lower:
                start_idx = text_lower.find(pattern)
                end_idx = text_lower.find('.', start_idx)
                if end_idx == -1:
                    end_idx = start_idx + 200
                snippet = text[start_idx:end_idx].strip()
                if snippet and len(snippet) > 10:
                    decisions.append(Decision(
                        title=f"Decision: {snippet[:60]}...",
                        description=snippet,
                        confidence=0.6,
                        participants=participants[:3],
                        meeting_id=meeting_id
                    ))
        
        action_items_found = set()
        
        action_patterns = [
            (r'([A-Z][a-z]+ [A-Z][a-z]+) (?:will|is going to|should|needs to|is responsible for) ([^.]{5,80})', 2),
            (r'([A-Z][a-z]+ [A-Z][a-z]+) (?:will|is going to|should|needs to) ([^.]{5,80})', 2),
        ]
        
        for pattern, _ in action_patterns:
            matches = re.finditer(pattern, text)
            for match in matches:
                owner = match.group(1)
                task = match.group(2).strip()
                task_hash = hash(task[:30])
                if task_hash not in action_items_found and len(task) > 5:
                    action_items.append(ActionItem(
                        task=f"{owner} will {task}",
                        owner=owner,
                        status="pending",
                        meeting_id=meeting_id
                    ))
                    action_items_found.add(task_hash)
        
        if not action_items:
            simple_patterns = ["will work on", "will handle", "will complete", "needs to", "responsible for"]
            for pattern in simple_patterns:
                if pattern in text_lower:
                    start = text_lower.find(pattern)
                    end = text.find('.', start)
                    if end == -1:
                        end = start + 100
                    task = text[start:end].strip()
                    task_hash = hash(task[:30])
                    if task_hash not in action_items_found:
                        action_items.append(ActionItem(
                            task=task,
                            owner=None,
                            status="pending",
                            meeting_id=meeting_id
                        ))
                        action_items_found.add(task_hash)
        
        deadline_patterns = [
            (r'by next (\w+)', 'next'),
            (r'by (\w+day)', ''),
            (r'by end of (\w+)', ''),
            (r'(\w+day)', ''),
        ]
        
        for item in action_items:
            for pattern, _ in deadline_patterns:
                match = re.search(pattern, item.task.lower())
                if match:
                    item.deadline = match.group(0)
                    break
        
        blocker_patterns = ["blocked", "blocker", "stuck on", "waiting on", "issue with", "problem with", "can't proceed", "unable to"]
        for pattern in blocker_patterns:
            if pattern in text_lower:
                start_idx = text_lower.find(pattern)
                end_idx = text_lower.find('.', start_idx)
                if end_idx == -1:
                    end_idx = start_idx + 150
                snippet = text[start_idx:end_idx].strip()
                if snippet and len(snippet) > 10:
                    severity = "medium"
                    if "critical" in snippet or "urgent" in snippet:
                        severity = "high"
                    blockers.append(Blocker(
                        description=snippet,
                        severity=severity,
                        meeting_id=meeting_id
                    ))
        
        return MeetingExtraction(
            decisions=decisions[:5],
            action_items=action_items[:10],
            blockers=blockers[:5],
            topics=[],
            participants=participants
        )


extraction_service = ExtractionService()
