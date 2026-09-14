# LUHID — Pashu Swasthya

A livestock health tracking web app: a QR "ear tag" per animal, offline-first
symptom logging with AI first-aid guidance (Gemini), a 30-second vet EHR
lookup, and a privacy-preserving public "found an animal" flow.

**Stack**
- Frontend: plain HTML / CSS / JS, no build step — `index.html`, `css/`, `js/`
- Backend: plain Node.js + Express — `server/server.js`
- Database: Supabase (Postgres)
- AI: Google Gemini API (called server-side only — the key never reaches the browser)
- Hosting: frontend on GitHub Pages, backend on Render.com

```
luhid-app/
├── index.html              ← the whole UI (3 portals: farmer / vet / citizen)
├── css/style.css
├── js/
│   ├── api.js               ← talks to your Render backend (edit API_BASE here)
│   ├── db-local.js          ← offline queue (localStorage) for zero-signal logging
│   └── app.js
├── server/                  ← deploy this folder to Render
│   ├── server.js
│   ├── package.json
│   ├── supabase_schema.sql  ← run once in Supabase's SQL editor
│   └── .env.example
├── render.yaml               ← optional: lets Render auto-detect the service config
└── .gitignore
```

---

## 1. Push this to GitHub

```bash
cd luhid-app
git init
git add .
git commit -m "LUHID app"
git branch -M main
git remote add origin https://github.com/<your-username>/luhid-app.git
git push -u origin main
```

---

## 2. Create the Supabase project + tables

1. Go to [supabase.com](https://supabase.com) → **New project**.
2. Once it's ready, open **SQL Editor → New query**, paste the contents of
   `server/supabase_schema.sql`, and run it. This creates `animals`,
   `health_logs`, `vaccination_records`, and `rescue_alerts`.
3. Go to **Project Settings → API**. You'll need two values for the next step:
   - **Project URL** → this is `SUPABASE_URL`
   - **`service_role` secret key** (not the `anon` key — the schema's Row
     Level Security blocks `anon` entirely, by design, so the browser can
     never query Supabase directly) → this is `SUPABASE_KEY`

---

## 3. Get a Gemini API key

Go to [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
and create a free key. This becomes `GEMINI_API_KEY`.

---

## 4. Deploy the backend to Render

1. Go to [render.com](https://render.com) → **New → Web Service**.
2. Connect your GitHub account and pick this repo.
3. Render should detect `render.yaml` and pre-fill the settings. If not, set:
   - **Root Directory**: `server`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Under **Environment**, add:
   | Key | Value |
   |---|---|
   | `SUPABASE_URL` | from step 2 |
   | `SUPABASE_KEY` | the `service_role` key from step 2 |
   | `GEMINI_API_KEY` | from step 3 |
   | `GEMINI_MODEL` | `gemini-2.5-flash` |
5. Click **Create Web Service**. Wait for the first deploy to finish, then
   copy the service URL Render gives you, e.g. `https://luhid-api.onrender.com`.
6. Sanity check it's alive: open `https://luhid-api.onrender.com/api/health`
   in a browser — you should see `{"ok":true, ...}`.

> Render's free tier sleeps the service after inactivity — the first request
> after a while can take 20–30 seconds to wake it back up. That's normal.

---

## 5. Point the frontend at your backend

Open `js/api.js` and change the first line:

```js
const API_BASE = 'https://luhid-api.onrender.com/api'; // ← your Render URL + /api
```

Commit and push that change.

---

## 6. Deploy the frontend on GitHub Pages

1. On GitHub, open the repo → **Settings → Pages**.
2. **Source**: Deploy from a branch → **Branch**: `main`, folder `/ (root)` → **Save**.
3. Wait ~1 minute, then open the URL GitHub shows you
   (`https://<your-username>.github.io/luhid-app/`).

---

## 7. Try it out

- **Farmer portal** → register an animal → get its `LUH-XXXXXX` QR tag → log a
  symptom. Try switching to airplane mode first — the entry queues locally
  and syncs automatically once you're back online.
- **Veterinarian portal** → paste or scan the tag → see the full history.
- **Found an animal? portal** → paste or scan the tag → see the masked owner
  contact → tap "Alert owner" to log a GPS rescue ping.

---

## Local development

**Backend:**
```bash
cd server
npm install
cp .env.example .env   # fill in real values
node server.js         # listens on http://localhost:3000
```

**Frontend:** open `index.html` directly, or serve it (`npx serve .`). Point
`API_BASE` in `js/api.js` at `http://localhost:3000/api` while testing locally.

---

## Notes on the AI guardrails

`server/server.js` sends a strict system prompt with every Gemini request: no
drug names or dosages, no confident diagnosis, always recommend contacting a
vet, and an immediate emergency flag for severe symptoms. Review
`GUARDRAIL_SYSTEM_PROMPT` in that file if you extend this for real-world use
— and have a vet sanity-check the output before relying on it in the field.

## CORS

`server.js` currently allows all origins (`cors()`), so the GitHub Pages
frontend works immediately. Once your frontend domain is final, tighten it:

```js
app.use(cors({ origin: 'https://<your-username>.github.io' }));
```
