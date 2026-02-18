# 🧭 BrainBoard – Next Steps (V2 Implementation Plan)

---

## 1. Goal

Förbereda BrainBoard för AI utan att implementera AI-funktionerna ännu.

Fokus:

- Data model + UI ska vara redo att ta emot AI-output.
- Arkitekturen ska passa nuvarande Supabase-baserade setup.

---

## 2. Key Decisions (Måste bestämmas innan AI)

### 2.1 AI Trigger (när körs AI?)

Välj ett av dessa (rekommenderat att börja med knapp):

- **Option A (rekommenderad start):** “Magic”-knapp på noden (manuellt)
- Option B: onBlur (när man klickar ut ur noden)
- Option C: debounce efter skrivande (dyrt + risk för fladdrig UX)

**Default för V2-start:** Option A (Magic-knapp)

---

### 2.2 Text-format (Rich Text vs Plain)

Nuvarande läge: textarea = plain text.

Du måste välja:

- **Option A (enkel start):** Plain text + AI returnerar summary + tags (ingen formatering)
- Option B: Markdown (AI kan returnera markdown, men UX på mobil blir sämre)
- Option C: Rich text editor (Tiptap/Slate) innan AI börjar ge formaterad output

**Default för V2-start:** Option A (Plain text först)

---

## 3. Architecture Choice (passar nuvarande stack)

Nuvarande arkitektur är serverless: Client → Supabase.

**Rekommendation:**

- Använd **Supabase Edge Functions** istället för Node/Express-server.

Fördelar:

- Återanvänder Auth direkt
- Ingen separat server att drifta
- Närmare databasen
- Mindre systemkomplexitet

---

## 4. Database Migration (Schema Update)

AI behöver någonstans att spara output.

### 4.1 Lägg till kolumner i `nodes`

- `summary` (text)
- `ai_tags` (jsonb eller text[] beroende på vad som passar)
- `is_processing` (boolean, default false)
- (valfritt senare) `ai_metadata` (jsonb)

### 4.2 V2-mål

- Node ska kunna lagra:
  - sammanfattning
  - taggar
  - status “AI tänker”

---

## 5. Types Update (TypeScript)

Efter schemaändring:

- Uppdatera `types/database.ts` (eller där du har dina Supabase-typer)
- Uppdatera Node-typer i frontend så att:
  - `data.summary` kan finnas
  - `data.ai_tags` kan finnas
  - `data.is_processing` kan finnas

---

## 6. UI Prep (utan AI)

### 6.1 NoteNode ska kunna visa AI-output om den finns

Om noden har:

- summary → visa liten sammanfattningsruta under texten
- ai_tags → visa som små tag-chips

### 6.2 Loading/Thinking state

Om `is_processing === true`:

- visa tydlig indikator (spinner / glow / “AI tänker…”)

Målet:

- användaren ska aldrig tro att appen hängt sig.

---

## 7. AI Infrastructure (men endast setup, ej frontend-integration)

När DB + UI är redo:

- Skapa Supabase Edge Function: `analyze-node`
- Den ska kunna ta emot text och returnera JSON.

MEN:

- Testas först via curl/Postman
- Ingen koppling i UI ännu

---

## 8. Integration (sist)

När Edge Function funkar fristående:

- UI-knapp (“Magic”) kallar Edge Function
- Sätter `is_processing = true`
- Får tillbaka result
- Sparar `summary` + `ai_tags`
- Sätter `is_processing = false`

---

## 9. Risks & Guardrails

- Kör inte AI på autosave → dyrt
- Ha alltid `is_processing` + tydlig UI-feedback
- Börja med enkel output (tags + summary)
- Skala först när det känns stabilt

---

## 10. Definition of Done (för V2 Prep)

V2 Prep är klar när:

- DB har nya kolumner
- Frontend visar summary + tags om data finns
- is_processing visas tydligt
- Ingen AI är integrerad i UI ännu
- Edge Function kan testas separat (senare steg)
