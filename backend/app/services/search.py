import logging
from typing import List, Dict, Any
import json

logger = logging.getLogger(__name__)


class SearchService:
    def __init__(self):
        self.embedding_model = None
        self.ollama_available = False
        self.meetings_data = []
        self._load_sample_data()
    
    async def initialize(self):
        try:
            import httpx
            async with httpx.AsyncClient() as client:
                response = await client.get("http://localhost:11434/api/tags", timeout=5.0)
                if response.status_code == 200:
                    self.ollama_available = True
                    logger.info("Ollama available for embeddings")
        except Exception as e:
            logger.warning(f"Ollama not available: {e}")
        
        self._load_sample_data()
    
    def _load_sample_data(self):
        self.meetings_data = [
            {
                "id": 1,
                "title": "Architecture Review - Q1 2024",
                "date": "2024-03-03",
                "topic": "database selection",
                "description": "Discussed migrating from MongoDB to PostgreSQL for better ACID compliance and relational data needs. Reviewed performance benchmarks showing 40% improvement in query times.",
                "decisions": ["Use PostgreSQL as primary database"],
                "participants": ["John", "Sarah", "Mike"]
            },
            {
                "id": 2,
                "title": "Backend API Planning",
                "date": "2024-02-15",
                "topic": "authentication service",
                "description": "Reviewed Auth Service requirements. Decided to use JWT with refresh tokens. Mentioned previous issues with the old authentication system.",
                "decisions": ["Implement JWT authentication"],
                "participants": ["John", "Alex"]
            },
            {
                "id": 3,
                "title": "Sprint Planning - March",
                "date": "2024-03-01",
                "topic": "deployment pipeline",
                "description": "Discussed CI/CD improvements. Need to reduce deployment time from 30 minutes to under 10.",
                "decisions": ["Adopt GitHub Actions for deployments"],
                "participants": ["Sarah", "Mike", "Alex"]
            }
        ]
    
    async def semantic_search(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        if self.ollama_available:
            return await self._semantic_search_ollama(query, limit)
        else:
            return self._semantic_search_keyword(query, limit)
    
    async def _semantic_search_ollama(self, query: str, limit: int) -> List[Dict[str, Any]]:
        try:
            import httpx
            
            async with httpx.AsyncClient() as client:
                embed_response = await client.post(
                    "http://localhost:11434/api/embeddings",
                    json={
                        "model": "nomic-embed-text",
                        "prompt": query
                    },
                    timeout=30.0
                )
            
            if embed_response.status_code != 200:
                return self._semantic_search_keyword(query, limit)
            
            query_embedding = embed_response.json().get("embedding", [])
            
            results = []
            for meeting in self.meetings_data:
                meeting_text = f"{meeting['title']} {meeting['description']} {meeting.get('topic', '')}"
                
                embed_resp = await client.post(
                    "http://localhost:11434/api/embeddings",
                    json={
                        "model": "nomic-embed-text",
                        "prompt": meeting_text
                    },
                    timeout=30.0
                )
                
                if embed_resp.status_code == 200:
                    meeting_embedding = embed_resp.json().get("embedding", [])
                    similarity = self._cosine_similarity(query_embedding, meeting_embedding)
                    
                    results.append({
                        **meeting,
                        "similarity": similarity,
                        "excerpt": meeting["description"][:200]
                    })
            
            results.sort(key=lambda x: x.get("similarity", 0), reverse=True)
            return results[:limit]
            
        except Exception as e:
            logger.error(f"Semantic search failed: {e}")
            return self._semantic_search_keyword(query, limit)
    
    def _semantic_search_keyword(self, query: str, limit: int) -> List[Dict[str, Any]]:
        query_lower = query.lower()
        query_words = set(query_lower.split())
        
        results = []
        for meeting in self.meetings_data:
            text = f"{meeting['title']} {meeting['description']} {meeting.get('topic', '')}".lower()
            
            matches = sum(1 for word in query_words if word in text)
            score = matches / len(query_words) if query_words else 0
            
            if score > 0:
                results.append({
                    **meeting,
                    "similarity": score,
                    "excerpt": meeting["description"][:200]
                })
        
        results.sort(key=lambda x: x.get("similarity", 0), reverse=True)
        return results[:limit]
    
    def _cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        if not vec1 or not vec2:
            return 0.0
        
        dot_product = sum(a * b for a, b in zip(vec1, vec2))
        magnitude1 = sum(a * a for a in vec1) ** 0.5
        magnitude2 = sum(b * b for b in vec2) ** 0.5
        
        if magnitude1 == 0 or magnitude2 == 0:
            return 0.0
        
        return dot_product / (magnitude1 * magnitude2)


search_service = SearchService()
