# Agents & Responsibilities

## Product Owner
- Provides feature priorities and gameplay requirements (see `FeatureList.txt`).
- Validates UX and gameplay behaviour.

## Frontend Agent
- Scaffold and evolve the Angular single-page application in `frontend/`.
- Implement the memory board UI, card flipping logic, and score display.
- Integrate image sources (local datasets first, remote search later).
- Manage responsive layout and board size configuration.

## Backend Agent
- Extend the FastAPI service in `backend/` beyond the current `/health` endpoint.
- Supply image metadata and shuffled game boards.
- Track scoring attempts and advanced error counting modes.
- Orchestrate dataset management (local libraries, optional remote sources).

## Shared Tasks
- Define data contracts between client and server.
- Establish automated tests and linting for both stacks.
- Document setup steps and pending work in `README.md` and future planning docs.

