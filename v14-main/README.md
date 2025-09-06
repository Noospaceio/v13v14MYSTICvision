
Noospace combined v13 (landing) + v8 (app) example
-----------------------------------------------

What's included:
- pages/index.js (landing, mounts Noospace)
- pages/app.js (explicit app route)
- pages/_app.js
- components/Noospace.js (v8 component improved: shows Connected banner + basic NOO earning simulation)
- styles/global.css (original styles with small tweaks)
- package.json (dependencies)

How to run locally:
1. unzip and `cd` into project
2. install: `npm install`
3. run dev: `npm run dev`
4. open http://localhost:3000

Notes:
- This uses Supabase for entries (the same URL & anon key you provided). Keep env vars in .env.local to override.
- "Earning NOO tokens" is a UI simulation. To actually mint or award tokens you'll need a backend / smart contract integration.
- On-chain signing for inscriptions is not implemented here — this project writes entries to Supabase. If you want full Solana on-chain inscriptions, I can add the transaction creation + signing flow (will need RPC endpoint / program details).
