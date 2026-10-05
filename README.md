# TaskSyncer

TaskSyncer is a collaborative task manager with a FastAPI backend, React frontend, PostgreSQL database, and WebSocket updates.

## What’s in this repository?

| Path | Purpose |
| --- | --- |
| `backend/app/routers/` | HTTP and WebSocket endpoints |
| `backend/app/services/` | Application rules and database operations |
| `backend/app/models/` | SQLAlchemy database tables and relationships |
| `backend/app/schemas/` | Request and response validation |
| `backend/app/core/` | Authentication, shared dependencies, and WebSocket support |
| `frontend/src/pages/` | Screen-level React components |
| `frontend/src/components/` | Reusable UI components |
| `frontend/src/api/` | HTTP client and API calls |
| `frontend/src/context/` | Login state and WebSocket state |
| `docs/` | Project map and development notes |
| `screenshots/` | App screenshots used in this README |

See [docs/PROJECT_MAP.md](docs/PROJECT_MAP.md) for a longer guide to where features belong.

## Run locally on Windows

Open two PowerShell terminals from the repository root.

### 1. Start the backend

Create and activate the root virtual environment once, then install backend packages:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Configure the backend’s local `backend/.env` with your database and authentication settings. Do not commit this file.
Start from the safe template:

```powershell
Copy-Item backend/.env.example backend/.env
```

Then edit `backend/.env`: set `DATABASE_URL` to your PostgreSQL connection string and replace `SECRET_KEY` with a unique value. Generate one with `python -c "import secrets; print(secrets.token_urlsafe(48))"`. If `backend/.env` already exists, keep it and copy only any missing settings from the example instead of overwriting it.

Then start the API:

```powershell
cd backend
..\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Start the frontend

```powershell
cd frontend
npm install
npm start
```

The frontend reads `frontend/.env`. Its template uses local development URLs; copy it if you do not already have a local file:

```powershell
Copy-Item .env.example .env
```

If `frontend/.env` already exists, do not overwrite it. The frontend adjusts these localhost API and WebSocket URLs to the laptop's hostname when you open the development app from another device on the same Wi-Fi.

Open `http://localhost:3000` on the laptop. The API is at `http://localhost:8000`; API documentation is at `http://localhost:8000/docs`.

## Open the development app on a phone

Keep both terminals running and connect the laptop and phone to the same Wi-Fi. Open the React **On Your Network** URL printed by `npm start`, usually `http://<laptop-wifi-ip>:3000`. The backend must be started with `--host 0.0.0.0`, as shown above. If the phone cannot connect to port 8000, allow Python through Windows Firewall on the private network.

The laptop’s Wi-Fi IP can change after a restart or router lease renewal. Check the React startup output or run `ipconfig` and use the Wi-Fi IPv4 address. A DHCP reservation in the router can keep the laptop’s address stable. The laptop must remain awake and both development servers must remain running.

## Security note

If a password or signing key was committed to Git, rotate it. Deleting or editing the file does not remove its contents from earlier commits.

## Screenshots

### Login

![Login page](screenshots/login.png)
![Login page](screenshots/login1.png)

### Dashboard

![Dashboard](screenshots/dashboard.png)

### Kanban board

![Kanban board](screenshots/kanban.png)

### Analytics

![Analytics](screenshots/analytics.png)

## License

This project is available under the MIT License; see [LICENSE](LICENSE).
