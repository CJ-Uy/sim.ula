"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "Simulate", href: "/simulate", primary: true },
  { label: "Your Policies", href: "/policies" },
  { label: "Knowledge Base", href: "/knowledge" },
  { label: "Scrape", href: "/scrape" },
  { label: "+ Add Data", href: "/add-data" },
];

export default function Header({
  minimal,
  hideNav,
}: {
  minimal?: boolean;
  hideNav?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  return (
    <header className="border-b border-border-light bg-surface">
      <div className="flex items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-baseline gap-3">
          <Link
            href="/"
            className="font-serif text-lg font-semibold tracking-tight hover:opacity-80 transition-opacity"
          >
            sim.ula
          </Link>
          {!minimal && (
            <span className="hidden text-sm text-muted sm:inline">
              Urban Policy Simulation Platform
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {!hideNav && (
            <>
              {/* Desktop nav */}
              <div className="hidden sm:flex items-center gap-2">
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  if (item.primary) {
                    return (
                      <Link
                        key={item.label}
                        href={item.href}
                        className={`text-xs font-bold uppercase tracking-wider px-3 py-1.5 transition-colors border ${
                          isActive
                            ? "bg-accent border-accent text-white"
                            : "bg-foreground border-foreground text-background hover:bg-accent hover:border-accent"
                        }`}
                      >
                        {item.label}
                      </Link>
                    );
                  }
                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      className={`text-xs font-medium px-3 py-1.5 transition-colors border ${
                        isActive
                          ? "border-accent text-accent"
                          : "text-muted hover:text-foreground border-border hover:border-border-light"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
              {/* Mobile hamburger */}
              <div ref={menuRef} className="relative sm:hidden">
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-label="Menu"
                  className="flex h-8 w-8 items-center justify-center border border-border text-muted hover:text-foreground transition-colors"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  >
                    {menuOpen ? (
                      <>
                        <line x1="4" y1="4" x2="12" y2="12" />
                        <line x1="12" y1="4" x2="4" y2="12" />
                      </>
                    ) : (
                      <>
                        <line x1="2" y1="4" x2="14" y2="4" />
                        <line x1="2" y1="8" x2="14" y2="8" />
                        <line x1="2" y1="12" x2="14" y2="12" />
                      </>
                    )}
                  </svg>
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-full mt-1 z-50 min-w-45 border border-border-light bg-surface shadow-lg">
                    {navItems.map((item) => (
                      <Link
                        key={item.label}
                        href={item.href}
                        onClick={() => setMenuOpen(false)}
                        className={`block w-full px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-background ${
                          item.primary
                            ? "font-bold text-foreground hover:text-foreground"
                            : "text-muted hover:text-foreground"
                        }`}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
          <span className="text-xs text-muted-light">v0.1</span>
        </div>
      </div>
    </header>
  );
}
