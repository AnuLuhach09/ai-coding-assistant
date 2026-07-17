# Enterprise AI Coding Assistant

An enterprise-level AI Coding Assistant from scratch (similar to ChatGPT + Cursor + Copilot) containing a Express + TypeScript backend and React 19 + Vite frontend.

## Key Features

1. **AI Chat & Streaming**: Stream responses word-by-word (Server-Sent Events) with memory context.
2. **RAG Integration**: Retreive relevant codebase chunks before every query using ChromaDB.
3. **GitHub Analyzer**: Clones repository, parses files, and computes multidimensional Quality & Security scores.
4. **Drag & Drop Folder & Zip Uploads**: Ingest folders and extract ZIPs directly to database and index them.
5. **Monaco Editor integration**: Syntax highlighting, custom theme, and file tabs.
6. **AI Code Triggers**: Short-cut controls to Explain, Optimize, Debug, Write Tests, and Generate Docs.
7. **User Profile & Settings**: Select AI Providers, customize models (OpenAI, Anthropic, Gemini, Groq, OpenRouter, Ollama) and temperatures.

---

## Tech Stack

### Backend
- **Node.js** & **Express.js** with **TypeScript**
- **Prisma ORM** with **PostgreSQL**
- **Redis** for session cache
- **ChromaDB** for vector similarity searches
- **Winston** & **Morgan** for HTTP and error logging

### Frontend
- **React 19** & **TypeScript** with **Vite**
- **Zustand** for state stores
- **TailwindCSS** for styles (supporting Dark and Light modes)
- **TanStack Query** (React Query)
- **Monaco Editor**

---

## Getting Started

### 1. Prerequisite Containers
Ensure your Docker Daemon is running, then spin up PostgreSQL, Redis, and ChromaDB:
```bash
docker-compose up -d
```

### 2. Configure Environment variables
Set up your AI API keys and database strings in `backend/.env` (cloned from `.env.example`).

### 3. Setup Backend
```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```
The backend server runs on `http://localhost:5000`.

### 4. Setup Frontend
```bash
cd ../frontend
npm install
npm run dev
```
The frontend dev server runs on `http://localhost:3000`.

---

## Deploying to Railway

Chroma and Redis are now **optional** — the app boots and runs fully (auth, projects, chat, files, GitHub analysis) without them. RAG/embeddings-based context is the only feature disabled when `CHROMA_URL` is unset.

Deploy as two Railway services from this one repo:

### 1. Backend service
- Root directory: `backend/`
- Add a **PostgreSQL** plugin (Railway sets `DATABASE_URL` automatically).
- Env vars to set:
  - `JWT_SECRET`, `JWT_REFRESH_SECRET`
  - `CORS_ORIGIN` — the frontend service's public URL (set after step 2)
  - `CROSS_SITE_COOKIES=true` (frontend and backend are on different subdomains)
  - Your AI provider key(s) (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc.)
  - Leave `REDIS_URL` / `CHROMA_URL` unset unless you've provisioned those services
- `railway.json` in this folder builds with `npm install && npm run build`, runs `npm run start` (which runs `prisma migrate deploy` before booting), and health-checks `/health`.

### 2. Frontend service
- Root directory: `frontend/`
- Env var: `VITE_API_URL` — the backend service's public URL + `/api`, e.g. `https://<backend>.up.railway.app/api`
- `railway.json` in this folder builds with `npm install && npm run build` and serves the static `dist/` output via `serve` (`npm run start`).
- Note: `VITE_API_URL` is baked in at build time. If you change it, trigger a redeploy so the frontend rebuilds.

### 3. Wire them together
- Set the backend's `CORS_ORIGIN` to the frontend's Railway URL, and redeploy the backend.
- Optional: add Railway's Redis plugin and set `REDIS_URL` to enable caching, or deploy a ChromaDB instance and set `CHROMA_URL` to enable RAG search — both are picked up automatically with no code changes.

---

## Architecture & Code Quality
- Follows **Repository Pattern** and **Service Layer** structure for modularity and isolation.
- Extensively typed using TypeScript.
- Implements strict input verification schemas using **Zod** and request parameter filters.
- Secure session storage utilizing short-lived access JWT tokens and HTTP-Only refresh cookies.
