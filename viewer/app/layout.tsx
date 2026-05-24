import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import "./globals.css";

function GithubMark(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" {...props}>
      <path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

export const metadata: Metadata = {
  title: "VectorEditGym — a benchmark for SVG icon editing",
  description: "Corrupted SVGs + natural-language fix instructions. Web authoring UI + Python SDK.",
};

const NAV_LINKS = [
  { href: "/tasks", label: "Tasks" },
  { href: "/icons", label: "Icons" },
  { href: "/author", label: "Author" },
  { href: "/#leaderboard", label: "Leaderboard" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))] antialiased">
        <header className="sticky top-0 z-40 border-b bg-[hsl(var(--background))]/80 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <Logo />
              <span>VectorEditGym</span>
            </Link>
            <nav className="hidden items-center gap-1 md:flex">
              {NAV_LINKS.map((l) => (
                <Button key={l.href} asChild variant="ghost" size="sm">
                  <Link href={l.href}>{l.label}</Link>
                </Button>
              ))}
            </nav>
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <a href="https://github.com/yug-space/vector-edit-gym" target="_blank" rel="noreferrer">
                  <GithubMark className="h-4 w-4" />
                  <span className="hidden sm:inline">GitHub</span>
                </a>
              </Button>
            </div>
          </div>
        </header>
        <main>{children}</main>
        <footer className="mt-24 border-t">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-8 text-sm text-[hsl(var(--muted-foreground))] sm:flex-row sm:items-center sm:justify-between">
            <span>VectorEditGym · a benchmark for surgical SVG editing</span>
            <span className="flex items-center gap-3">
              <a href="mailto:theta.computer01@gmail.com?subject=VectorEditGym%20leaderboard%20submission" className="hover:text-[hsl(var(--foreground))]">Submit results</a>
              <span>·</span>
              <a href="https://github.com/yug-space/vector-edit-gym" target="_blank" rel="noreferrer" className="hover:text-[hsl(var(--foreground))]">GitHub</a>
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}

function Logo() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M8 8h4v4" />
      <path d="M16 16l-4-4" />
    </svg>
  );
}
