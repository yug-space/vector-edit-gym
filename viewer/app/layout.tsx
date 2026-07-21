import type { Metadata } from "next";
import Link from "next/link";
import { Geist_Mono, Instrument_Sans } from "next/font/google";
import { GithubMark } from "@/components/github-mark";
import "./globals.css";

const sans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: {
    default: "Vector-Bench · a thetalab benchmark",
    template: "%s · Vector-Bench",
  },
  description:
    "Vector-Bench is a preservation-aware SVG repair benchmark with tolerant requested edits, strict side-effect checks, and inspectable model outputs.",
};

const NAV_LINKS = [
  { href: "/#leaderboard", label: "Leaderboard" },
  { href: "/tasks", label: "Tasks" },
  { href: "/traces", label: "Traces" },
  { href: "/#team", label: "Team" },
  { href: "/vectoreditgym-paper.pdf", label: "Paper" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="min-h-dvh antialiased">
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}

function SiteHeader() {
  return (
    <header className="site-header">
      <div className="page-shell site-header-row">
        <Link href="/" className="site-mark" aria-label="Vector-Bench home">
          <img className="theta-logo" src="https://www.thetalab.tech/theta-logo.svg" alt="" />
          <span className="site-mark-copy">
            <strong>thetalab</strong>
            <small>Vector-Bench</small>
          </span>
        </Link>

        <nav className="site-nav" aria-label="Primary navigation">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="nav-link">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="site-actions">
          <a href="https://github.com/yug-space/vector-edit-gym" target="_blank" rel="noreferrer" className="icon-button" aria-label="Open Vector-Bench on GitHub" title="GitHub">
            <GithubMark className="h-4 w-4" />
          </a>
        </div>
      </div>
      <nav className="page-shell mobile-nav" aria-label="Mobile navigation">
        {NAV_LINKS.map((l) => <Link key={l.href} href={l.href} className="nav-link">{l.label}</Link>)}
      </nav>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="page-shell footer-shell">
        <div className="footer-top">
          <div className="max-w-2xl">
            <div className="site-mark">
              <img className="theta-logo" src="https://www.thetalab.tech/theta-logo.svg" alt="" />
              <span className="site-mark-copy">
                <strong>thetalab</strong>
                <small>Vector-Bench</small>
              </span>
            </div>
            <p className="section-copy mt-5 max-w-xl">
              Forty naturalistic SVG repairs with hidden structural targets. Models must fix
              visible defects closely enough without changing the rest of the vector program.
            </p>
            <p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">
              By Yug Gupta and Prannay Hebbar.
            </p>
          </div>

          <div className="footer-links">
            <Link href="/tasks" className="nav-link">Tasks</Link>
            <Link href="/traces" className="nav-link">Traces</Link>
            <Link href="/#leaderboard" className="nav-link">Leaderboard</Link>
            <a href="/vectoreditgym-paper.pdf" className="nav-link">Paper</a>
            <a
              href="mailto:yug@thetalab.tech?subject=Vector-Bench%20leaderboard%20submission"
              className="theta-button theta-button-brand"
            >
              Submit results
            </a>
          </div>
        </div>

        <div className="footer-bottom">
          <span>Vector-Bench · thetalab.tech</span>
          <span>Can models surgically edit SVG code?</span>
        </div>
      </div>
    </footer>
  );
}
