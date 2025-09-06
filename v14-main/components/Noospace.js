import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "@supabase/supabase-js";

const DAILY_LIMIT = 3;
const MAX_CHARS = 240;

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://ljnjdguqjrevhhuwkaxg.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxqbmpkZ3VxanJldmhodXdrYXhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5NzU0NDgsImV4cCI6MjA3MjU1MTQ0OH0._MRu-P-0r7hZ8i-Oh5xnYMaRNMEr1Vzw2tlKocMC6G4";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function Noospace({ guestMode = false }) {
  const [entries, setEntries] = useState([]);
  const [text, setText] = useState("");
  const [symbol, setSymbol] = useState("✶");
  const [tags, setTags] = useState("");
  const [view, setView] = useState("spiral");
  const [filter, setFilter] = useState("");
  const [error, setError] = useState("");
  const [wallet, setWallet] = useState(null);
  const [connected, setConnected] = useState(false);
  const [earning, setEarning] = useState(0);

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

  async function connectPhantom() {
    try {
      if (!window.solana?.isPhantom) {
        setError("Phantom wallet not found. Please install Phantom (https://phantom.app).");
        return;
      }
      const resp = await window.solana.connect();
      setWallet(resp.publicKey.toString());
      setConnected(true);
      setError("");
      setEarning((prev) => prev + 1);
    } catch (err) {
      console.error("Phantom connect error", err);
      setError("Could not connect Phantom.");
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
      setError("Could not fetch entries from Supabase.");
    }
  }

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

  async function addEntry() {
    setError("");
    const trimmed = text.trim();
    const tgs = tags
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 5);
    if (!trimmed) {
      setError("Write a short impulse.");
      return;
    }
    if (trimmed.length > MAX_CHARS) {
      setError("Too long.");
      return;
    }
    if (countToday() >= DAILY_LIMIT) {
      setError("Daily ritual limit reached.");
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
        setError("Could not save entry.");
        return;
      }
      setEntries((prev) => [...prev, ...data]);
      setText("");
      setTags("");
      if (wallet && wallet !== "guest") setEarning((prev) => prev + 1);
    } catch (err) {
      console.error("Insert exception", err);
      setError("Could not save entry.");
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
      setError("Could not star.");
    }
  }

  async function deleteEntry(id) {
    try {
      const { error } = await supabase.from("entries").delete().eq("id", id);
      if (error) throw error;
      setEntries((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error(err);
      setError("Could not delete.");
    }
  }

  function SpiralView({ items }) {
    if (!items || items.length === 0)
      return <div className="muted">The field is quiet — inscribe.</div>;
    const center = { x: 350, y: 300 };
    const radiusStep = 32;
    const angleStep = 0.6;
    return (
      <div className="spiral" style={{ height: "640px", position: "relative" }}>
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
              className="bubble"
              style={{ left: x, top: y }}
            >
              <div className="sym">{it.symbol}</div>
              <div className="txt">{it.text}</div>
              <div className="meta">{(it.tags || []).join(", ")}</div>
              <div className="actions">
                <button onClick={() => starEntry(it.id)}>⭐ {it.stars}</button>
              </div>
            </motion.div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="wrap">
      <header className="topbar">
        <div className="brand">
          <div className="logo">☄️</div>
          <div className="title">Noospace</div>
        </div>
        <div className="controls">
          <div className="btns">
            <button className={view === "spiral" ? "active" : ""} onClick={() => setView("spiral")}>
              Spiral
            </button>
            <button className={view === "scroll" ? "active" : ""} onClick={() => setView("scroll")}>
              Scroll
            </button>
          </div>
          <div className="wallet">
            {!connected && wallet !== "guest" ? (
              <button onClick={connectPhantom} className="connect">
                Connect Phantom
              </button>
            ) : wallet === "guest" ? (
              <div className="connected-banner">Guest Mode — Limited entries</div>
            ) : (
              <div className="connected" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="dot" />{" "}
                <code className="addr">{wallet.slice(0, 6)}…{wallet.slice(-4)}</code>
                <button onClick={disconnectPhantom} className="x">Disconnect</button>
                <div className="connected-banner">Connected — Earning NOO tokens.</div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="main">
        <section className="composer">
          <input value={symbol} onChange={(e) => setSymbol(e.target.value)} maxLength={2} />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="inscribe a brief impulse (≤ 240 chars)"
          />
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="tags (comma separated)"
          />
          <div className="row">
            <div className="hint">Daily left: {Math.max(0, DAILY_LIMIT - countToday())}</div>
            <div className="actions">
              <button onClick={addEntry} className="inscribe">Inscribe</button>
              <button onClick={fetchEntries} className="refresh">Refresh</button>
            </div>
          </div>
          {error && <div className="err">{error}</div>}
        </section>

        <section className="viewer">
          {view === "scroll" ? (
            <div className="list">
              {filtered.map((it) => (
                <div className="item" key={it.id}>
                  <div className="left">
                    <div className="sym2">{it.symbol}</div>
                  </div>
                  <div className="body">
                    <div className="text">{it.text}</div>
                    <div className="tags">
                      {(it.tags || []).map((t) => (
                        <span key={t} className="tag">#{t}</span>
                      ))}
                    </div>
                    <div className="meta">{new Date(it.date).toLocaleString()}</div>
                  </div>
                  <div className="right">
                    <button onClick={() => starEntry(it.id)}>⭐ {it.stars}</button>
                    <button onClick={() => deleteEntry(it.id)} className="del">🗑</button>
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

