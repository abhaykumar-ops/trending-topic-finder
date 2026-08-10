import { NextRequest, NextResponse } from "next/server";

// Free, local keyword clustering — no external API, no cost.
// Groups trending terms from all connected sources by shared significant
// words, and (if Search Console data is present) flags queries you already
// rank for that don't show up in today's clusters — i.e. content gaps.

const STOPWORDS = new Set([
  "the", "a", "an", "of", "in", "on", "for", "to", "and", "vs", "is",
  "at", "by", "with", "from", "2024", "2025", "2026",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  const intersection = new Set([...a].filter((x) => b.has(x)));
  const union = new Set([...a, ...b]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

type InputItem = {
  title: string;
  source?: string;
  url?: string | null;
  approxTraffic?: string | null;
  trendingSince?: string | null;
};

export async function POST(req: NextRequest) {
  const { items, gscQueries } = (await req.json()) as {
    items: InputItem[];
    gscQueries?: { query: string }[];
  };

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "No keywords provided" }, { status: 400 });
  }

  // De-duplicate near-identical titles across sources before clustering.
  const seen = new Set<string>();
  const deduped = items.filter((i) => {
    const key = i.title.toLowerCase().trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const tokenized = deduped.map((i) => ({
    ...i,
    tokens: new Set(tokenize(i.title)),
  }));

  const SIMILARITY_THRESHOLD = 0.15;
  const used = new Array(tokenized.length).fill(false);
  const clusters: {
    topic: string;
    summary: string;
    keywords: string[];
    sources: string[];
    angle: string;
    approxTraffic: string | null;
    trendingSince: string | null;
  }[] = [];

  for (let i = 0; i < tokenized.length; i++) {
    if (used[i]) continue;
    const group = [tokenized[i]];
    used[i] = true;

    for (let j = i + 1; j < tokenized.length; j++) {
      if (used[j]) continue;
      if (jaccard(tokenized[i].tokens, tokenized[j].tokens) >= SIMILARITY_THRESHOLD) {
        group.push(tokenized[j]);
        used[j] = true;
      }
    }

    const sources = Array.from(new Set(group.map((g) => g.source || "Unknown")));
    const approxTraffic = group.find((g) => g.approxTraffic)?.approxTraffic || null;
    const trendingSince = group.find((g) => g.trendingSince)?.trendingSince || null;

    clusters.push({
      topic: group[0].title,
      summary:
        group.length > 1
          ? `${group.length} related items across ${sources.length} source(s), grouped by shared keywords.`
          : `Standalone item from ${sources[0]} — no close matches today.`,
      keywords: group.map((g) => g.title),
      sources,
      approxTraffic,
      trendingSince,
      angle: `Cover an angle connecting: ${group.map((g) => g.title).join(", ")}`,
    });
  }

  clusters.sort((a, b) => b.keywords.length - a.keywords.length);

  // Content gap check: which trending clusters share NO words with any
  // query your site already ranks for in Search Console — i.e. topics
  // moving right now that you likely haven't published anything about yet.
  let clustersWithGaps = clusters.map((c) => ({ ...c, isContentGap: false }));
  if (Array.isArray(gscQueries) && gscQueries.length > 0) {
    const gscTokens = new Set(gscQueries.flatMap((q: any) => tokenize(q.query)));
    clustersWithGaps = clustersWithGaps.map((c) => {
      const clusterTokens = new Set(tokenize(c.keywords.join(" ")));
      const overlap = [...clusterTokens].filter((t) => gscTokens.has(t)).length;
      return { ...c, isContentGap: overlap === 0 };
    });
  }

  return NextResponse.json({ clusters: clustersWithGaps });
}
