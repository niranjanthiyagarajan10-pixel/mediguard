import Link from "next/link";
import { ShieldPlus, Home } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-[var(--surface-blur)] backdrop-blur-xl">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 font-heading text-lg font-semibold text-accent sm:text-xl"
        >
          <ShieldPlus className="h-6 w-6 shrink-0" />
          MediGuard
        </Link>
        <div className="flex items-center gap-4 text-sm text-muted sm:gap-6">
          <Link href="/" aria-label="Home" className="transition hover:text-text">
            <Home className="h-5 w-5" />
          </Link>
          <Link href="/record" className="transition hover:text-text">
            Record
          </Link>
          <Link href="/history" className="transition hover:text-text">
            History
          </Link>
          <Link href="/reminders" className="transition hover:text-text">
            Reminders
          </Link>
          <Link href="/profile" className="transition hover:text-text">
            Profile
          </Link>
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}
