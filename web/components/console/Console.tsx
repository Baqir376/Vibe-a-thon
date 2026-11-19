"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { LogoMark, Wordmark } from "@/components/Logo";
import { Tilt } from "@/components/fx/Interactions";
import { ask, listReplays, prewarm, type ReplayMeta } from "@/lib/api";
import { useConsole } from "@/lib/useConsole";
import { NeuralMap } from "./NeuralMap";
import { Onboarding } from "./Onboarding";
import { AnswerCard, ApprovalSheet, LiveCounter, Stats, StatusIsland, Timeline, Toasts } from "./Panels";

const FALLBACK: ReplayMeta[] = [
  { id: "delayed", title: "Delayed shipment impact", blurb: "Orders + tickets + roster in one question.",
    question: "The insulin shipment to Pune is delayed. Which customers are affected, have they raised support tickets, and who is on call to handle it?" },
  { id: "refund", title: "Process a refund", blurb: "Verified fused tool, human approval.",
    question: "Process a refund for ticket TKT-9002 (order ORD-5003, order value 35390 INR): the delivery was 4 days late." },
  { id: "live-update", title: "Live update (Drift Sentinel)", blurb: "A new endpoint appears and gets used.",
    question: "Is there a revised delivery ETA for the delayed Pune insulin shipment SHP-1042? Answer in 2 lines." },
];
const ICON: Record<string, string> = { delayed: "⟡", refund: "⧉", "live-update": "◎" };

export function Console() {
  const c = useConsole();
  const { s, mode } = c;
  const [scenarios, setScenarios] = useState<ReplayMeta[]>(FALLBACK);
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [warming, setWarming] = useState(false);
  const [onboard, setOnboard] = useState(false);
  const onPulseDone = useCallback((id: number) => c.dropPulse(id), [c]);

  useEffect(() => {
    listReplays().then((r) => { if (r.length) setScenarios(r); });
    let seen = false;
    try { seen = localStorage.getItem("synapto-onboarded") === "1"; } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- first-visit check needs localStorage (client only)
    if (!seen) setOnboard(true);
  }, []);

  // In replay mode, show the company's systems on the map straight away.
  useEffect(() => {
    if (mode === "replay" && !s.systems.length) c.primeReplay();
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const closeOnboard = () => { setOnboard(false); try { localStorage.setItem("synapto-onboarded", "1"); } catch { /* ignore */ } };
  const busy = s.busy || !!c.replaying;

  const run = async (sc: ReplayMeta | null, text?: string) => {
    setErr(null);
    if (mode === "replay") {
      if (sc) await c.playReplay(sc.id);
      return;
    }
    const question = (sc?.question ?? text ?? "").trim();
    if (!question || busy) return;
    setQ(question);
    c.local(question);
    const e = await ask(question);
    if (e) setErr(e);
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <motion.header initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5 }}
        className="relative z-30 flex items-center justify-between border-b border-line/70 px-5 py-3">
        <Link href="/" className="flex items-center gap-2" data-cursor="Home"><LogoMark size={24} /><Wordmark className="text-[16px]" /></Link>
        <div className="absolute left-1/2 -translate-x-1/2">
          <StatusIsland phase={s.phase === "offline" && mode === "replay" ? "idle" : s.phase}
            status={s.phase === "offline" && mode === "replay" ? "Replay mode · pick a scenario" : s.phase === "offline" && mode === "live" ? "Agent server offline" : s.status} />
        </div>
        <div className="flex items-center gap-3">
          <ModeSwitch mode={mode} serverUp={c.serverUp} onChange={c.setMode} />
          <button onClick={() => setOnboard(true)} data-cursor="Help" aria-label="How it works"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-sm text-muted transition hover:text-text">?</button>
        </div>
      </motion.header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[1fr_430px]">
        <motion.section initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.15 }}
          className="dot-grid relative min-h-0 overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(124,58,237,.12),transparent_65%)]" />
          <div className="absolute inset-0 p-4"><NeuralMap s={s} onPulseDone={onPulseDone} /></div>
          <div className="pointer-events-none absolute top-5 left-6"><LiveCounter live={s.live.length} total={s.caps.length || 0} /></div>
          <div className="absolute bottom-5 left-6"><Stats stats={s.stats} /></div>
          <div className="absolute right-5 bottom-5 flex flex-wrap justify-end gap-4 text-[11px] text-muted">
            {[["#38d6f5", "read"], ["#ffb547", "writes"], ["#6ef2c0", "grafted"], ["#3a4a6b", "dormant"], ["#ffd84d", "new"], ["#a78bfa", "fused"]].map(([col, l]) => (
              <span key={l} className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: col }} />{l}</span>
            ))}
          </div>
          <AnimatePresence>
            {mode === "live" && !c.serverUp && <OfflineHelp onRetry={async () => { if (await c.refresh()) c.setMode("live"); }} onReplay={() => c.setMode("replay")} />}
          </AnimatePresence>
          {!s.systems.length && mode === "replay" && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="font-mono text-sm text-muted">Pick a scenario on the right to replay a recorded run →</p>
            </div>
          )}
        </motion.section>

        <motion.aside initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.6, delay: 0.25 }}
          className="flex min-h-0 flex-col gap-3 overflow-y-auto border-l border-line/70 bg-night/60 p-4">
          <p className="text-[11px] tracking-[0.2em] text-muted uppercase">{mode === "replay" ? "Recorded scenarios" : "Try a scenario"}</p>
          <div className="grid gap-2">
            {scenarios.map((sc) => (
              <Tilt key={sc.id} max={5}>
                <motion.button whileTap={{ scale: 0.98 }} onClick={() => run(sc)} disabled={busy} data-cursor={mode === "replay" ? "Replay" : "Run"}
                  className={`glass group flex w-full items-start gap-3 rounded-2xl p-3 text-left transition disabled:opacity-50 ${c.replaying === sc.id ? "border-violet/70" : "hover:border-violet/50"}`}>
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet/15 text-violet">{ICON[sc.id] ?? "›"}</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{sc.title}</span>
                    <span className="block text-[12px] leading-snug text-muted">{sc.blurb}</span>
                  </span>
                  <span className="ml-auto self-center font-mono text-[10px] text-muted opacity-0 transition group-hover:opacity-100">{mode === "replay" ? "▶ replay" : "▶ run"}</span>
                </motion.button>
              </Tilt>
            ))}
          </div>

          {mode === "live" ? (
            <div className="glass rounded-2xl p-3">
              <textarea value={q} onChange={(e) => setQ(e.target.value)} rows={2}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) run(null, q); }}
                className="w-full resize-none bg-transparent text-[14px] leading-relaxed text-text outline-none placeholder:text-muted"
                placeholder="…or ask anything about Meridian's operations" />
              <div className="mt-2 flex items-center gap-2">
                <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }} onClick={() => run(null, q)} disabled={busy || !c.serverUp || !q.trim()}
                  className="relative overflow-hidden rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-black disabled:opacity-40">
                  {s.busy ? "Working…" : "Ask agent"}{s.busy && <span className="shimmer absolute inset-0" />}
                </motion.button>
                <button onClick={async () => { setWarming(true); await prewarm(); setWarming(false); }} disabled={warming || !c.serverUp}
                  title="Synapse builds every read-only surface up front; nothing is exposed to the agent"
                  className="rounded-full border border-line px-3 py-1.5 text-xs text-muted transition hover:text-text disabled:opacity-40">{warming ? "Prewarming…" : "Prewarm"}</button>
                <span className="ml-auto font-mono text-[10px] text-muted">Ctrl ⏎</span>
              </div>
              {err && <p className="mt-2 text-xs text-danger">{err}</p>}
            </div>
          ) : (
            <p className="rounded-2xl border border-line/60 px-3 py-2 text-[12px] leading-relaxed text-muted">
              Replays are real recorded runs: same events, same timings (long model waits shortened).
              Start the agent server and switch to <b className="text-text">Live</b> to ask your own questions.
            </p>
          )}

          <AnswerCard s={s} />
          <div className="min-h-[180px] flex-1 overflow-y-auto rounded-2xl border border-line/60 bg-ink/40 p-3">
            <p className="mb-2 text-[11px] tracking-[0.2em] text-muted uppercase">Nervous system</p>
            {s.lines.length ? <Timeline lines={s.lines} /> : <p className="font-mono text-xs text-muted">0 tools live. Run a scenario and watch Synapse grow the connections.</p>}
          </div>
        </motion.aside>
      </div>

      <ApprovalSheet approvals={mode === "live" ? s.approvals : []} />
      <ReplayApproval approvals={mode === "replay" ? s.approvals : []} />
      <Toasts toasts={s.toasts} dismiss={c.dismissToast} />
      <Onboarding open={onboard} onClose={closeOnboard} onDemo={() => run(scenarios[0])} />
    </div>
  );
}

function ModeSwitch({ mode, serverUp, onChange }: { mode: string; serverUp: boolean; onChange: (m: "live" | "replay") => void }) {
  const opts: ["live" | "replay", string][] = [["live", "Live"], ["replay", "Replay"]];
  return (
    <div className="relative flex rounded-full border border-line bg-ink/70 p-0.5 text-xs">
      {opts.map(([m, label]) => (
        <button key={m} onClick={() => onChange(m)} title={m === "live" && !serverUp ? "Agent server offline: start python -m synaptogenesis web" : ""}
          className={`relative z-10 flex items-center gap-1.5 rounded-full px-3 py-1 transition ${mode === m ? "text-black" : "text-muted hover:text-text"}`}>
          {mode === m && <motion.span layoutId="mode-pill" className="absolute inset-0 -z-10 rounded-full bg-white" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
          {m === "live" && <span className={`h-1.5 w-1.5 rounded-full ${serverUp ? "bg-emerald-500" : "bg-danger"}`} />}
          {label}
        </button>
      ))}
    </div>
  );
}

function OfflineHelp({ onRetry, onReplay }: { onRetry: () => void; onReplay: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className="absolute inset-0 z-10 flex items-center justify-center bg-ink/70 p-6 backdrop-blur-sm">
      <div className="glass max-w-md rounded-3xl p-6">
        <p className="font-display text-xl font-semibold">The agent server isn&apos;t running</p>
        <p className="mt-2 text-sm text-muted">Start the legacy services and the agent, then retry. Or watch a recorded run.</p>
        <pre className="mt-4 rounded-xl bg-ink p-3 font-mono text-[12px] leading-relaxed text-text/90">{`python scripts/run_services.py
python -m synaptogenesis web --prewarm`}</pre>
        <div className="mt-5 flex gap-2">
          <button onClick={onRetry} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black">Retry</button>
          <button onClick={onReplay} className="rounded-full border border-line px-4 py-2 text-sm text-muted hover:text-text">Watch a replay</button>
        </div>
      </div>
    </motion.div>
  );
}

/** In replays the approval was granted during recording: show the card, then the click. */
function ReplayApproval({ approvals }: { approvals: { id: number; kind: string; detail: { system?: string; endpoint?: string; endpoints?: string[] } }[] }) {
  const a = approvals[0];
  return (
    <AnimatePresence>
      {a && (
        <motion.div key={a.id} initial={{ opacity: 0, y: 30, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 24 }}
          className="fixed bottom-8 left-1/2 z-50 w-[420px] -translate-x-1/2 rounded-3xl border border-write/40 bg-panel/95 p-5 shadow-[0_0_80px_rgba(255,181,71,.2)] backdrop-blur">
          <p className="font-display font-semibold text-write">{a.kind === "graft" ? "Grant write access?" : "Allow this action?"}</p>
          <p className="mt-1 font-mono text-[12px] text-muted">{a.detail.system} · {a.detail.endpoint ?? (a.detail.endpoints ?? []).join(", ")}</p>
          <div className="mt-4 flex justify-end gap-2 text-sm">
            <span className="rounded-full border border-line px-4 py-1.5 text-muted">Decline</span>
            <motion.span initial={{ scale: 1 }} animate={{ scale: [1, 1, 0.92, 1] }} transition={{ duration: 1.4, times: [0, 0.7, 0.85, 1] }}
              className="rounded-full bg-write px-4 py-1.5 font-semibold text-[#2a1800]">Approve</motion.span>
          </div>
          <p className="mt-3 text-[11px] text-muted">Replay: a human approved this during the recorded run.</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
