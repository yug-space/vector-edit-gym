import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";
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
    default: "Vector-Bench · a Theta Labs benchmark",
    template: "%s · Vector-Bench",
  },
  description:
    "Vector-Bench is a preservation-aware SVG repair benchmark with tolerant requested edits, strict side-effect checks, and inspectable model outputs.",
};

const NAV_LINKS = [
  { href: "/tasks", label: "Tasks" },
  { href: "/traces", label: "Traces" },
  { href: "/#leaderboard", label: "Leaderboard" },
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
    <header className="sticky top-0 z-40 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/82 backdrop-blur-xl">
      <div className="page-shell flex items-center justify-between gap-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <span className="brand-square">
            <span>θ</span>
          </span>
          <span className="flex flex-col leading-none">
            <span className="theta-wordmark">
              <span>vectoredit</span>
              <span>gym</span>
            </span>
            <span className="mono-label mt-1">theta labs · svg benchmark</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="nav-link">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <a href="/vectoreditgym-paper.pdf" className="theta-button" aria-label="Read the paper">
            <FileText className="h-4 w-4" />
            <span className="hidden lg:inline">Paper</span>
          </a>
          <a
            href="https://github.com/yug-space/vector-edit-gym"
            target="_blank"
            rel="noreferrer"
            className="theta-button"
          >
            <GithubMark className="h-4 w-4" />
            <span className="hidden sm:inline">GitHub</span>
          </a>
          <Link href="/tasks" className="theta-button theta-button-primary hidden sm:inline-flex">
            Browse tasks
          </Link>
        </div>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="screen-line-before mt-20">
      <div className="page-shell footer-shell">
        <div className="footer-top">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3">
              <span className="brand-square">
                <span>θ</span>
              </span>
              <span className="flex flex-col leading-none">
                <span className="theta-wordmark">
                  <span>vectoredit</span>
                  <span>gym</span>
                </span>
                <span className="mono-label mt-1">a theta labs benchmark</span>
              </span>
            </div>
            <p className="section-copy mt-5 max-w-xl">
              Forty naturalistic SVG repairs with hidden structural targets. Models must fix
              visible defects closely enough without changing the rest of the vector program.
            </p>
            <p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">
              Yug Aditi Gupta and Prannay Hebbar, equal contribution.
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
          <span>vectoreditgym · theta labs</span>
          <span>a benchmark for surgical svg editing</span>
        </div>
      </div>
    </footer>
  );
}
