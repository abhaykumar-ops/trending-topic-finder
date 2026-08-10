import { NextResponse } from "next/server";
import { google } from "googleapis";

// Google Search Console API is free, but requires OAuth (not just an API
// key) because it reads data tied to your verified property. See README
// for the one-time setup to get a refresh token.
export async function GET() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, GSC_SITE_URL } =
    process.env;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN || !GSC_SITE_URL) {
    return NextResponse.json(
      { queries: [], skipped: true, reason: "Search Console not configured — see README" },
      { status: 200 }
    );
  }

  try {
    const oauth2Client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
    oauth2Client.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });

    const searchconsole = google.searchconsole({ version: "v1", auth: oauth2Client });

    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 7);
    const fmt = (d: Date) => d.toISOString().split("T")[0];

    const res = await searchconsole.searchanalytics.query({
      siteUrl: GSC_SITE_URL,
      requestBody: {
        startDate: fmt(start),
        endDate: fmt(end),
        dimensions: ["query"],
        rowLimit: 50,
      },
    });

    const queries = (res.data.rows || []).map((row) => ({
      query: row.keys?.[0] || "",
      clicks: row.clicks,
      impressions: row.impressions,
      position: row.position,
    }));

    return NextResponse.json({ queries });
  } catch (err: any) {
    return NextResponse.json(
      { queries: [], error: "Search Console fetch failed", detail: err.message },
      { status: 200 }
    );
  }
}
