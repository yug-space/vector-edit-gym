import type { Metadata } from "next";
import Link from "next/link";
import { Geist_Mono, Instrument_Sans } from "next/font/google";
import "./globals.css";

const sans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

function GithubMark(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" {...props}>
      <path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

export const metadata: Metadata = {
  title: {
    default: "VectorEditGym · a Theta Labs benchmark",
    template: "%s · VectorEditGym",
  },
  description:
    "VectorEditGym is a Theta Labs benchmark for surgical SVG icon editing — corrupted vectors plus natural-language fix instructions, scored on exact, structural, and preservation match.",
};

const NAV_LINKS = [
  { href: "/tasks", label: "Tasks" },
  { href: "/#leaderboard", label: "Leaderboard" },
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
              A benchmark for surgical SVG editing. Each task is one corrupted icon plus a
              natural-language fix instruction — models have to repair what is broken without
              touching anything else.
            </p>
          </div>

          <div className="footer-links">
            <Link href="/tasks" className="nav-link">Tasks</Link>
            <Link href="/#leaderboard" className="nav-link">Leaderboard</Link>
            <a
              href="mailto:yug@thetalab.tech?subject=VectorEditGym%20leaderboard%20submission"
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
