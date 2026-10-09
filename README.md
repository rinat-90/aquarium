# 🐠 Family Creative Aquarium

A creative, interactive 3D aquarium where families can design their own fish, bring them to life, and watch them swim in a virtual underwater world.

Built with React, TypeScript, Three.js, Fastify, and PostgreSQL.

## Overview

Family Creative Aquarium is a web application designed to make creating and caring for virtual fish a fun experience for the whole family.

Users can create colorful 3D fish, paint their own designs, manage multiple aquariums, and watch their creations swim with species-specific animations.

The long-term goal is to build a playful underwater world where children and parents can create, customize, and interact with their own aquatic environments.

## Features

### Aquarium
- Interactive 3D aquarium environment
- Animated fish with natural swimming behavior
- Species-specific movement and fin animations
- Multiple aquariums per user
- Aquarium creation, renaming, and deletion
- Move fish between aquariums
- Default aquarium management

### Fish Creation
- Create and customize 3D fish
- Classic fish and angelfish models
- Fish painting and color customization
- Hand-drawn fish creation
- Fish profiles and management
- Persistent fish data and textures

### Accounts and Data
- User authentication
- Private, user-owned aquariums
- PostgreSQL-backed persistence
- REST API for aquariums and fish
- Texture upload and storage

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite |
| 3D Graphics | Three.js |
| Backend | Node.js, Fastify 5 |
| Database | PostgreSQL 17 |
| ORM | Prisma 7 |
| Authentication | Better Auth |
| Validation | Zod |
| Monorepo | pnpm, Turborepo |
| Deployment | Railway (planned) |

## Project Structure

```text
aquarium/
├── apps/
│   ├── web/          # React frontend and 3D aquarium
│   └── api/          # Fastify backend
├── packages/
│   ├── database/     # Prisma schema and database access
│   └── types/        # Shared types
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

## Getting Started

### Prerequisites

- Node.js (compatible with the workspace configuration)
- pnpm
- Docker and Docker Compose
- Git

### 1. Clone the repository

```bash
git clone https://github.com/rinat-90/aquarium.git
cd aquarium
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Configure environment variables

Set up the environment variables required by the API and frontend.

Typical configuration includes:

```env
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5434/DATABASE_NAME
BETTER_AUTH_SECRET=replace-with-a-secure-secret
BETTER_AUTH_URL=http://localhost:3001
```

Use the actual database credentials and environment variable names defined by the application. Do not commit `.env` files containing secrets.

### 4. Start PostgreSQL

Start the database using the project's Docker Compose configuration.

```bash
docker compose up -d
```

### 5. Prepare the database

Run the Prisma migrations using the scripts configured in the database workspace.

### 6. Start development

Start the applications using the root development script, if configured:

```bash
pnpm dev
```

The API is configured for local development on port `3001`. The frontend URL depends on the Vite development configuration.

## Development

Run frontend type checking:

```bash
pnpm --filter @aquarium/web exec tsc --noEmit
```

Build the frontend:

```bash
pnpm --filter @aquarium/web build
```

Check for unused frontend code:

```bash
pnpm --filter @aquarium/web exec knip
```

## Roadmap

- [x] 3D aquarium foundation
- [x] Classic fish and angelfish models
- [x] Fish swimming and animations
- [x] Fish drawing and painting
- [x] Authentication and database integration
- [x] Multiple aquarium management
- [x] Fish persistence and texture storage
- [ ] Aquarium URL routing
- [ ] Improved fish creation experience
- [ ] Fish feeding and interactions
- [ ] Aquarium customization with plants, rocks, and substrates
- [ ] Responsive family-friendly interface
- [ ] Production deployment on Railway
- [ ] Aquarium sharing and family collaboration

## Vision

The aquarium is more than a place to display virtual fish.

It's a creative space where a child can draw a fish, name it, watch it come alive, and build an underwater world together with their family.

---

**Project status:** Active development.
