import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)


class ArchaeologyService:
    def __init__(self):
        self.decision_history = {}
        self._load_sample_history()
    
    def _load_sample_history(self):
        self.decision_history = {
            "database": [
                {
                    "id": 1,
                    "title": "Database Selection Discussion",
                    "date": "2024-01-15",
                    "description": "Initial discussion about database options for the new platform.",
                    "options_discussed": ["MongoDB", "PostgreSQL", "MySQL"],
                    "arguments": "MongoDB was favored for flexibility, PostgreSQL for reliability",
                    "meeting_id": 10
                },
                {
                    "id": 2,
                    "title": "Database Deep Dive",
                    "date": "2024-02-20",
                    "description": "Technical deep dive into PostgreSQL vs MongoDB performance.",
                    "arguments": "PostgreSQL showed 40% better query performance for complex joins",
                    "meeting_id": 15
                },
                {
                    "id": 3,
                    "title": "Final Database Decision",
                    "date": "2024-03-03",
                    "description": "Decision: Use PostgreSQL as primary database.",
                    "rationale": "ACID compliance needed, better join performance, mature ecosystem",
                    "pros": ["ACID compliance", "Better join performance", "Mature ecosystem"],
                    "cons": ["Migration effort required"],
                    "meeting_id": 20
                }
            ],
            "authentication": [
                {
                    "id": 4,
                    "title": "Auth Service Requirements",
                    "date": "2024-02-10",
                    "description": "Discussed authentication requirements for new API.",
                    "arguments": "Need stateless auth that works with mobile apps",
                    "meeting_id": 12
                },
                {
                    "id": 5,
                    "title": "Auth Implementation Decision",
                    "date": "2024-02-15",
                    "description": "Decision: Use JWT with refresh tokens.",
                    "rationale": "Stateless, scalable, industry standard",
                    "pros": ["Stateless", "Scales well", "Works with mobile"],
                    "cons": ["Token size", "Security considerations"],
                    "meeting_id": 14
                }
            ],
            "deployment": [
                {
                    "id": 6,
                    "title": "CI/CD Pipeline Review",
                    "date": "2024-02-25",
                    "description": "Current pipeline takes 30 minutes. Need to optimize.",
                    "arguments": "Looking at GitHub Actions, CircleCI, and custom solutions",
                    "meeting_id": 18
                },
                {
                    "id": 7,
                    "title": "CI/CD Decision",
                    "date": "2024-03-01",
                    "description": "Decision: Adopt GitHub Actions.",
                    "rationale": "Native integration, faster builds, lower cost",
                    "meeting_id": 21
                }
            ]
        }
    
    async def trace_decision(self, decision_id: int) -> List[Dict[str, Any]]:
        for topic, history in self.decision_history.items():
            for item in history:
                if item.get("meeting_id") == decision_id:
                    return history
        
        return []
    
    async def query_by_text(self, query: str) -> List[Dict[str, Any]]:
        query_lower = query.lower()
        results = []
        
        keywords_map = {
            "database": ["database", "postgresql", "mongodb", "sql", "nosql"],
            "authentication": ["auth", "jwt", "authentication", "login", "token"],
            "deployment": ["deploy", "ci/cd", "pipeline", "github actions", "deployment"]
        }
        
        matched_topics = []
        for topic, keywords in keywords_map.items():
            if any(kw in query_lower for kw in keywords):
                matched_topics.append(topic)
        
        if not matched_topics:
            matched_topics = list(self.decision_history.keys())
        
        for topic in matched_topics:
            if topic in self.decision_history:
                for item in self.decision_history[topic]:
                    results.append({
                        **item,
                        "topic": topic,
                        "query_match": self._calculate_match_score(query_lower, item)
                    })
        
        results.sort(key=lambda x: x.get("query_match", 0), reverse=True)
        return results[:10]
    
    def _calculate_match_score(self, query: str, item: Dict[str, Any]) -> float:
        text = f"{item.get('title', '')} {item.get('description', '')}".lower()
        
        query_words = set(query.split())
        text_words = set(text.split())
        
        matches = len(query_words.intersection(text_words))
        return matches / len(query_words) if query_words else 0
    
    async def get_timeline(self, topic: str) -> List[Dict[str, Any]]:
        if topic in self.decision_history:
            return self.decision_history[topic]
        return []
    
    async def get_evolution(self, topic: str) -> Dict[str, Any]:
        history = await self.get_timeline(topic)
        
        if not history:
            return {"topic": topic, "evolution": [], "summary": "No history found"}
        
        summary = f"Decision '{topic}' evolved over {len(history)} discussions. "
        if history:
            final = history[-1]
            if "rationale" in final:
                summary += f"Final decision: {final['rationale']}"
        
        return {
            "topic": topic,
            "evolution": history,
            "summary": summary,
            "total_discussions": len(history)
        }


archaeology_service = ArchaeologyService()
