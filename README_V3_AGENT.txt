JOB AGENT ANTONIO - V3 / FASE 1

Aggiungi questi file al repository mantenendo le cartelle indicate.

1) lib/agent/*
2) app/api/agent/run/route.ts
3) vercel.json nella root
4) supabase/job_agent.sql (serve solo come istruzione SQL)

PRIMA FASE - SOLO REVIEW
Imposta su Vercel:
AGENT_MODE=review
ADZUNA_APP_ID / ADZUNA_APP_KEY
JOOBLE_API_KEY (opzionale all'inizio)
CRON_SECRET = stringa lunga casuale

SUPABASE
- Crea un progetto gratuito Supabase.
- Apri SQL Editor.
- Incolla supabase/job_agent.sql ed esegui.
- Su Vercel aggiungi SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.

AUTO-INVIO
Non attivarlo finche non hai verificato almeno alcuni giorni in review.
Quando sei soddisfatto:
AGENT_MODE=auto
AUTO_SEND_THRESHOLD=85
MAX_AUTO_SEND_PER_RUN=3

Regole:
- Figma e Blender NON vengono mai usati come competenze del CV.
- Se sono richiesti, vengono trattati come gap.
- Stage/junior vengono penalizzati.
- Invio automatico solo con email pubblica trovata e Supabase configurato.
- Se manca email: needs_manual.

TEST MANUALE ENDPOINT
Apri /api/agent/run aggiungendo header Authorization: Bearer <CRON_SECRET> tramite un client API.
Il cron Vercel lo chiamera automaticamente ogni giorno alle 06:30 UTC.
