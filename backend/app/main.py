from fastapi import FastAPI

app = FastAPI(title="Memory Game API", version="0.1.0")


@app.get("/health", tags=["system"])
async def health_check() -> dict[str, str]:
    """Return a simple status payload so the frontend can verify connectivity."""
    return {"status": "ok"}

