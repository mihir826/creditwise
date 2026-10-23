"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Bookmark, Calculator, GitCompareArrows, LayoutGrid, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { LogoMark } from "./logo";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutGrid },
  { href: "/calculator", label: "Calculator", icon: Calculator },
  { href: "/compare", label: "Compare", icon: GitCompareArrows },
  { href: "/saved", label: "Saved", icon: Bookmark },
  { href: "/predict", label: "Predict", icon: Sparkles },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-full focus:bg-fg focus:px-4 focus:py-2 focus:text-bg"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 px-4 pt-3 sm:px-6 lg:px-10 lg:pt-5">
        <div className="mx-auto flex h-14 max-w-[1320px] items-center justify-between rounded-full border border-border bg-[#141517]/90 pr-2 pl-5 backdrop-blur-md lg:h-[68px] lg:pl-7">
          <Link href="/" className="flex items-center gap-2.5 text-fg" aria-label="CreditWise home">
            <LogoMark className="size-5 text-mint lg:size-6" />
            <span className="font-serif text-[22px] tracking-tight lg:text-[26px]">CreditWise</span>
          </Link>
          <nav aria-label="Primary" className="hidden md:block">
            <ul className="flex items-center gap-1">
              {NAV.map(({ href, label }) => {
                const active = isActive(pathname, href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "rounded-full px-4 py-2 text-sm transition-colors duration-150 lg:px-5 lg:py-2.5",
                        active ? "bg-[#1f2a1b] text-mint" : "text-muted hover:text-fg",
                      )}
                    >
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <Link
            href="/methodology"
            aria-current={pathname.startsWith("/methodology") ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-full px-3 py-2 text-sm transition-colors lg:px-4",
              pathname.startsWith("/methodology") ? "text-mint" : "text-muted hover:text-fg",
            )}
          >
            <BookOpen className="size-4" aria-hidden />
            <span className="hidden sm:inline">Methodology</span>
          </Link>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-[1320px] px-4 pt-8 pb-32 sm:px-6 md:pb-20 lg:px-10 lg:pt-12">
        {children}
      </main>

      <nav
        aria-label="Primary mobile"
        className="fixed inset-x-3 bottom-3 z-40 rounded-[22px] border border-border bg-[#141517]/95 backdrop-blur-md md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="grid grid-cols-5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex flex-col items-center gap-1 py-2.5 text-[11px] transition-colors",
                    active ? "text-mint" : "text-subtle hover:text-fg",
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
