from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import meetings, knowledge

app = FastAPI(
    title=settings.APP_NAME,
    debug=settings.DEBUG,
    description="Context-Aware Meeting Intelligence Platform"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(meetings.router, prefix="/api/meetings", tags=["meetings"])
app.include_router(knowledge.router, prefix="/api/knowledge", tags=["knowledge"])


@app.get("/")
async def root():
    return {"message": "MeetGraph API", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
