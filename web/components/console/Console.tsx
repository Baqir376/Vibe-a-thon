"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { LogoMark, Wordmark } from "@/components/Logo";
import { ask, listReplays, prewarm, type ReplayMeta } from "@/lib/api";
import { useConsole } from "@/lib/useConsole";
import { InkField } from "@/components/InkField";
import { LaunchReveal } from "@/components/fx/Launch";
import { Ambient } from "./Ambient";
import { DoneStamp, MapNote } from "./Flourish";
import { Sidebar } from "./Sidebar";
import { NeuralMap } from "./NeuralMap";
import { Onboarding } from "./Onboarding";
import { ApprovalSheet, LiveCounter, Stats, StatusIsland, Toasts } from "./Panels";

const FALLBACK: ReplayMeta[] = [
  { id: "delayed", title: "Delayed shipment impact", blurb: "Orders + tickets + roster in one question.",
    question: "The insulin shipment to Pune is delayed. Which customers are affected, have they raised support tickets, and who is on call to handle it?" },
  { id: "refund", title: "Process a refund", blurb: "Verified fused tool, human approval.",
    question: "Process a refund for ticket TKT-9002 (order ORD-5003, order value 35390 INR): the delivery was 4 days late." },
  { id: "live-update", title: "Live update (Drift Sentinel)", blurb: "A new endpoint appears and gets used.",
    question: "Is there a revised delivery ETA for the delayed Pune insulin shipment SHP-1042? Answer in 2 lines." },
];

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
    <div className="relative flex h-screen flex-col gap-3 overflow-hidden p-3">
      <Ambient />
      <LaunchReveal />
      <motion.header initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5 }}
        className="glass-pro relative z-30 flex items-center justify-between rounded-2xl px-5 py-2.5">
        <Link href="/" className="flex items-center gap-2.5" data-cursor="Home"><LogoMark size={24} /><span className="leading-tight"><Wordmark className="block text-[16px]" /><span className="block font-mono text-[9.5px] tracking-[0.25em] text-muted uppercase">Synapse workspace</span></span></Link>
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

      <div className="relative z-10 grid min-h-0 flex-1 gap-3 lg:grid-cols-[1fr_420px]">
        <motion.section initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.15 }}
          className="glass-pro relative min-h-0 overflow-hidden rounded-[22px]">
          <div className="dot-grid pointer-events-none absolute inset-0 opacity-60" />
          <InkField tone="night" className="pointer-events-none opacity-70" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(232,85,31,.12),transparent_65%)]" />
          <div className="absolute inset-0 p-4"><NeuralMap s={s} onPulseDone={onPulseDone} /></div>
          <MapNote show={!s.question && !busy && s.systems.length > 0} />
          <DoneStamp show={s.phase === "done"} tools={s.live.length} peak={s.stats.peak} />
          <p aria-hidden className="pointer-events-none absolute right-6 bottom-12 font-mono text-[10.5px] tracking-wider text-muted/80"><b className="text-text/70">Fig. 3</b> · the agent&apos;s nervous system, live</p>
          <div className="pointer-events-none absolute top-5 left-6"><LiveCounter live={s.live.length} total={s.caps.length || 0} /></div>
          <div className="absolute bottom-5 left-6"><Stats stats={s.stats} /></div>
          <div className="absolute right-5 bottom-5 flex flex-wrap justify-end gap-4 text-[11px] text-muted">
            {[["#7d95ff", "read"], ["#f2c14e", "writes"], ["#8fd18a", "grafted"], ["#5a5043", "dormant"], ["#ffd166", "new"], ["#ff7a45", "fused"]].map(([col, l]) => (
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
          className="glass-pro flex min-h-0 flex-col gap-3 overflow-y-auto rounded-[22px] p-4">
          <Sidebar s={s} mode={mode} busy={busy} replaying={c.replaying} scenarios={scenarios} run={run} q={q} setQ={setQ} err={err}
            serverUp={c.serverUp} warming={warming} onPrewarm={async () => { setWarming(true); await prewarm(); setWarming(false); }} />
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
          className="fixed bottom-8 left-1/2 z-50 w-[420px] -translate-x-1/2 rounded-3xl border border-write/40 bg-panel/95 p-5 shadow-[0_0_80px_rgba(242,193,78,.2)] backdrop-blur">
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
