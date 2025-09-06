```jsx
import { motion } from "framer-motion";
import { createClient } from "@supabase/supabase-js";
import { useState, useEffect, useMemo } from "react";

// Supabase initialization with provided URL and key
const supabaseUrl = "https://ljnjdguqjrevhhuwkaxg.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxqbmpkZ3VxanJldmhodXdrYXhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5NzU0NDgsImV4cCI6MjA3MjU1MTQ0OH0._MRu-P-0r7hZ8i-Oh5xnYMaRNMEr1Vzw2tlKocMC6G4";
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
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
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
