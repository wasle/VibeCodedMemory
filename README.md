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
