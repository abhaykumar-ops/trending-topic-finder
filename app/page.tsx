"use client";

import { useMemo, useState } from "react";
import { INDIA_REGIONS, TIME_WINDOWS } from "@/lib/regions";

type Item = {
  title: string;
  source?: string;
  url?: string | null;
  approxTraffic?: string | null;
  trendingSince?: string | null;
};

type Cluster = {
  topic: string;
  summary: string;
  keywords: string[];
  sources: string[];
  angle: string;
  isContentGap: boolean;
  approxTraffic?: string | null;
  trendingSince?: string | null;
};

const SOURCES = [
  { key: "trends", label: "Google Trends" },
  { key: "news", label: "Google News + 8 IN outlets" },
  { key: "reddit", label: "Reddit" },
  { key: "youtube", label: "YouTube trending" },
  { key: "gsc", label: "Your Search Console" },
] as const;

type SourceKey = (typeof SOURCES)[number]["key"];
type Theme = "light" | "dark";

export default function Page() {
  const [theme, setTheme] = useState<Theme>("light");
  const [region, setRegion] = useState("IN");
  const [timeWindow, setTimeWindow] = useState("now 1-d");
  const [enabled, setEnabled] = useState<Record<SourceKey, boolean>>({
    trends: true,
    news: true,
    reddit: true,
    youtube: true,
    gsc: true,
  });
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cityData, setCityData] = useState<Record<string, { city: string; value: number }[]>>({});
  const [cityLoading, setCityLoading] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<Date | null>(null);

  // Light-theme-only controls
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");

  async function loadCities(topic: string) {
    setCityLoading(topic);
    try {
      const res = await fetch(
        `/api/trends/city-breakdown?q=${encodeURIComponent(topic)}&geo=IN&time=${encodeURIComponent(timeWindow)}`
      );
      const data = await res.json();
      setCityData((prev) => ({ ...prev, [topic]: data.cities || [] }));
    } finally {
      setCityLoading(null);
    }
  }

  function toggleSource(key: SourceKey) {
    setEnabled((e) => ({ ...e, [key]: !e[key] }));
  }

  async function safeJson(url: string, opts?: RequestInit) {
    try {
      const res = await fetch(url, opts);
      return await res.json();
    } catch {
      return null;
    }
  }

  async function runWire() {
    setError(null);
    setClusters([]);
    setNotes([]);
    setLoading(true);

    try {
      const collected: Item[] = [];
      const newNotes: string[] = [];
      let gscQueries: { query: string }[] = [];

      const calls: Promise<void>[] = [];

      if (enabled.trends) {
        calls.push(
          safeJson(`/api/trends?geo=${region}`).then((d) => {
            if (d?.keywords)
              collected.push(
                ...d.keywords.map((k: any) => ({
                  title: k.title,
                  source: "Google Trends",
                  approxTraffic: k.approxTraffic,
                  trendingSince: k.trendingSince,
                }))
              );
          })
        );
      }
      if (enabled.news) {
        calls.push(
          safeJson("/api/news").then((d) => {
            if (d?.items) collected.push(...d.items);
          })
        );
      }
      if (enabled.reddit) {
        calls.push(
          safeJson("/api/reddit").then((d) => {
            if (d?.items) collected.push(...d.items);
          })
        );
      }
      if (enabled.youtube) {
        calls.push(
          safeJson("/api/youtube").then((d) => {
            if (d?.skipped) newNotes.push("YouTube skipped — add YOUTUBE_API_KEY to include it.");
            else if (d?.items) collected.push(...d.items);
          })
        );
      }
      if (enabled.gsc) {
        calls.push(
          safeJson("/api/gsc").then((d) => {
            if (d?.skipped) newNotes.push("Search Console skipped — see README to connect it.");
            else if (d?.queries) gscQueries = d.queries;
          })
        );
      }

      await Promise.all(calls);

      setAllItems(collected);
      setNotes(newNotes);

      if (collected.length === 0) {
        setError("No items came back from the selected sources.");
        setLoading(false);
        return;
      }

      const clusterData = await safeJson("/api/cluster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: collected, gscQueries }),
      });

      if (!clusterData?.clusters) throw new Error("Clustering failed");
      setClusters(clusterData.clusters);
      setLastRun(new Date());
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const gapClusters = clusters.filter((c) => c.isContentGap);
  const risingClusters = clusters.filter((c) => c.approxTraffic);
  const activeSourceCount = Object.values(enabled).filter(Boolean).length;

  const categoryOptions = ["All", ...SOURCES.map((s) => s.label)];

  const filteredClusters = useMemo(() => {
    return clusters.filter((c) => {
      const matchesCategory = category === "All" || c.sources.includes(category);
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        c.topic.toLowerCase().includes(q) ||
        c.keywords.some((k) => k.toLowerCase().includes(q));
      return matchesCategory && matchesSearch;
    });
  }, [clusters, category, search]);

  const sourceToggleBar = (
    <div className="flex flex-wrap gap-2">
      {SOURCES.map((s) => (
        <label
          key={s.key}
          className={`font-mono text-xs border px-3 py-1.5 cursor-pointer select-none ${
            enabled[s.key]
              ? theme === "light"
                ? "border-ink bg-ink text-paper"
                : "border-desk bg-desk text-paper"
              : "border-ink/20 text-fade"
          }`}
        >
          <input
            type="checkbox"
            checked={enabled[s.key]}
            onChange={() => toggleSource(s.key)}
            className="hidden"
          />
          {s.label}
        </label>
      ))}
      <span
        className="font-mono text-xs border border-ink/10 px-3 py-1.5 text-fade/60"
        title="X restricted trends data to paid API tiers — no free option exists"
      >
        Twitter/X — no free API available
      </span>
    </div>
  );

  const cityLookupBlock = (topic: string) => (
    <>
      <button
        onClick={() => loadCities(topic)}
        disabled={cityLoading === topic}
        className="font-mono text-xs border border-ink/20 px-3 py-1.5 hover:border-desk disabled:opacity-50"
      >
        {cityLoading === topic
          ? "Loading cities…"
          : `View top Indian cities (${TIME_WINDOWS.find((t) => t.value === timeWindow)?.label})`}
      </button>
      {cityData[topic] && (
        <div className="flex flex-wrap gap-2 mt-3">
          {cityData[topic].length === 0 ? (
            <span className="font-mono text-xs text-fade">
              No city-level data available for this term right now.
            </span>
          ) : (
            cityData[topic].map((city, k) => (
              <span key={k} className="font-mono text-xs border border-desk/40 px-2 py-1">
                {city.city} ({city.value})
              </span>
            ))
          )}
        </div>
      )}
    </>
  );

  if (theme === "dark") {
    return (
      <main className="min-h-screen">
        <div className="border-b border-ink/20 bg-ink text-paper overflow-hidden whitespace-nowrap py-2">
          <div className="inline-block animate-ticker">
            {allItems.length === 0 ? (
              <span className="font-mono text-sm px-4">
                PRESS RUN WIRE TO PULL TODAY&apos;S TRENDS · NO FEED LOADED YET ·
              </span>
            ) : (
              [...allItems, ...allItems].slice(0, 60).map((k, i) => (
                <span key={i} className="font-mono text-sm px-4">
                  {k.title.toUpperCase()} ·
                </span>
              ))
            )}
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-6 py-12">
          <header className="border-b-2 border-ink pb-4 mb-6 flex items-end justify-between flex-wrap gap-4">
            <div>
              <p className="font-mono text-xs tracking-widest text-wire mb-1">LIVE TREND DESK</p>
              <h1 className="font-headline text-5xl font-bold leading-none">Wire Desk</h1>
              <p className="font-body text-fade text-sm mt-2">
                Trends, news, Reddit and YouTube — clustered into story-ready topics, free.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setTheme("light")}
                className="font-mono text-xs border border-ink/30 px-3 py-2 hover:border-desk"
              >
                Switch to Newsroom view
              </button>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="font-mono text-sm border border-ink/30 bg-paper px-3 py-2"
                title="Google Trends only breaks daily trends down to state/UT level, not individual cities"
              >
                {INDIA_REGIONS.map((r) => (
                  <option key={r.code} value={r.code}>{r.label}</option>
                ))}
              </select>
              <select
                value={timeWindow}
                onChange={(e) => setTimeWindow(e.target.value)}
                className="font-mono text-sm border border-ink/30 bg-paper px-3 py-2"
                title="Applies to the city breakdown lookup — these are the only windows Google Trends exposes"
              >
                {TIME_WINDOWS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <button
                onClick={runWire}
                disabled={loading}
                className="font-mono text-sm bg-wire text-paper px-4 py-2 tracking-wide hover:bg-ink transition-colors disabled:opacity-50"
              >
                {loading ? "PULLING…" : "RUN WIRE"}
              </button>
            </div>
          </header>

          <div className="mb-2">{sourceToggleBar}</div>

          <p className="font-mono text-xs text-fade mb-8">
            The time window applies to Indian city breakdowns (past hour /
            4 hours / 24 hours — the only windows Google Trends exposes; no
            10-min, 30-min or 8-hr option exists anywhere). Other sources
            show current data as-is, not filtered by this window.
          </p>

          {error && (
            <div className="border border-wire text-wire font-mono text-sm px-4 py-3 mb-6">{error}</div>
          )}

          {notes.length > 0 && (
            <div className="border border-desk/40 text-desk font-mono text-xs px-4 py-3 mb-8 space-y-1">
              {notes.map((n, i) => (
                <p key={i}>{n}</p>
              ))}
            </div>
          )}

          {gapClusters.length > 0 && (
            <div className="mb-10">
              <h2 className="font-mono text-xs tracking-widest text-wire mb-3">
                CONTENT GAPS — TRENDING, BUT YOU DON&apos;T RANK FOR IT YET
              </h2>
              <div className="grid gap-2">
                {gapClusters.map((c, i) => (
                  <div key={i} className="border border-wire/40 px-4 py-2 text-sm">
                    {c.topic}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-6">
            {clusters.map((c, i) => (
              <article
                key={i}
                className="border border-ink/20 bg-white/40 px-6 py-5 hover:border-desk transition-colors"
              >
                <div className="flex items-baseline gap-3 mb-2 flex-wrap">
                  <span className="font-mono text-xs text-desk">
                    DISPATCH {String(i + 1).padStart(2, "0")}
                  </span>
                  {c.isContentGap && (
                    <span className="font-mono text-xs bg-wire text-paper px-2 py-0.5">GAP</span>
                  )}
                  <h2 className="font-headline text-2xl font-bold">{c.topic}</h2>
                </div>

                {(c.approxTraffic || c.trendingSince) && (
                  <div className="flex gap-4 mb-2 font-mono text-xs text-desk">
                    {c.approxTraffic && <span>Volume: {c.approxTraffic}</span>}
                    {c.trendingSince && <span>Trending since: {c.trendingSince}</span>}
                  </div>
                )}

                <p className="text-sm text-ink/80 mb-2">{c.summary}</p>
                <p className="font-mono text-xs text-fade mb-3">Sources: {c.sources.join(", ")}</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {c.keywords.slice(0, 8).map((k, j) => (
                    <span key={j} className="font-mono text-xs border border-ink/20 px-2 py-1 text-fade">
                      {k}
                    </span>
                  ))}
                </div>
                <p className="font-body text-sm border-l-2 border-desk pl-3 italic text-desk mb-3">
                  Angle: {c.angle}
                </p>
                {cityLookupBlock(c.topic)}
              </article>
            ))}
          </div>

          {clusters.length === 0 && !loading && (
            <div className="border border-dashed border-ink/20 text-center py-16 text-fade font-mono text-sm">
              Empty desk. Pick your sources and run the wire.
            </div>
          )}
        </div>
      </main>
    );
  }

  // ---------- LIGHT "NEWSROOM" THEME ----------
  return (
    <main className="min-h-screen bg-paper">
      {/* Masthead */}
      <div className="bg-ink text-paper">
        <div className="max-w-5xl mx-auto px-6 pt-6 pb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="border border-wire text-wire font-headline font-bold text-lg w-9 h-9 flex items-center justify-center">
                WD
              </div>
              <div>
                <p className="font-mono text-[10px] tracking-widest text-wire">TREND DESK</p>
                <p className="font-headline text-lg leading-none">Wire Desk — Newsroom Intelligence</p>
              </div>
            </div>
            <button
              onClick={() => setTheme("dark")}
              className="font-mono text-xs border border-paper/30 px-3 py-2 hover:border-wire text-paper/80"
            >
              Switch to Wire view
            </button>
          </div>

          <p className="font-mono text-xs text-wire tracking-widest mb-2">
            {lastRun ? `UPDATED ${lastRun.toLocaleTimeString()}` : "NOT RUN YET"}
          </p>
          <h1 className="font-headline text-4xl font-bold leading-tight mb-2 max-w-2xl">
            What&apos;s trending right now — before the next news cycle.
          </h1>
          <p className="text-paper/70 text-sm max-w-xl mb-6">
            Track topic momentum across Google Trends, News, Reddit and YouTube. Spot copy
            opportunities your site hasn&apos;t covered yet — all free.
          </p>
          <button
            onClick={runWire}
            disabled={loading}
            className="font-mono text-sm bg-wire text-paper px-4 py-2.5 tracking-wide hover:bg-white hover:text-ink transition-colors disabled:opacity-50"
          >
            {loading ? "Refreshing signals…" : "↻ Refresh signals"}
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Filter row */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search topic or keyword"
            className="flex-1 min-w-[200px] font-body text-sm border border-ink/20 px-3 py-2 bg-white"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="font-mono text-sm border border-ink/20 px-3 py-2 bg-white"
          >
            {categoryOptions.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <div className="flex border border-ink/20">
            {TIME_WINDOWS.map((t, i) => (
              <button
                key={t.value}
                onClick={() => setTimeWindow(t.value)}
                title="Applies to the Indian city breakdown lookup on each topic"
                className={`font-mono text-xs px-3 py-2 ${i > 0 ? "border-l border-ink/20" : ""} ${
                  timeWindow === t.value ? "bg-ink text-paper" : "bg-white text-ink hover:bg-ink/5"
                }`}
              >
                {t.label.replace("Past ", "")}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6">{sourceToggleBar}</div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="border-t-2 border-ink px-4 py-3">
            <p className="font-mono text-[11px] tracking-widest text-fade mb-1">ACTIVE TOPICS</p>
            <p className="font-headline text-3xl font-bold">{clusters.length}</p>
            <p className="text-xs text-fade mt-1">From your selected sources</p>
          </div>
          <div className="border-t-2 border-wire px-4 py-3">
            <p className="font-mono text-[11px] tracking-widest text-fade mb-1">RISING NOW</p>
            <p className="font-headline text-3xl font-bold">{risingClusters.length}</p>
            <p className="text-xs text-fade mt-1">Have a Google Trends volume signal</p>
          </div>
          <div className="border-t-2 border-desk px-4 py-3">
            <p className="font-mono text-[11px] tracking-widest text-fade mb-1">SIGNAL SOURCES</p>
            <p className="font-headline text-3xl font-bold">{activeSourceCount}</p>
            <p className="text-xs text-fade mt-1">Currently switched on</p>
          </div>
          <div className="border-t-2 border-ink/40 px-4 py-3">
            <p className="font-mono text-[11px] tracking-widest text-fade mb-1">UPDATE CADENCE</p>
            <p className="font-headline text-3xl font-bold">Manual</p>
            <p className="text-xs text-fade mt-1">Click Refresh signals to pull new data</p>
          </div>
        </div>

        {error && (
          <div className="border border-wire text-wire font-mono text-sm px-4 py-3 mb-6">{error}</div>
        )}

        {notes.length > 0 && (
          <div className="border border-desk/40 text-desk font-mono text-xs px-4 py-3 mb-6 space-y-1">
            {notes.map((n, i) => (
              <p key={i}>{n}</p>
            ))}
          </div>
        )}

        {/* Priority Queue list */}
        <div className="border border-ink/15">
          <div className="flex items-center justify-between border-b border-ink/15 px-4 py-3">
            <div>
              <p className="font-mono text-[11px] tracking-widest text-wire">PRIORITY QUEUE</p>
              <h2 className="font-headline text-xl font-bold">Trending topics &amp; keywords</h2>
            </div>
            <span className="font-mono text-xs text-fade">{filteredClusters.length} results</span>
          </div>

          {filteredClusters.length === 0 && (
            <div className="text-center py-14 text-fade font-mono text-sm">
              {clusters.length === 0
                ? "No data yet — click Refresh signals to pull today's trends."
                : "Nothing matches this search/category filter."}
            </div>
          )}

          <div className="divide-y divide-ink/10">
            {filteredClusters.map((c, i) => (
              <div key={i} className="px-4 py-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-[240px]">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {c.isContentGap && (
                        <span className="font-mono text-[10px] bg-wire text-paper px-2 py-0.5">GAP</span>
                      )}
                      <h3 className="font-headline text-lg font-bold">{c.topic}</h3>
                    </div>
                    <p className="text-sm text-ink/70 mb-1">{c.summary}</p>
                    <p className="font-mono text-xs text-fade">
                      {c.sources.join(" · ")}
                      {c.approxTraffic ? ` · Vol: ${c.approxTraffic}` : ""}
                      {c.trendingSince ? ` · Since: ${c.trendingSince}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-xs text-desk italic max-w-xs">{c.angle}</p>
                  </div>
                </div>
                <details className="mt-2">
                  <summary className="font-mono text-xs text-fade cursor-pointer hover:text-ink">
                    Keywords &amp; city breakdown
                  </summary>
                  <div className="mt-2 flex flex-wrap gap-2 mb-2">
                    {c.keywords.slice(0, 8).map((k, j) => (
                      <span key={j} className="font-mono text-xs border border-ink/20 px-2 py-1 text-fade">
                        {k}
                      </span>
                    ))}
                  </div>
                  {cityLookupBlock(c.topic)}
                </details>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
