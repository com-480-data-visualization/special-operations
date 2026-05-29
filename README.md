# Special Operations (COM-480 project)

| Student's name | SCIPER |
| -------------- | ------ |
| Eliota Braha | 346212 |
| Botond Kovacs | 341415 |
| Sankalp Gambhir | 354377 |

[Milestone 1](./milestone1) • [Milestone 2](./milestone2) • [Milestone 3](./milestone-3)

[Webpage](https://com-480-data-visualization.github.io/special-operations/)

## Prerequisites

You can run the project either locally or through Docker Compose.

Recommended local environment:

- Node.js compatible with the project dependencies
- `pip` and `venv`

## Local setup

Install frontend dependencies:

```bash
npm install
```

Create and populate the Python virtual environment:

```bash
source ./load_venv.sh
```

Start the frontend dev server:

```bash
npm run dev
```

The app is then available at `http://localhost:5173`.

If you want the notebook environment locally as well:

```bash
source .venv/bin/activate
jupyter lab
```

JupyterLab will start on `http://localhost:8888` by default.

## Docker setup

Run both the frontend and the Python/Jupyter environment:

```bash
docker compose up --build
```

## Repository layout

- `src/`: frontend application code
- `public/`: generated JSON assets consumed by the frontend
- `scripts/`: data-fetching and data-building utilities
- `data/`: raw and intermediate data files
- `milestone1/`, `milestone2/`, `milestone3/`: milestone-specific notebooks, scripts, and deliverables

## Notes

- The frontend reads relative asset paths, so local dev, local preview, and static deployment use the same checked-in data files.
- Derived JSON should be regenerated only when upstream data or preprocessing logic changes.
