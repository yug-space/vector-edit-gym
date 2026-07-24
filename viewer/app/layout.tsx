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
    default: "Vector-Bench · SVG repair benchmark",
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
  { href: "https://arxiv.org/abs/2607.19056", label: "Paper", external: true },
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
          <BrandMark />
        </Link>

        <nav className="site-nav" aria-label="Primary navigation">
          {NAV_LINKS.map((link) =>
            link.external ? (
              <a key={link.href} href={link.href} target="_blank" rel="noreferrer" className="nav-link">
                {link.label}
              </a>
            ) : (
              <Link key={link.href} href={link.href} className="nav-link">
                {link.label}
              </Link>
            ),
          )}
        </nav>

        <div className="site-actions">
          <a href="https://github.com/yug-space/vector-edit-gym" target="_blank" rel="noreferrer" className="icon-button" aria-label="Open Vector-Bench on GitHub" title="GitHub">
            <GithubMark className="h-4 w-4" />
          </a>
        </div>
      </div>
      <nav className="page-shell mobile-nav" aria-label="Mobile navigation">
        {NAV_LINKS.map((link) =>
          link.external ? (
            <a key={link.href} href={link.href} target="_blank" rel="noreferrer" className="nav-link">
              {link.label}
            </a>
          ) : (
            <Link key={link.href} href={link.href} className="nav-link">
              {link.label}
            </Link>
          ),
        )}
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
            <div className="site-mark"><BrandMark /></div>
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
            <a href="https://arxiv.org/abs/2607.19056" target="_blank" rel="noreferrer" className="nav-link">Paper</a>
            <a
              href="https://github.com/yug-space/vector-edit-gym/issues/new"
              target="_blank"
              rel="noreferrer"
              className="bench-button bench-button-brand"
            >
              Submit results
            </a>
          </div>
        </div>

        <div className="footer-bottom">
          <span>Vector-Bench · vecbench.xyz</span>
          <span>Can models surgically edit SVG code?</span>
        </div>
      </div>
    </footer>
  );
}

function BrandMark() {
  return (
    <span className="site-product-name">Vector-<strong>Bench</strong></span>
  );
}
