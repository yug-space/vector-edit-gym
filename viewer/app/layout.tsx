import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "VectorEditGym",
  description: "Browse SVG editing tasks and the underlying icon catalog.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <div className="topbar-inner">
            <Link href="/" className="brand">VectorEditGym</Link>
            <nav>
              <Link href="/">Tasks</Link>
              <Link href="/icons">Icon catalog</Link>
              <Link href="/author">+ Author task</Link>
            </nav>
          </div>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
