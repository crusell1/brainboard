# 🧠 BrainBoard – Project Specification

---

## 1. Vision

BrainBoard är en oändlig, node-baserad whiteboard som fungerar som ett externt arbetsminne.

### Appen ska:

- Vara helt tom vid start
- Växa organiskt från användaren
- Fungera på mobil och dator
- Synkroniseras i realtid
- Vara byggd för framtida AI-integration

Den ska ersätta linjära anteckningar med ett spatialt tankenätverk.

---

## 2. Core Philosophy

- Struktur före funktion
- Stabilitet före expansion
- Ingen död kod
- Ingen snabb patchning
- Refaktorera istället för att stapla
- Dokumentera varje större beslut

---

## 3. Scope – Version 1 (MVP)

### V1 ska kunna:

- Visa infinite canvas
- Skapa note-nodes
- Dra runt nodes
- Redigera node-text
- Spara position och text i databas
- Synkronisera mellan enheter
- Autentisera användare

### V1 ska inte innehålla:

- AI-funktioner
- Flera node-typer
- Avancerade edges
- Delning
- Mappar eller flera boards
- Designoptimering

---

## 4. Technical Architecture

### Frontend

- React
- TypeScript
- Vite
- React Flow

### Backend

- Supabase
  - Auth
  - PostgreSQL
  - Realtime

### App format

- Progressive Web App (PWA)

---

## 5. Data Model (V1)

### users

- id (uuid)
- email
- created_at

### nodes

- id (uuid)
- user_id (uuid)
- position_x (float)
- position_y (float)
- content (text)
- created_at (timestamp)
- updated_at (timestamp)

All nodes belong to a user.  
One implicit global board per user.

---

## 6. Development Workflow

### Git Rules

Branches:

- main → stable
- feature/feature-name
- bugfix/bug-name

Rules:

- 1 feature per branch
- Small commits
- Descriptive commit messages
- No unused code
- Remove replaced logic

---

## 7. Coding Standards

- TypeScript strict mode
- No `any`
- Separation of concerns
- No business logic inside UI components
- All reusable logic in hooks or utils
- Clear file naming conventions

---

## 8. Folder Structure

brainboard/
├── client/
├── docs/
└── README.md

---

## 9. Bug Policy

For every bug:

Document:

- What happened?
- Why did it happen?
- How was it fixed?
- What was learned?

Stored in:
docs/bug-log.md

---

## 10. Expansion Strategy

Future features must follow:

1. Architectural review
2. Data model review
3. Feature branch
4. Code implementation
5. Refactor
6. Documentation update

---

## 11. Long-Term Vision

Future versions may include:

- Task nodes
- Edge connections
- AI clustering
- AI summaries
- Shared boards
- Multi-user collaboration
- Smart reminders
- Knowledge graph analysis

But only after V1 is stable.
