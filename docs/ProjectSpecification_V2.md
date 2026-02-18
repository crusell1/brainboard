# 🧠 BrainBoard -- Project Specification V2

*(AI-Assisted Thinking System)*

------------------------------------------------------------------------

## 1. Vision

BrainBoard är ett personligt, AI-assisterat tankesystem.

Det är inte en whiteboard.\
Det är ett externt kognitivt lager.

Systemet ska:

-   Hjälpa mig strukturera tankar visuellt
-   Förvandla ostrukturerad text till organiserade noder
-   Föreslå kopplingar mellan idéer
-   Identifiera teman och taggar
-   Fungera som en förlängning av mitt arbetsminne

Primärt byggs det för mig själv.\
Sekundärt ska det i framtiden kunna delas och användas tillsammans med
andra.

------------------------------------------------------------------------

## 2. Core Philosophy

-   Struktur före estetik
-   Arkitektur före features
-   AI som assistent, inte ersättare
-   Minimal friktion för användaren
-   All intelligens ska vara förklarbar
-   Systemet ska växa organiskt

Ingen feature får implementeras utan att:

1.  Passa in i arkitekturen
2.  Ha tydlig funktion
3.  Inte skapa teknisk skuld

------------------------------------------------------------------------

## 3. Scope -- Version 2 (AI Foundation Phase)

### Fokus:

Bygga en stabil AI-pipeline ovanpå befintlig grund.

------------------------------------------------------------------------

## 4. Functional Scope -- V2

### 4.1 Nodes (Utökning)

-   Rich text editor (inte markdown-baserad)
-   Fetstil
-   Punktlistor
-   Numrerade listor
-   Rubriknivåer
-   Kortkommandon (desktop)

------------------------------------------------------------------------

### 4.2 Tag System

-   Skapa egna taggar
-   Lägga taggar på noder
-   Filtrera noder via taggar
-   Visa taggar visuellt på node

AI ska kunna:

-   Föreslå taggar
-   Identifiera teman
-   Returnera strukturerade taggar i JSON-format

------------------------------------------------------------------------

### 4.3 AI v1 -- Node Intelligence

När användaren skickar text ska systemet kunna returnera:

``` json
{
  "summary": "",
  "suggested_tags": [],
  "possible_relations": []
}
```

Funktioner:

-   Sammanfattning
-   Taggförslag
-   Förslag på kopplingar till andra noder
-   Strukturering av ostrukturerad text

------------------------------------------------------------------------

### 4.4 Voice Pipeline (Fas 2 inom V2)

Pipeline:

Ljud → Transkribering → LLM → Strukturerad node

Systemet ska kunna:

-   Spela in röst
-   Transkribera via modell (t.ex Whisper)
-   Skicka text till LLM
-   Generera färdig node med struktur, taggar och sammanfattning

------------------------------------------------------------------------

### 4.5 Insert System

Vid interaktion ska användaren kunna:

-   Skapa node
-   Lägga in bild
-   Klistra in bild
-   Ladda upp bild
-   Infoga röst
-   Infoga text från clipboard

UI-lösning (utvärderas):

-   Kontextmeny
-   Radialmeny
-   Hybrid

------------------------------------------------------------------------

## 5. AI Architecture

### Princip

Frontend ska aldrig prata direkt med LLM.

Struktur:

React\
↓\
Backend (Node/Express)\
↓\
AI Service Layer\
↓\
LLM API

AI Service Layer ansvarar för:

-   Prompt-design
-   JSON-parse
-   Error handling
-   Logging
-   Rate limiting
-   Modellbyte utan frontend-ändring

------------------------------------------------------------------------

## 6. Data Model Expansion (V2)

### nodes (utökad)

-   id
-   user_id
-   position_x
-   position_y
-   content (rich text format)
-   summary (text)
-   tags (array)
-   ai_metadata (jsonb)
-   created_at
-   updated_at

### tags

-   id
-   user_id
-   name
-   created_at

------------------------------------------------------------------------

## 7. Learning Objectives

Detta projekt ska lära mig:

-   Hur LLM-integration fungerar i praktiken
-   Hur man designar AI-prompts
-   Hur man bygger en AI-pipeline
-   Skillnaden mellan transkribering och språkmodell
-   Backend--AI--Frontend-arkitektur
-   Skalbar systemdesign

------------------------------------------------------------------------

## 8. Non-Goals (Just Now)

Ska inte implementeras förrän AI-grunden är stabil:

-   Multi-user realtime
-   Delning via länk
-   Avancerade edges
-   Design-perfektion
-   Flera board-typer
-   Task management
-   Knowledge graph analytics

------------------------------------------------------------------------

## 9. Expansion Roadmap

### Fas 1

-   Rich text
-   Taggsystem
-   AI tag suggestions

### Fas 2

-   Voice pipeline
-   Strukturering av röstinput

### Fas 3

-   AI clustering
-   Temaanalys över hela board

### Fas 4

-   Realtidssamarbete

------------------------------------------------------------------------

## 10. Identity Shift

Detta projekt är inte längre en infinite whiteboard.

Det är ett AI-assisterat tankesystem.
