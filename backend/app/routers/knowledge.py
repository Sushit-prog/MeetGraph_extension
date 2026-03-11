from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter()


class SearchRequest(BaseModel):
    query: str
    limit: int = 5


class ArchaeologyRequest(BaseModel):
    query: str


@router.post("/search")
async def search_knowledge(request: SearchRequest):
    from app.services.search import search_service
    
    results = await search_service.semantic_search(request.query, request.limit)
    return results


@router.get("/decisions")
async def list_decisions():
    from app.services.knowledge import knowledge_service
    
    decisions = await knowledge_service.get_all_decisions()
    return decisions


@router.get("/decisions/{decision_id}/archaeology")
async def get_decision_archaeology(decision_id: int):
    from app.services.archaeology import archaeology_service
    
    result = await archaeology_service.trace_decision(decision_id)
    return result


@router.post("/archaeology")
async def archaeology_query(request: ArchaeologyRequest):
    from app.services.archaeology import archaeology_service
    
    result = await archaeology_service.query_by_text(request.query)
    return result


@router.get("/graph")
async def get_knowledge_graph(limit: int = 100):
    from app.services.knowledge import knowledge_service
    
    graph = await knowledge_service.get_graph(limit)
    return graph
