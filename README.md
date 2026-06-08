# AI Medical Summary App

Backend boilerplate for a Flask + PostgreSQL application that generates patient-friendly visit summaries in simple English/Telugu.

## Backend Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
flask --app app run
```

## API Endpoints

- `GET /api/health`
- `POST /api/generate`
- `GET /api/history`
- `GET /api/history/<id>`
- `POST /api/feedback`
- `GET /api/admin/analytics`
- `GET /api/templates`

## Database Tables

- `consultations`
- `medications`
- `summaries`
- `feedback`
- `templates`
