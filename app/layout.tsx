import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Wire Desk — Trending Keyword Finder",
  description: "AI-clustered trending searches for news SEO.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Libre+Caslon+Text:ital,wght@0,400;0,700;1,400&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-paper text-ink font-body">{children}</body>
    </html>
  );
}
