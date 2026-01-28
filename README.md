# SleepAssured

A personalized CBT-I (Cognitive Behavioral Therapy for Insomnia) sleep improvement program with optional WHOOP integration.

## Project Structure

```
sleepassured/
├── apps/
│   ├── web/          # React frontend (Vite + TypeScript + Tailwind)
│   └── api/          # Express backend (TypeScript)
├── packages/
│   └── db/           # Prisma schema + client
└── docs/             # Planning documentation
```

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 15+
- npm

### Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Start PostgreSQL** (via Docker or local install)
   ```bash
   docker run --name sleepdb -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:15
   ```

3. **Create the database**
   ```bash
   docker exec -it sleepdb psql -U postgres -c "CREATE DATABASE sleepdb;"
   ```

4. **Run database migrations**
   ```bash
   npm run db:migrate
   ```

5. **Start development servers**
   ```bash
   npm run dev
   ```

   - Frontend: http://localhost:5173
   - Backend: http://localhost:3000

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start all dev servers |
| `npm run build` | Build all packages |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:generate` | Generate Prisma client |

## Tech Stack

- **Frontend**: React, Vite, TypeScript, Tailwind CSS
- **Backend**: Express, TypeScript
- **Database**: PostgreSQL, Prisma ORM
- **Authentication**: JWT with refresh tokens
