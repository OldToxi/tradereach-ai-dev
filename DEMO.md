# TradeReach AI — demo recording script

Use this to record the demonstration video / live walkthrough (deliverable #11). The app
is seeded mid-journey, so almost everything can be shown without firing a live AI call or
a send. Only **Scene 8 (Gmail draft)** needs the Gmail connector connected (or you can
describe it from the screen).

## Before you record

1. Run `npm run dev` and sign in as the Export Manager:
   `rifat.hasan@anwargroup.test` / `demo-password-2026`.
2. Set the theme to light, window at a comfortable width (~1200 px).
3. Optional: connect Gmail on **Settings & access → Connectors** if you want to show a
   real draft ID in Scene 8.

## The walkthrough (twelve scenes)

### 1 — Product & market
**Click** `Products`.
**Show** the product list (Jute Yarn). Open it and point at the **Market fit** panel —
markets scored and ranked against the product, with the reasoning behind each fit.

### 2 — Buyer added
**Click** `Companies`.
**Show** the company table with its fit-score column and the `+ Add company` button.
Narrate: "A buyer enters as a company record with a market, product focus and owner."

### 3 — Research & sources
**Click** into **Yıldız Tekstil** (`Companies` → row).
**Show** the **Research & sources** tab: the AI fact list, each fact carrying a provenance
badge (`verified`, `unverified`, `ai`, `human_approved`) and a clickable source, with the
fit score and breakdown on the **Overview** tab.

### 4 — Qualified & prioritised
**Show** the **Qualification** tab: qualification state, fit score, and the priority rank
and reason.
**Click** `Opportunity pipeline` and show the qualified company sitting in its stage
column, ranked against the rest.

### 5 — Decision-maker
**Click** `Decision-makers` (or the company's **Decision-makers** tab).
**Show** the contact with role, email source and lawful basis for holding it.

### 6 — AI opportunity summary → outreach
**Show** the **Overview** tab's AI block: the one-paragraph opportunity summary, gaps, and
suitability — all labelled with the AI badge.
**Click** `Review queue` and point at the **NordFiber** first-touch draft the AI produced,
with its "why" bullets and the claims it used.

### 7 — Review & approve (guardrail)
**Show** the draft's pre-send checks. Highlight the **samples** language highlighted red,
the "No reserved commercial matter" check that blocks approval, and the note that a
**Commercial Authority** must release it.
**Say**: "The AI drafted it, but the model is never allowed to promise samples — that is a
reserved commercial matter, so a named approver and a commercial release are both required
before it can go out."

### 8 — Gmail draft
**Approve/release** a clean draft and **show** that the result is a **Gmail draft ID** in
the approver's own mailbox — TradeReach has `gmail.compose` only and can **never send**.
(If Gmail isn't connected, show the connector prompt on **Settings & access → Connectors**
and describe this step.)

### 9 — Reply received
**Click** `Replies`.
**Show** the inbound **Yıldız** reply in the queue.

### 10 — AI classify + next action
**Show** the AI triage on the reply: category, intent, urgency, confidence, and the
reasoning — then the split where the technical question routes to the executive and the
commercial question (pricing) routes to the Commercial Authority.

### 11 — Pipeline & dashboard
**Click** `Opportunity pipeline` then `Dashboard`.
**Show** the pipeline board and the dashboard KPIs (open replies, next touches, weekly
read-out).

### 12 — Progression
**Click** the Yıldız company → **Communication** tab, then `Meetings & tasks`.
**Show** that the company advanced to commercial discussion, with the follow-up task and
scheduled meeting.
**Close on** `Audit trail`: every approval, promotion, AI run and connector call recorded,
append-only.

---

## Narration notes (the three rules to call out)

1. **Provenance** — every fact can point at where it came from; the AI never states a fact
   a person hasn't verified.
2. **Named approver** — nothing is sent unless a named person approved it.
3. **Reserved matters** — price, MOQ, samples, credit and the rest are never given to the
   AI and always require a commercial release.
