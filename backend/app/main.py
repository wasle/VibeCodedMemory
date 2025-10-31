from __future__ import annotations

import json
import mimetypes
from dataclasses import dataclass
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel

app = FastAPI(title="Memory Game API", version="0.2.0")

COLLECTION_EXTENSIONS: tuple[str, ...] = (".png", ".jpg", ".jpeg", ".svg", ".gif", ".webp")
BACKEND_ROOT = Path(__file__).resolve().parent.parent
COLLECTIONS_ROOT = BACKEND_ROOT / "collections"


class CollectionSummary(BaseModel):
    id: str
    title: str
    description: str | None
    icon_url: str | None
    images_url: str
    image_count: int
    source: str | None = None


class ImageAsset(BaseModel):
    filename: str
    url: str


@app.get("/health", tags=["system"])
async def health_check() -> dict[str, str]:
    """Return a simple status payload so the frontend can verify connectivity."""
    return {"status": "ok"}


@app.get("/collections", response_model=list[CollectionSummary], tags=["collections"])
async def list_collections(request: Request) -> list[CollectionSummary]:
    """Return high-level metadata for every available image collection."""
    ensure_collections_root()
    summaries: list[CollectionSummary] = []

    for collection_dir in sorted(COLLECTIONS_ROOT.iterdir()):
        if not collection_dir.is_dir():
            continue

        assets = list_collection_files(collection_dir)
        if not assets:
            # Skip empty collections because there is nothing to play with.
            continue

        metadata = read_collection_metadata(collection_dir)

        icon_path: Path | None = None
        if metadata.icon:
            candidate = collection_dir / metadata.icon
            if candidate.is_file() and candidate.suffix.lower() in COLLECTION_EXTENSIONS:
                icon_path = candidate
        if icon_path is None:
            icon_path = assets[0] if assets else None

        icon_url = (
            str(request.url_for("get_collection_asset", collection_id=collection_dir.name, filename=icon_path.name))
            if icon_path
            else None
        )
        images_url = str(request.url_for("list_collection_images", collection_id=collection_dir.name))

        summaries.append(
            CollectionSummary(
                id=collection_dir.name,
                title=metadata.title,
                description=metadata.description,
                icon_url=icon_url,
                images_url=images_url,
                image_count=len(assets),
                source=metadata.source,
            )
        )

    return summaries


@app.get(
    "/collections/{collection_id}/images",
    response_model=list[ImageAsset],
    tags=["collections"],
    name="list_collection_images",
)
async def list_collection_images(collection_id: str, request: Request) -> list[ImageAsset]:
    """Return metadata for all assets inside a collection."""
    collection_dir = resolve_collection_dir(collection_id)
    assets = list_collection_files(collection_dir)

    if not assets:
        raise HTTPException(status_code=404, detail="Collection contains no playable assets.")

    return [
        ImageAsset(
            filename=asset.name,
            url=str(request.url_for("get_collection_asset", collection_id=collection_id, filename=asset.name)),
        )
        for asset in assets
    ]


@app.get(
    "/collections/{collection_id}/images/{filename}",
    response_class=FileResponse,
    tags=["collections"],
    name="get_collection_asset",
)
async def get_collection_asset(collection_id: str, filename: str) -> FileResponse:
    """Serve a specific asset from a collection."""
    collection_dir = resolve_collection_dir(collection_id)
    file_path = collection_dir / filename

    if not file_path.is_file() or file_path.suffix.lower() not in COLLECTION_EXTENSIONS:
        raise HTTPException(status_code=404, detail="Asset not found in collection.")

    media_type = mimetypes.guess_type(str(file_path))[0] or "application/octet-stream"
    return FileResponse(path=file_path, media_type=media_type)


def ensure_collections_root() -> None:
    if not COLLECTIONS_ROOT.exists():
        raise HTTPException(status_code=500, detail="Collections directory is missing on the server.")


def resolve_collection_dir(collection_id: str) -> Path:
    ensure_collections_root()
    safe_collection_id = collection_id.strip().replace("..", "")
    candidate = COLLECTIONS_ROOT / safe_collection_id
    if not candidate.exists() or not candidate.is_dir():
        raise HTTPException(status_code=404, detail="Collection not found.")
    return candidate


def list_collection_files(collection_dir: Path) -> list[Path]:
    assets: list[Path] = [
        child
        for child in sorted(collection_dir.iterdir())
        if child.is_file() and child.suffix.lower() in COLLECTION_EXTENSIONS
    ]
    return assets


@dataclass
class CollectionMetadata:
    title: str
    description: str | None = None
    icon: str | None = None
    source: str | None = None


def read_collection_metadata(collection_dir: Path) -> CollectionMetadata:
    """Read JSON or markdown metadata for a collection and normalize fields."""
    default_title = collection_dir.name.replace("_", " ").title()
    metadata = CollectionMetadata(title=default_title)

    description_json = collection_dir / "description.json"
    if description_json.is_file():
        try:
            data = json.loads(description_json.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=500, detail=f"Invalid JSON in {description_json.name}: {exc}") from exc

        metadata.title = _extract_field(data, ("title", "Title", "Title:")) or metadata.title
        metadata.description = _extract_field(data, ("description", "Description", "Description:"))
        metadata.icon = _extract_field(data, ("icon", "Icon", "Icon:"))
        metadata.source = _extract_field(data, ("source", "Source", "Source:"))
        return metadata

    description_md = collection_dir / "description.md"
    if description_md.is_file():
        metadata.description = description_md.read_text(encoding="utf-8").strip()

    return metadata


def _extract_field(data: dict[str, object], keys: tuple[str, ...]) -> str | None:
    for key in keys:
        if key in data and data[key] is not None:
            value = str(data[key]).strip()
            if value:
                return value
    return None
