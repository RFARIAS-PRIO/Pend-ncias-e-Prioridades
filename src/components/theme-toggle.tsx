"use client";
import { Moon, Sun } from "lucide-react";
export function ThemeToggle() {
  return (
    <button type="button" className="btn btn-sm" aria-label="Alternar tema claro/escuro" onClick={() => {
      const dark = document.documentElement.classList.toggle("dark");
      try { localStorage.setItem("theme", dark ? "dark" : "light"); } catch {}
    }}>
      <Moon className="h-4 w-4 dark:hidden" aria-hidden /><Sun className="hidden h-4 w-4 dark:block" aria-hidden />
    </button>
  );
}
