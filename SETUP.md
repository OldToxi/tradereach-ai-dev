# SETUP.md — what you do by hand

Everything here is Phase 0 in `PLAN.md`. An agent cannot do these — they need a browser, a
Google account and your credit card. Do **step 2 first**; it is the critical path.

Total: about 35 minutes. None of it requires the code to exist yet, so do it while an agent
works on Phase 1.

---

## 1. Repo (3 min)

```bash
git init && git add -A && git commit -m "planning bundle"
gh repo create tradereach-ai --private --source=. --push
```

---

## 2. Google Cloud — Gmail OAuth (15 min, do this first)

This is the step that goes wrong. Doing it early means it goes wrong while you still have time.

1. console.cloud.google.com → new project `tradereach-ai`
2. APIs & Services → Library → enable **Gmail API** and **Google Calendar API**
3. OAuth consent screen → **External** → publishing status stays **Testing**
4. Test users → add your own Google address. **Only test users can sign in while in Testing.**
   Forgetting this produces a "app is blocked" error that looks like a code bug
5. Scopes → add `https://www.googleapis.com/auth/gmail.compose` and
   `https://www.googleapis.com/auth/calendar.events`
   - `gmail.compose` creates drafts and cannot send. That is deliberate and is a scoring
     point in the brief. Do not add `gmail.send`
6. Credentials → OAuth client ID → **Web application**
   - Authorised redirect URIs — add both now:
     - `http://localhost:3000/api/auth/gmail/callback`
     - `https://<your-vercel-domain>/api/auth/gmail/callback`
   - A mismatch here is the single most common failure. The URI must match character for
     character, including the trailing path and no trailing slash
7. Copy the client ID and secret

> Expect an "unverified app" warning screen when you first connect. Click through
> *Advanced → Go to tradereach-ai (unsafe)*. Normal for Testing status. Mention it in your
> demo video so nobody thinks it is a defect.

---

## 3. Supabase (8 min)

1. supabase.com → new project. Pick the region nearest you. Save the database password
2. Project settings → API → copy **Project URL**, **anon public key**, **service_role key**
3. Install the CLI and link:

```bash
npm i -g supabase
supabase login
supabase link --project-ref <your-ref>
```

4. The agent applies migrations with `supabase db push` in T1.3

> The `service_role` key bypasses all row-level security. It goes in `.env.local` and Vercel
> only, never in client code, never in the repo. `lib/supabase/admin.ts` is the only file
> allowed to read it.

---

## 4. Anthropic (3 min)

1. console.anthropic.com → API keys → create key
2. Billing → set a monthly spend limit. The build uses very little, but a runaway loop
   during development is a real risk and a cap costs nothing

---

## 5. Vercel (5 min)

1. vercel.com → import the GitHub repo
2. Settings → Environment Variables → add every key from `.env.example`
3. Set `AUTH_MODE=live` on Vercel. Never `stub`
4. After the first deploy, copy the domain back into the Google redirect URIs from step 2

---

## 6. Local (2 min)

```bash
cp .env.example .env.local
# fill every value
npm install
npm run verify      # should pass on an empty scaffold
npm run progress    # draws the bar, prints the next task
```

---

## Handing it to an agent

In the repo directory:

```
claude
```

then:

> Read AGENTS.md, then PLAN.md, then the Handoff section of WORKLOG.md. Start at the first
> unticked task. After each task, update WORKLOG.md, run npm run progress, and commit.
> Stop at 95% of your usage budget and write the handoff.

The same prompt works for Cursor, Codex, Aider or a second Claude session. The three files
carry all the state, so any agent can continue from where the last one stopped.

---

## What to do when it breaks

| Symptom | Cause | Fix |
|---|---|---|
| `redirect_uri_mismatch` | URI not exact | Copy it from the error message into Google Cloud verbatim |
| "app is blocked" | You are not a test user | Add your address in step 2.4 |
| RLS blocks everything | Policies written before the JWT hook | Do T1.5 before testing T1.4 |
| Queries return `[]` for a valid row | Using the user client where the row is out of the user's market scope | Correct behaviour — switch user or widen `assigned_markets` |
| Types out of date after a migration | Generated file is a snapshot | Rerun T1.6 |
| Gmail draft created in the wrong mailbox | Token belongs to whoever connected it | Expected in the single-token setup; note it in known limitations |
