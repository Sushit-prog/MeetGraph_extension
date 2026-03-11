from fastapi import APIRouter, HTTPException
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

router = APIRouter()

# In-memory storage (replace with database in production)
meetings_db = {}
transcripts_db = {}
extractions_db = {}


class MeetingCreate(BaseModel):
    title: str
    platform: Optional[str] = None
    started_at: Optional[str] = None
    participants: Optional[List[str]] = []


class MeetingUpdate(BaseModel):
    title: Optional[str] = None
    transcript: Optional[str] = None
    ended_at: Optional[str] = None


class TranscriptChunk(BaseModel):
    text: str
    timestamp: Optional[str] = None
    speaker: Optional[str] = None


class Decision(BaseModel):
    id: int
    title: str
    description: str
    confidence: float
    participants: List[str] = []


class ActionItem(BaseModel):
    id: int
    task: str
    owner: Optional[str] = None
    deadline: Optional[str] = None
    status: str = "pending"


class Blocker(BaseModel):
    id: int
    description: str
    severity: str = "medium"


@router.post("", status_code=201)
async def create_meeting(meeting: MeetingCreate):
    meeting_id = len(meetings_db) + 1
    meetings_db[meeting_id] = {
        "id": meeting_id,
        "title": meeting.title,
        "platform": meeting.platform,
        "started_at": meeting.started_at or datetime.now().isoformat(),
        "ended_at": None,
        "participants": meeting.participants,
        "transcript": ""
    }
    transcripts_db[meeting_id] = []
    extractions_db[meeting_id] = {
        "decisions": [],
        "actionItems": [],
        "blockers": []
    }
    return meetings_db[meeting_id]


@router.get("")
async def list_meetings(skip: int = 0, limit: int = 10):
    meetings = list(meetings_db.values())[skip:skip + limit]
    return {"meetings": meetings, "total": len(meetings_db)}


@router.get("/{meeting_id}")
async def get_meeting(meeting_id: int):
    if meeting_id not in meetings_db:
        raise HTTPException(status_code=404, detail="Meeting not found")
    meeting = meetings_db[meeting_id]
    meeting["transcript"] = "\n".join(transcripts_db.get(meeting_id, []))
    return meeting


@router.patch("/{meeting_id}")
async def update_meeting(meeting_id: int, update: MeetingUpdate):
    if meeting_id not in meetings_db:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    meeting = meetings_db[meeting_id]
    if update.title:
        meeting["title"] = update.title
    if update.transcript:
        meeting["transcript"] = update.transcript
    if update.ended_at:
        meeting["ended_at"] = update.ended_at
    
    return meeting


@router.delete("/{meeting_id}", status_code=204)
async def delete_meeting(meeting_id: int):
    if meeting_id not in meetings_db:
        raise HTTPException(status_code=404, detail="Meeting not found")
    del meetings_db[meeting_id]
    if meeting_id in transcripts_db:
        del transcripts_db[meeting_id]
    if meeting_id in extractions_db:
        del extractions_db[meeting_id]


@router.post("/{meeting_id}/transcript")
async def add_transcript_chunk(meeting_id: int, chunk: TranscriptChunk):
    import sys
    print(f"[MEETGRAPH] add_transcript_chunk called for meeting {meeting_id}", file=sys.stderr)
    
    if meeting_id not in meetings_db:
        print(f"[MEETGRAPH] Meeting {meeting_id} not found!", file=sys.stderr)
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    if meeting_id not in transcripts_db:
        transcripts_db[meeting_id] = []
    
    transcripts_db[meeting_id].append(chunk.text)
    full_transcript = "\n".join(transcripts_db[meeting_id])
    meetings_db[meeting_id]["transcript"] = full_transcript
    
    print(f"[MEETGRAPH] Transcript now has {len(transcripts_db[meeting_id])} chunks, {len(full_transcript)} chars", file=sys.stderr)
    
    from app.services.extraction import extraction_service
    extractions = await extraction_service.extract_structured(full_transcript, meeting_id)
    extractions_db[meeting_id] = {
        "decisions": [d.model_dump() for d in extractions.decisions],
        "actionItems": [a.model_dump() for a in extractions.action_items],
        "blockers": [b.model_dump() for b in extractions.blockers]
    }
    
    print(f"[MEETGRAPH] Extracted {len(extractions.decisions)} decisions, {len(extractions.action_items)} actions", file=sys.stderr)
    
    return {"status": "added", "chunks": len(transcripts_db[meeting_id]), "extractions": extractions_db[meeting_id]}


@router.get("/{meeting_id}/extractions")
async def get_extractions(meeting_id: int):
    import logging
    import sys
    logger = logging.getLogger(__name__)
    logger.setLevel(logging.INFO)
    
    print(f"[MEETGRAPH] get_extractions called for meeting {meeting_id}", file=sys.stderr)
    print(f"[MEETGRAPH] meetings_db keys: {list(meetings_db.keys())}", file=sys.stderr)
    
    if meeting_id not in meetings_db:
        print(f"[MEETGRAPH] Meeting {meeting_id} not found!", file=sys.stderr)
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    transcript = "\n".join(transcripts_db.get(meeting_id, []))
    print(f"[MEETGRAPH] Transcript length: {len(transcript)} chars", file=sys.stderr)
    
    if transcript:
        from app.services.extraction import extraction_service
        print("[MEETGRAPH] Calling extraction service...", file=sys.stderr)
        extractions = await extraction_service.extract_structured(transcript, meeting_id)
        print(f"[MEETGRAPH] Extracted {len(extractions.decisions)} decisions, {len(extractions.action_items)} actions", file=sys.stderr)
        extractions_db[meeting_id] = {
            "decisions": [d.model_dump() for d in extractions.decisions],
            "actionItems": [a.model_dump() for a in extractions.action_items],
            "blockers": [b.model_dump() for b in extractions.blockers]
        }
    else:
        print("[MEETGRAPH] No transcript found!", file=sys.stderr)
    
    result = extractions_db.get(meeting_id, {"decisions": [], "actionItems": [], "blockers": []})
    print(f"[MEETGRAPH] Returning: {result}", file=sys.stderr)
    return result


@router.get("/{meeting_id}/action-items")
async def get_action_items(meeting_id: int):
    if meeting_id not in meetings_db:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return extractions_db.get(meeting_id, {}).get("actionItems", [])


@router.post("/{meeting_id}/action-items")
async def create_action_item(meeting_id: int, item: dict):
    if meeting_id not in meetings_db:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    if meeting_id not in extractions_db:
        extractions_db[meeting_id] = {"decisions": [], "actionItems": [], "blockers": []}
    
    action_item = {
        "id": len(extractions_db[meeting_id]["actionItems"]) + 1,
        "task": item.get("task"),
        "owner": item.get("owner"),
        "deadline": item.get("deadline"),
        "status": "pending"
    }
    extractions_db[meeting_id]["actionItems"].append(action_item)
    return action_item
