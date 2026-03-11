import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)


class KnowledgeService:
    def __init__(self):
        self.decisions = []
        self._load_sample_decisions()
    
    async def initialize(self):
        self._load_sample_decisions()
    
    def _load_sample_decisions(self):
        self.decisions = [
            {
                "id": 1,
                "title": "Use PostgreSQL as primary database",
                "description": "Decided to migrate from MongoDB to PostgreSQL for better ACID compliance and relational data handling. Reviewed benchmarks showing 40% query improvement.",
                "date": "2024-03-03",
                "meeting_id": 1,
                "participants": ["John", "Sarah", "Mike"],
                "rationale": "ACID compliance needed for financial transactions, better join performance, mature ecosystem",
                "pros": ["ACID compliance", "Better join performance", "Mature ecosystem", "Better tooling"],
                "cons": ["Migration effort", "Learning curve for team", "Schema changes required"]
            },
            {
                "id": 2,
                "title": "Implement JWT authentication",
                "description": "Selected JWT with refresh tokens for API authentication. Addresses previous auth issues.",
                "date": "2024-02-15",
                "meeting_id": 2,
                "participants": ["John", "Alex"],
                "rationale": "Stateless, scalable, works well with mobile apps",
                "pros": ["Stateless", "Scales well", "Works with mobile", "Industry standard"],
                "cons": ["Token size", "Security considerations", "Revocation complexity"]
            },
            {
                "id": 3,
                "title": "Adopt GitHub Actions for CI/CD",
                "description": "Moving deployment pipeline to GitHub Actions to reduce deployment time and improve reliability.",
                "date": "2024-03-01",
                "meeting_id": 3,
                "participants": ["Sarah", "Mike", "Alex"],
                "rationale": "Reduce deployment time from 30min to under 10min",
                "pros": ["Faster builds", "Native GitHub integration", "Lower cost", "Better visibility"],
                "cons": ["Migration time", "Learning curve"]
            }
        ]
    
    async def get_all_decisions(self) -> List[Dict[str, Any]]:
        return self.decisions
    
    async def get_decision_by_id(self, decision_id: int) -> Dict[str, Any]:
        for decision in self.decisions:
            if decision["id"] == decision_id:
                return decision
        return None
    
    async def search_decisions(self, query: str) -> List[Dict[str, Any]]:
        query_lower = query.lower()
        results = []
        for decision in self.decisions:
            text = f"{decision['title']} {decision['description']}".lower()
            if query_lower in text:
                results.append(decision)
        return results
    
    async def get_graph(self, limit: int = 100) -> Dict[str, Any]:
        nodes = []
        edges = []
        
        for decision in self.decisions[:limit]:
            nodes.append({
                "id": f"decision_{decision['id']}",
                "label": decision["title"],
                "type": "decision"
            })
        
        for i, d1 in enumerate(self.decisions):
            for j, d2 in enumerate(self.decisions):
                if i < j:
                    edges.append({
                        "from": f"decision_{d1['id']}",
                        "to": f"decision_{d2['id']}",
                        "label": "related"
                    })
        
        return {
            "nodes": nodes,
            "edges": edges
        }


knowledge_service = KnowledgeService()
