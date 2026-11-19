"use client";

const ITEMS = ["synapse build --auto --endpoints", "graft", "6 parallel calls", "prune", "synapse build --discover", "new endpoint in 3.3 s",
  "synapse build --custom -q", "verified in a sandbox", "4 of 39 tools", "every write needs a human"];

/** Carbon band with the real commands the agent runs, scrolling like a ticker tape. */
export function Marquee() {
  const row = [...ITEMS, ...ITEMS];
  return (
    <div className="relative -rotate-1 overflow-hidden border-y-[1.5px] border-carbon bg-carbon py-3 text-paper">
      <div className="marquee flex w-max gap-10 whitespace-nowrap font-mono text-sm">
        {row.map((t, i) => (
          <span key={i} className="flex items-center gap-10">{t}<span className="text-signal">✺</span></span>
        ))}
      </div>
    </div>
  );
}
