import Link from "next/link";
import { ShieldPlus, Home, Mic, History, Bell, UserRound } from "lucide-react";
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
          {/* Home is redundant with the wordmark on phones, so show it on desktop only. */}
          <Link
            href="/"
            aria-label="Home"
            className="hidden transition hover:text-text sm:block"
          >
            <Home className="h-5 w-5" />
          </Link>
          {/* Icon-only on phones (text labels would overflow the row); text on sm+. */}
          <Link
            href="/record"
            aria-label="Record"
            className="transition hover:text-text"
          >
            <Mic className="h-5 w-5 sm:hidden" />
            <span className="hidden sm:inline">Record</span>
          </Link>
          <Link
            href="/history"
            aria-label="History"
            className="transition hover:text-text"
          >
            <History className="h-5 w-5 sm:hidden" />
            <span className="hidden sm:inline">History</span>
          </Link>
          <Link
            href="/reminders"
            aria-label="Reminders"
            className="transition hover:text-text"
          >
            <Bell className="h-5 w-5 sm:hidden" />
            <span className="hidden sm:inline">Reminders</span>
          </Link>
          <Link
            href="/profile"
            aria-label="Profile"
            className="transition hover:text-text"
          >
            <UserRound className="h-5 w-5 sm:hidden" />
            <span className="hidden sm:inline">Profile</span>
          </Link>
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}
