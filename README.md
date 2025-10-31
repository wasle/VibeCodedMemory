# Memory Game Project

The repository hosts a web-based memory game with an Angular frontend and a FastAPI backend.

## Structure

- `frontend/`: Placeholder for the Angular SPA. Generate the project with the Angular CLI once Node.js tooling is ready.
- `backend/`: FastAPI service delivering datasets.
- `FeatureList.txt`: Initial feature brain dump provided by the product owner.
- `Agents.md`: Collaboration notes and ownership mapping (to be added).

## Backend Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The server exposes a `/health` endpoint while the game APIs are still under construction.

### Available API Routes

- `GET /collections` — enumerate playable collections, including description text and icon URL.
- `GET /collections/{collectionId}/images` — return metadata and URLs for each image in a collection.
- `GET /collections/{collectionId}/images/{filename}` — serve the requested asset.

Each collection lives under `backend/collections/<collectionId>`. Provide optional metadata via `description.json`:

```json
{
  "title": "TUX",
  "description": "A collection of Linux penguins.",
  "source": "https://example.com",
  "icon": "Linux-Pinguino.svg"
}
```

Markdown descriptions (`description.md`) are still supported and used when no JSON file exists.

## Node Tooling

Install the local toolchain once per clone:

```bash
npm install
```

This installs the Angular CLI as a project-level dev dependency so every contributor uses the same version (`npx ng version` to confirm). Use `npx ng <command>` from the repo root to scaffold or maintain the Angular workspace.

## Frontend Setup

See `frontend/README.md` for the Angular CLI scaffolding steps executed via the local CLI.

### VS Code Tasks

- Run the Angular dev server with `Terminal → Run Task… → Frontend: ng serve`. The task shells out to `npm run start --prefix frontend`, so scaffold the Angular project first (it adds the `start` script).
