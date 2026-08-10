# Wire Desk — Trending Keyword Finder

A free tool that pulls trending topics from multiple sources, groups them
into topics, and flags ones your site doesn't rank for yet.

## Sources, and what each needs

| Source | Cost | Setup |
|---|---|---|
| Google Trends (daily) | Free | None |
| Google News + 8 Indian outlets (TOI, NDTV, Moneycontrol, Economic Times, Hindustan Times, The Hindu, India Today, News18) | Free | None |
| Reddit (r/india, r/worldnews) | Free | None |
| YouTube trending | Free (within daily quota) | 1 API key |
| Google Search Console | Free | One-time OAuth setup |
| Twitter/X trending | **Not available** | X removed free access to trends data — there's no free way to include this. The app shows this clearly instead of hiding it. |

Toggle any source off in the app if you don't want to set it up.

## Run it locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. Google Trends, Google News, outlet RSS, and
Reddit work immediately with zero setup. YouTube and Search Console are
optional — the app just skips them with a note until you add credentials.

## Optional: add YouTube trending

1. Go to https://console.cloud.google.com → create a project (free).
2. Enable **YouTube Data API v3** (Library → search for it → Enable).
3. Create an API key: Credentials → Create Credentials → API key.
4. Add it to a `.env.local` file:
   ```
   YOUTUBE_API_KEY=your-key-here
   ```
5. Restart `npm run dev`.

The free daily quota (10,000 units) is far more than this app uses.

## Optional: add your Search Console data

This step takes the most setup because Search Console data is tied to your
verified property, so it needs a one-time authorization, not just a key.

1. In the same Google Cloud project, enable **Google Search Console API**.
2. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
   - Application type: **Desktop app**
   - Download the client ID and client secret.
3. Get a refresh token once, using Google's OAuth Playground:
   - Go to https://developers.google.com/oauthplayground
   - Click the gear icon (top right) → check **"Use your own OAuth credentials"**
     → paste your client ID and secret.
   - In the left panel, find **Search Console API v1** → select the
     `webmasters.readonly` scope → Authorize → sign in with the Google
     account that owns your Search Console property.
   - Click **Exchange authorization code for tokens** → copy the
     **refresh token** shown.
4. Add all four values to `.env.local`:
   ```
   GOOGLE_CLIENT_ID=your-client-id
   GOOGLE_CLIENT_SECRET=your-client-secret
   GOOGLE_REFRESH_TOKEN=your-refresh-token
   GSC_SITE_URL=https://www.yoursite.com/
   ```
   `GSC_SITE_URL` must match exactly how the property is listed in Search
   Console (including the trailing slash, or `sc-domain:yoursite.com` for a
   domain property).
5. Restart `npm run dev`.

Once connected, "Content Gaps" cards show trending topics that share no
words with any query your site currently ranks for — i.e. things worth
writing about that you haven't covered.

## Deploy to Vercel

1. Push this folder to a GitHub repo.
2. Import it at https://vercel.com/new.
3. In **Settings → Environment Variables**, add `YOUTUBE_API_KEY` and/or
   the four Search Console variables above, if you set them up.
4. Deploy. Vercel's free Hobby plan covers this app.

## Two views

The app opens in **Newsroom view** by default — a lighter dashboard with
stat cards (active topics, rising-now count, active sources, update
cadence), a search + category + time-window filter row, and results shown
as a compact "Priority Queue" list.

Click **"Switch to Wire view"** (top right) for the original dark
teletype-style layout with the scrolling ticker and dispatch cards. Both
views share the same data and controls — switching is purely cosmetic.

## Live data: volume, "trending since", and cities

Google's RSS feed only gives a title — no volume, no timing. To get those,
the app now calls Google's internal JSON endpoint behind the
**trends.google.com/trending** page instead. This gives:

- **Volume** — Google's rounded search-volume estimate (e.g. "50K+")
- **Trending since** — how long ago the linked news article was published
  (e.g. "3 hours ago"), the closest free signal to "how long has this
  been trending"
- **Region picker** — Google Trends breaks daily trends down to
  **state/UT level** (Delhi, Maharashtra, etc.), not individual cities.
  The region dropdown lets you view a specific state's trending list.

**On cities specifically:** Google doesn't publish a bulk list of trending
searches per city — only per **state/UT**. What it does offer, per search
term, is an "interest by city" breakdown (the same data behind the
"Interest by region" chart on the public site). Click **"View top cities
for this term"** on any dispatch card to fetch that, for that one topic.

This city lookup and the richer trends data both come from an
**undocumented, unofficial Google endpoint** — not the stable public RSS
feed. That means:
- It can rate-limit or change format without notice.
- It's built to fail quietly: if it breaks, that one card/section just
  shows no data instead of crashing the app.
- If it stops working entirely, the fix is checking
  `app/api/trends/route.ts` and `app/api/trends/city-breakdown/route.ts` —
  the request/response shape is what would need updating.

## How the free clustering works

`app/api/cluster/route.ts` groups items that share enough significant words
(no AI model, no API call — plain code). Tune `SIMILARITY_THRESHOLD` there
if groups feel too loose or too strict. Outlet RSS URLs live in
`lib/rss.ts` — publishers occasionally change these addresses, so if one
stops returning results, search "<outlet name> RSS feed" and update it.
