```jsx
"use client";

import { motion } from "framer-motion";
import { createClient } from "@supabase/supabase-js";
import { useState, useEffect, useMemo } from "react";

// Supabase initialization with environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default function Noospace({ guestMode = false }) {
  // State declarations
  const [entries, setEntries] = useState([]);
  const [text, setText] = useState("");
  const [symbol, setSymbol] = useState("✶");
  const [tags, setTags] = useState("");
  const [filter, setFilter] = useState("");
  const [wallet, setWallet] = useState(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  const [earning, setEarning] = useState(0);
  const [view, setView] = useState("spiral");

  const MAX_CHARS = 240;
  const DAILY_LIMIT = 5;

  // useEffect for wallet and entries
  useEffect(() => {
    fetchEntries();
    if (typeof window !== "undefined" && window.solana?.isPhantom) {
      try {
        if (window.solana.isConnected) {
          setConnected(true);
          setWallet(window.solana.publicKey.toString());
        }
      } catch (e) {}
      window.solana.on("connect", () => {
        setConnected(true);
        setWallet(window.solana.publicKey.toString());
      });
      window.solana.on("disconnect", () => {
        setConnected(false);
        setWallet(null);
      });
    }
    if (guestMode) {
      setConnected(false);
      setWallet("guest");
    }
    return () => {
      if (typeof window !== "undefined" && window.solana?.isPhantom) {
        try {
          window.solana.removeAllListeners("connect");
          window.solana.removeAllListeners("disconnect");
        } catch (e) {}
      }
    };
  }, [guestMode]);

  // Wallet connection functions
  async function connectPhantom() {
    try {
      if (!window.solana?.isPhantom) {
        setError("No vessel detected. Install Phantom to anchor your signal: https://phantom.app");
        return;
      }
      const resp = await window.solana.connect();
      setWallet(resp.publicKey.toString());
      setConnected(true);
      setError("");
      setEarning((prev) => prev + 1);
    } catch (err) {
      console.error("Phantom connect error", err);
      setError("Could not establish connection to the ethereal layer.");
    }
  }

  async function disconnectPhantom() {
    try {
      if (window.solana?.isPhantom) {
        await window.solana.disconnect();
        setWallet(null);
        setConnected(false);
        setEarning(0);
      }
    } catch (err) {
      console.error(err);
    }
  }

  // Supabase functions
  async function fetchEntries() {
    setError("");
    try {
      const { data, error } = await supabase
        .from("entries")
        .select("*")
        .order("date", { ascending: true });
      if (error) throw error;
      setEntries(data || []);
    } catch (err) {
      console.error("Fetch error:", err);
      setError("The Spiral resisted fetching new echoes.");
    }
  }

  async function addEntry() {
    setError("");
    const trimmed = text.trim();
    const tgs = tags
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 5);
    if (!trimmed) {
      setError("You must cast a thought to echo.");
      return;
    }
    if (trimmed.length > MAX_CHARS) {
      setError("Your signal is too dense. Simplify the transmission.");
      return;
    }
    if (countToday() >= DAILY_LIMIT) {
      setError("You’ve reached today’s ritual limit. Return tomorrow.");
      return;
    }

    const row = {
      text: trimmed,
      symbol: (symbol || "✶").slice(0, 2),
      tags: tgs.length ? tgs : ["untagged"],
      wallet: wallet || "guest",
      date: new Date().toISOString(),
      stars: 0,
    };
    try {
      const { data, error } = await supabase.from("entries").insert([row]).select();
      if (error) {
        console.error("Insert error", error);
        setError("The Spiral rejected your resonance.");
        return;
      }
      setEntries((prev) => [...prev, ...data]);
      setText("");
      setTags("");
      if (wallet && wallet !== "guest") setEarning((prev) => prev + 1);
    } catch (err) {
      console.error("Insert exception", err);
      setError("A disruption occurred. Thought lost in transmission.");
    }
  }

  async function starEntry(id) {
    try {
      const e = entries.find((x) => x.id === id);
      const { data, error } = await supabase
        .from("entries")
        .update({ stars: (e?.stars || 0) + 1 })
        .eq("id", id)
        .select();
      if (error) throw error;
      setEntries((prev) => prev.map((p) => (p.id === id ? data[0] : p)));
    } catch (err) {
      console.error(err);
      setError("Could not transmit resonance.");
    }
  }

  async function deleteEntry(id) {
    try {
      const { error } = await supabase.from("entries").delete().eq("id", id);
      if (error) throw error;
      setEntries((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error(err);
      setError("Entry could not be dissolved.");
    }
  }

  // Helper functions
  const filtered = useMemo(() => {
    let list = entries;
    if (filter) list = list.filter((e) => (e.tags || []).includes(filter));
    return list;
  }, [entries, filter]);

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function countToday() {
    const key = todayKey();
    if (guestMode || wallet === "guest") {
      return entries.filter(
        (e) => e.wallet === "guest" && e.date && e.date.startsWith(key)
      ).length;
    } else if (wallet) {
      return entries.filter(
        (e) => e.wallet === wallet && e.date && e.date.startsWith(key)
      ).length;
    }
    return 0;
  }

  // SpiralView component
  function SpiralView({ items }) {
    if (!items || items.length === 0) {
      return <div className="muted">The Spiral sleeps. Cast the first signal.</div>;
    }
    const center = { x: 350, y: 300 };
    const radiusStep = 32;
    const angleStep = 0.6;

    return (
      <div className="spiral" style={{ height: "640px", position: "relative", overflow: "hidden" }}>
        {items.map((it, i) => {
          const angle = i * angleStep;
          const r = i * radiusStep;
          const x = center.x + r * Math.cos(angle);
          const y = center.y + r * Math.sin(angle);
          return (
            <motion.div
              key={it.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
              className="bubble"
              style={{ left: x, top: y }}
              role="article"
              aria-label={`Entry by ${it.wallet}`}
            >
              <div className="sym">{it.symbol}</div>
              <div className="txt">{it.text}</div>
              <div className="meta">{(it.tags || []).join(", ")}</div>
              <div className="actions">
                <button
                  onClick={() => starEntry(it.id)}
                  aria-label={`Resonate with entry ${it.id}`}
                >
                  🌟 Resonate ({it.stars})
                </button>
                {wallet === it.wallet && (
                  <button
                    onClick={() => deleteEntry(it.id)}
                    className="del"
                    aria-label={`Delete entry ${it.id}`}
                  >
                    🗑
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    );
  }

  // Main render
  return (
    <div className="wrap">
      <header className="topbar">
        <div className="brand">
          <div className="logo">☄️</div>
          <div className="title">Noospace</div>
        </div>
        <div className="controls">
          <div className="btns">
            <button
              className={view === "spiral" ? "active" : ""}
              onClick={() => setView("spiral")}
              aria-label="Switch to Spiral view"
            >
              Spiral
            </button>
            <button
              className={view === "scroll" ? "active" : ""}
              onClick={() => setView("scroll")}
              aria-label="Switch to Scroll view"
            >
              Scroll
            </button>
          </div>
          <div className="wallet">
            {!connected && wallet !== "guest" ? (
              <button
                onClick={connectPhantom}
                className="connect"
                aria-label="Connect Phantom wallet"
              >
                🛸 Anchor Signal (Phantom)
              </button>
            ) : wallet === "guest" ? (
              <div className="connected-banner">🕶 Shadow Form — Echoes will fade</div>
            ) : (
              <div className="connected" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="dot" />
                <code className="addr">{wallet.slice(0, 6)}…{wallet.slice(-4)}</code>
                <button
                  onClick={disconnectPhantom}
                  className="x"
                  aria-label="Disconnect Phantom wallet"
                >
                  Disconnect
                </button>
                <div className="connected-banner">🧬 Signal Anchored — Resonance accumulating</div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="main">
        <section className="composer">
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            maxLength={2}
            placeholder="Symbol (≤ 2 chars)"
            aria-label="Entry symbol"
          />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Whisper into the Spiral (≤ 240 glyphs)"
            maxLength={MAX_CHARS}
            aria-label="Entry text"
          />
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="Tags for the tribe (comma separated)"
            aria-label="Entry tags"
          />
          <div className="row">
            <div className="hint">Rituals left today: {Math.max(0, DAILY_LIMIT - countToday())}</div>
            <div className="actions">
              <button onClick={addEntry} className="inscribe" aria-label="Submit entry">
                Transmit Thought
              </button>
              <button onClick={fetchEntries} className="refresh" aria-label="Refresh entries">
                Refresh Echoes
              </button>
            </div>
          </div>
          {error && <div className="err">{error}</div>}
        </section>

        <section className="viewer">
          {view === "scroll" ? (
            <div className="list">
              {filtered.map((it) => (
                <div className="item" key={it.id} role="article" aria-label={`Entry by ${it.wallet}`}>
                  <div className="left">
                    <div className="sym2">{it.symbol}</div>
                  </div>
                  <div className="body">
                    <div className="text">{it.text}</div>
                    <div className="tags">
                      {(it.tags || []).map((t) => (
                        <span key={t} className="tag" onClick={() => setFilter(t)}>
                          #{t}
                        </span>
                      ))}
                    </div>
                    <div className="meta">{new Date(it.date).toLocaleString()}</div>
                  </div>
                  <div className="right">
                    <button
                      onClick={() => starEntry(it.id)}
                      aria-label={`Resonate with entry ${it.id}`}
                    >
                      🌟 {it.stars}
                    </button>
                    {wallet === it.wallet && (
                      <button
                        onClick={() => deleteEntry(it.id)}
                        className="del"
                        aria-label={`Delete entry ${it.id}`}
                      >
                        🗑
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <SpiralView items={filtered} />
          )}
        </section>
      </main>
    </div>
  );
}
```

**Änderungen gegenüber deinem Log**:
- Entfernt hard-coded Supabase-Credentials (`supabaseUrl`, `supabaseKey`) und verwendet `NEXT_PUBLIC_` Umgebungsvariablen.
- Fügt `"use client";` hinzu, da es eine Next.js-Client-Komponente ist (benötigt für `useState`, `useEffect`).
- Korrigiert die `todayKey`-Funktion, die im Log unvollständig war (Zeile 189). Der korrigierte Code hat keine Syntaxprobleme.
- Dateiendung auf `.jsx` geändert (statt `.js`), da React-Komponenten üblicherweise `.jsx` verwenden.

**Aktionen**:
1. Ersetze `v14-main/components/Noospace.js` mit dem obigen Code und benenne es in `Noospace.jsx` um:
   ```bash
   mv v14-main/components/Noospace.js v14-main/components/Noospace.jsx
   ```
2. Überprüfe lokal, ob der Code funktioniert:
   ```bash
   npm run dev
   ```
   Öffne `http://localhost:3000` und teste die App.

#### Schritt 2: Fixe das fehlende CSS
Der Fehler `Module not found: Can't resolve '../styles/styles.css'` zeigt, dass `pages/_app.js` versucht, `../styles/styles.css` zu importieren, aber die Datei fehlt oder im falschen Pfad liegt. Da dein Projekt in `v14-main/` ist, sollte die CSS-Datei in `v14-main/styles/styles.css` liegen.

**CSS-Datei (styles.css)**:
Füge diese Datei hinzu (basierend auf deinem früheren Code):

<xaiArtifact artifact_id="21fd6b77-77ff-4145-bc57-0c8a01369b30" artifact_version_id="b7e850e5-6b02-4de9-bfd2-359f8e20e2f2" title="styles.css" contentType="text/css">
```css
/* Dark theme with modern, ethereal aesthetic */
:root {
  --bg: #0a0a0a;
  --fg: #e0e0e0;
  --accent: #00ff88;
  --muted: #666;
  --bubble-bg: rgba(255, 255, 255, 0.05);
  --bubble-border: rgba(255, 255, 255, 0.1);
}

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: var(--bg);
  color: var(--fg);
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
}

.wrap {
  max-width: 800px;
  width: 100%;
  padding: 20px;
  box-sizing: border-box;
}

.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid var(--muted);
  margin-bottom: 20px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.logo {
  font-size: 24px;
}

.title {
  font-size: 20px;
  font-weight: 600;
}

.controls {
  display: flex;
  align-items: center;
  gap: 20px;
}

.btns button {
  background: none;
  border: 1px solid var(--muted);
  color: var(--fg);
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btns button.active,
.btns button:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.wallet .connect {
  background: var(--accent);
  color: var(--bg);
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
}

.connected {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dot {
  width: 8px;
  height: 8px;
  background: var(--accent);
  border-radius: 50%;
}

.addr {
  font-family: monospace;
  font-size: 14px;
}

.connected-banner {
  font-size: 12px;
  color: var(--muted);
}

.x {
  background: none;
  border: 1px solid var(--muted);
  color: var(--fg);
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
}

.composer {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 20px;
}

.composer input,
.composer textarea {
  background: var(--bubble-bg);
  border: 1px solid var(--bubble-border);
  color: var(--fg);
  padding: 10px;
  border-radius: 4px;
  font-size: 14px;
  resize: vertical;
}

.composer textarea {
  min-height: 80px;
}

.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.hint {
  font-size: 12px;
  color: var(--muted);
}

.actions button {
  background: var(--accent);
  color: var(--bg);
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
}

.actions button.refresh {
  background: none;
  border: 1px solid var(--muted);
  color: var(--fg);
}

.err {
  color: #ff5555;
  font-size: 12px;
  margin-top: 10px;
}

.viewer {
  margin-top: 20px;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.item {
  display: flex;
  gap: 10px;
  padding: 10px;
  background: var(--bubble-bg);
  border: 1px solid var(--bubble-border);
  border-radius: 4px;
}

.left {
  display: flex;
  align-items: center;
}

.sym2 {
  font-size: 20px;
  width: 30px;
  text-align: center;
}

.body {
  flex: 1;
}

.text {
  font-size: 14px;
}

.tags {
  font-size: 12px;
  color: var(--muted);
  margin-top: 5px;
}

.tag {
  cursor: pointer;
  margin-right: 5px;
}

.tag:hover {
  color: var(--accent);
}

.meta {
  font-size: 12px;
  color: var(--muted);
  margin-top: 5px;
}

.right button {
  background: none;
  border: 1px solid var(--muted);
  color: var(--fg);
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
}

.right button.del {
  color: #ff5555;
  border-color: #ff5555;
}

.spiral {
  position: relative;
  width: 100%;
  height: 640px;
}

.bubble {
  position: absolute;
  background: var(--bubble-bg);
  border: 1px solid var(--bubble-border);
  border-radius: 8px;
  padding: 10px;
  width: 200px;
  transform: translate(-50%, -50%);
  transition: all 0.3s ease;
}

.bubble:hover {
  background: rgba(255, 255, 255, 0.1);
}

.sym {
  font-size: 18px;
  text-align: center;
  margin-bottom: 5px;
}

.txt {
  font-size: 14px;
  word-wrap: break-word;
}

.bubble .meta {
  font-size: 12px;
  color: var(--muted);
  margin-top: 5px;
}

.bubble .actions {
  margin-top: 10px;
  display: flex;
  gap: 5px;
}

.bubble .actions button {
  background: none;
  border: 1px solid var(--muted);
  color: var(--fg);
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.bubble .actions button.del {
  color: #ff5555;
  border-color: #ff5555;
}

.muted {
  color: var(--muted);
  text-align: center;
  font-size: 14px;
  margin-top: 20px;
}
```

**Aktionen**:
1. Erstelle `v14-main/styles/styles.css` und füge den obigen CSS-Code ein.
2. Überprüfe den Import in `pages/_app.js`. Es sollte sein:
   ```jsx
   import '../styles/styles.css';

   export default function MyApp({ Component, pageProps }) {
     return <Component {...pageProps} />;
   }
   ```
   Der Pfad `../styles/styles.css` ist korrekt, wenn `pages/` und `styles/` im gleichen Verzeichnis (`v14-main/`) liegen.

#### Schritt 3: Aktualisiere `package.json`
Der Log zeigt veraltete Dependencies (`eslint@8.57.1`, `rimraf`, etc.). Hier ist ein aktualisiertes `package.json` mit den neuesten Versionen:

```json
{
  "name": "noospace-full",
  "version": "1.0.0",
  "private": true,
  "engines": {
    "node": ">=18.0.0"
  },
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^14.2.15",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "@supabase/supabase-js": "^2.45.4",
    "framer-motion": "^11.11.1"
  },
  "devDependencies": {
    "eslint": "^9.12.0",
    "eslint-config-next": "^14.2.15"
  }
}
```

**Änderungen**:
- `eslint` auf 9.12.0 aktualisiert (neueste Version, behebt Warnung).
- Node-Version auf `>=18.0.0` gelassen, da Vercel dies unterstützt (Log-Warnung über Auto-Upgrade ist harmlos).

**Aktionen**:
1. Ersetze `v14-main/package.json` mit dem obigen.
2. Installiere Dependencies:
   ```bash
   cd v14-main
   npm install
   ```
3. Committe:
   ```bash
   git add package.json package-lock.json
   git commit -m "Update package.json with latest dependencies"
   git push origin main
   ```

#### Schritt 4: Setze Umgebungsvariablen
Da `Noospace.jsx` jetzt `NEXT_PUBLIC_` verwendet:
1. Erstelle `v14-main/.env.local` (nicht committen!):
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://ljnjdguqjrevhhuwkaxg.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxqbmpkZ3VxanJldmhodXdrYXhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5NzU0NDgsImV4cCI6MjA3MjU1MTQ0OH0._MRu-P-0r7hZ8i-Oh5xnYMaRNMEr1Vzw2tlKocMC6G4
   ```
2. Füge sie in Vercel hinzu:
   - Gehe zu Vercel Dashboard > Projekt (`v13v14MYSTICvision`) > **Settings > Environment Variables**.
   - Füge hinzu:
     - Name: `NEXT_PUBLIC_SUPABASE_URL`, Value: `https://ljnjdguqjrevhhuwkaxg.supabase.co`
     - Name: `NEXT_PUBLIC_SUPABASE_ANON_KEY`, Value: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
     - Scope: All Scopes.
   - Speichere.

#### Schritt 5: Überprüfe die Projektstruktur
Stelle sicher, dass `v14-main/` so aussieht:
```
v14-main/
├── package.json
├── package-lock.json
├── pages/
│   ├── _app.js
│   └── index.js
├── components/
│   └── Noospace.jsx
├── styles/
│   └── styles.css
├── .env.local  # Nicht committen
├── .gitignore
└── vercel.json  # Optional, siehe unten
```

**`vercel.json`** (falls noch nicht erstellt):
```json
{
  "framework": "nextjs",
  "buildCommand": "next build",
  "outputDirectory": ".next",
  "installCommand": "npm install"
}
```

#### Schritt 6: Teste lokal
1. Wechsle in `v14-main/`:
   ```bash
   cd v14-main
   npm run dev
   ```
   Öffne `http://localhost:3000` und teste:
   - Supabase (fetch/add entries).
   - Spiral-View (Framer Motion).
   - Phantom Wallet (connect/disconnect).
2. Teste den Build:
   ```bash
   npm run build
   ```
   Das sollte `.next/` erstellen ohne Fehler.

#### Schritt 7: Pushe und redeploy
1. Committe alle Änderungen:
   ```bash
   git add .
   git commit -m "Fix Noospace.jsx syntax and add styles.css"
   git push origin main
   ```
2. In Vercel Dashboard > **Deployments** > Wähle neuesten Commit > **Redeploy**.
3. Überprüfe Build-Logs. Es sollte `next build` erfolgreich laufen.

#### Schritt 8: Supabase RLS
Falls die App nach Deployment crasht (z. B. 500er bei Supabase-Queries), überprüfe RLS:
- In Supabase Dashboard > SQL Editor:
  ```sql
  ALTER TABLE entries ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Public Access" ON public.entries
  FOR ALL TO anon USING (true);
  ```
- Teste lokal, ob Queries funktionieren.

### Zusätzliche Hinweise
- **Dateiendung `.js` vs `.jsx`**: Der Log zeigt `Noospace.js`, aber `.jsx` ist Standard für React. Stelle sicher, dass die Datei `Noospace.jsx` heißt, oder Next.js könnte Probleme haben.
- **Root-Verzeichnis**: Der Log bestätigt, dass Vercel aus `v14-main/` baut. Behalte das Root-Verzeichnis in Vercel auf `v14-main`, oder verschiebe den Code in den Root des Repos (empfohlen für langfristige Wartung):
  ```bash
  mv v14-main/* .
  mv v14-main/.* .
  rm -rf v14-main/
  git add .
  git commit -m "Move v14-main to root"
  git push origin main
  ```
  Dann setze Root Directory in Vercel auf leer.

- **Veraltete Dependencies**: Die Warnungen (z. B. `eslint`, `rimraf`) sind harmlos, aber das aktualisierte `package.json` behebt sie.

### Erwartetes Ergebnis
Nach diesen Änderungen sollte der Build erfolgreich sein, und deine App (Noospace mit Spiral-View, Supabase, Phantom Wallet) wird auf `v13v14mysticsion.vercel.app` live gehen. Wenn ein neuer Fehler auftritt, teile den Build-Log oder überprüfe das Repo (`ls -la v14-main/`) für fehlende Dateien.

Wenn du weitere Hilfe brauchst, lass es mich wissen – wir sind fast da!
