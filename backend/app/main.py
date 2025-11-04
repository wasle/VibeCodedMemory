from __future__ import annotations

import json
import mimetypes
from dataclasses import dataclass
from pathlib import Path
import os
from typing import Annotated, Literal, Tuple, Union

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

app = FastAPI(title="Memory Game API", version="0.2.0")

ALLOWED_ORIGINS_REGEX = r"http://(localhost|127\.0\.0\.1)(:\d+)?"
ADDITIONAL_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("ADDITIONAL_CORS_ORIGINS", "").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ADDITIONAL_ALLOWED_ORIGINS or [],
    allow_origin_regex=ALLOWED_ORIGINS_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

COLLECTION_EXTENSIONS: tuple[str, ...] = (".png", ".jpg", ".jpeg", ".svg", ".gif", ".webp")
BACKEND_ROOT = Path(__file__).resolve().parent.parent
COLLECTIONS_ROOT = BACKEND_ROOT / "collections"


class CollectionSummary(BaseModel):
    id: str
    title: str
    description: str | None
    icon_url: str | None
    pairs_url: str
    image_count: int
    pair_count: int
    source: str | None = None


class CardImage(BaseModel):
    kind: Literal["image"] = "image"
    filename: str
    url: str


class CardMarkdown(BaseModel):
    kind: Literal["markdown"] = "markdown"
    content: str


CardFace = Annotated[Union[CardImage, CardMarkdown], Field(discriminator="kind")]


class CardPair(BaseModel):
    cards: Tuple[CardFace, CardFace]


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

        metadata = read_collection_metadata(collection_dir)
        assets = list_collection_files(collection_dir)

        if not assets and not metadata.pairs:
            # Skip collections that have neither assets nor configured pairs.
            continue

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
        pairs_url = str(request.url_for("list_collection_pairs", collection_id=collection_dir.name))
        pair_count = len(metadata.pairs) if metadata.pairs is not None else len(assets)

        summaries.append(
            CollectionSummary(
                id=collection_dir.name,
                title=metadata.title,
                description=metadata.description,
                icon_url=icon_url,
                pairs_url=pairs_url,
                image_count=len(assets),
                pair_count=pair_count,
                source=metadata.source,
            )
        )

    return summaries


@app.get(
    "/collections/{collection_id}/pairs",
    response_model=list[CardPair],
    tags=["collections"],
    name="list_collection_pairs",
)
async def list_collection_pairs(collection_id: str, request: Request) -> list[CardPair]:
    """Return the configured pairs for a collection, supporting image and markdown cards."""
    collection_dir = resolve_collection_dir(collection_id)
    metadata = read_collection_metadata(collection_dir)

    pair_definitions: list[PairDefinition]

    if metadata.pairs is not None:
        pair_definitions = metadata.pairs
    else:
        assets = list_collection_files(collection_dir)
        if not assets:
            raise HTTPException(status_code=404, detail="Collection contains no playable assets.")
        pair_definitions = [
            PairDefinition(
                first=CardDefinition(kind="image", value=asset.name),
                second=CardDefinition(kind="image", value=asset.name),
            )
            for asset in assets
        ]

    if not pair_definitions:
        raise HTTPException(status_code=404, detail="Collection contains no playable pairs.")

    return [
        CardPair(
            cards=(
                _card_definition_to_model(pair.first, collection_id, request),
                _card_definition_to_model(pair.second, collection_id, request),
            )
        )
        for pair in pair_definitions
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
class CardDefinition:
    kind: Literal["image", "markdown"]
    value: str


@dataclass
class PairDefinition:
    first: CardDefinition
    second: CardDefinition


@dataclass
class CollectionMetadata:
    title: str
    description: str | None = None
    icon: str | None = None
    source: str | None = None
    pairs: list[PairDefinition] | None = None


def _card_definition_to_model(definition: CardDefinition, collection_id: str, request: Request) -> CardFace:
    if definition.kind == "image":
        url = str(request.url_for("get_collection_asset", collection_id=collection_id, filename=definition.value))
        return CardImage(filename=definition.value, url=url)
    if definition.kind == "markdown":
        return CardMarkdown(content=definition.value)
    raise HTTPException(status_code=500, detail=f"Unsupported card kind '{definition.kind}'.")


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
        pairs_raw = _extract_pairs(data)
        if pairs_raw is not None:
            metadata.pairs = _parse_pairs(pairs_raw, collection_dir)
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


def _extract_pairs(data: dict[str, object]) -> object | None:
    for key in ("pairs", "Pairs", "Pairs:"):
        if key in data:
            return data[key]
    return None


def _parse_pairs(raw_pairs: object, collection_dir: Path) -> list[PairDefinition]:
    if not isinstance(raw_pairs, list):
        raise HTTPException(status_code=500, detail="Pairs must be defined as a list.")

    parsed: list[PairDefinition] = []
    for pair_index, raw_pair in enumerate(raw_pairs, start=1):
        if not isinstance(raw_pair, list):
            raise HTTPException(status_code=500, detail=f"Pair {pair_index} must be a list of card definitions.")

        card_definitions: list[CardDefinition] = []
        for item_index, raw_item in enumerate(raw_pair, start=1):
            if not isinstance(raw_item, dict):
                raise HTTPException(status_code=500, detail=f"Card {item_index} in pair {pair_index} must be an object.")

            normalized = {str(key).strip().lower().rstrip(":"): raw_item[key] for key in raw_item}

            if "image" in normalized:
                filename = str(normalized["image"]).strip()
                if not filename:
                    raise HTTPException(status_code=500, detail=f"Card {item_index} in pair {pair_index} references an empty image filename.")
                candidate = collection_dir / filename
                if not candidate.is_file() or candidate.suffix.lower() not in COLLECTION_EXTENSIONS:
                    raise HTTPException(status_code=500, detail=f"Image '{filename}' in pair {pair_index} was not found in the collection.")
                card_definitions.append(CardDefinition(kind="image", value=filename))
                continue

            if "markdown" in normalized:
                content = str(normalized["markdown"])
                if not content.strip():
                    raise HTTPException(status_code=500, detail=f"Markdown content in pair {pair_index} cannot be empty.")
                card_definitions.append(CardDefinition(kind="markdown", value=content))
                continue

            if "text" in normalized:
                content = str(normalized["text"])
                if not content.strip():
                    raise HTTPException(status_code=500, detail=f"Text content in pair {pair_index} cannot be empty.")
                card_definitions.append(CardDefinition(kind="markdown", value=content))
                continue

            raise HTTPException(status_code=500, detail=f"Unsupported card definition in pair {pair_index}.")

        if not card_definitions:
            raise HTTPException(status_code=500, detail=f"Pair {pair_index} must define at least one card.")

        if len(card_definitions) == 1:
            single = card_definitions[0]
            duplicate = CardDefinition(kind=single.kind, value=single.value)
            card_definitions.append(duplicate)

        if len(card_definitions) != 2:
            raise HTTPException(status_code=500, detail=f"Pair {pair_index} must define exactly one or two cards.")

        parsed.append(PairDefinition(first=card_definitions[0], second=card_definitions[1]))

    return parsed
