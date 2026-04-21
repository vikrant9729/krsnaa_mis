# KRSNAA MIS Software

Production-oriented starter implementation of a hierarchical DOS management platform (HLM → CC → Project) with:

- Center hierarchy management
- DOS upload (Excel/CSV, multi-sheet)
- Bulk upsert workflows
- Rate modification engine (% based)
- Audit trail (old/new/user/time)
- AI panel + provider failover chain (OpenRouter → Claude → Ollama)
- RBAC roles (Admin, Manager, Editor, Viewer, AI system)
- Web frontend skeleton (Next.js)

## Monorepo Structure

```
backend/
  app/
    api/
    core/
    db/
    models/
    schemas/
    services/
  requirements.txt
frontend/
  src/pages/
```

## Backend (FastAPI)

### Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Key API Groups

- `/api/auth/*`
- `/api/centers/*`
- `/api/dos/*`
- `/api/bulk/*`
- `/api/audit/*`
- `/api/ai/*`
- `/api/search`

## Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```

## DOS Upload Format (required columns)

- OwnerID
- LAB_Name
- CC_Code
- CC_Name
- Partner_Status
- type
- bill type
- dos avilablety
- Centre_OperationType
- Centre_Sub_OperationType
- Test_Code
- test_name
- Specimen_Type
- Bill_Rate
- TestCategory_Mapped
- LAB_TestId_MIS
- LAB_TestID
- center type

## Notes

- This is a production-style scaffold, ready for extension with:
  - Redis/Celery for background processing
  - Postgres + Alembic migrations
  - real provider SDK integration
  - secure secret manager (Vault/AWS Secrets Manager)
  - row-level scope enforcement per manager assignments
