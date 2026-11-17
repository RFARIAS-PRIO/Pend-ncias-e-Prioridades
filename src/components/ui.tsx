"use client";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

export function toast(message: string, kind: "ok" | "error" = "ok") {
  window.dispatchEvent(new CustomEvent("cc-toast", { detail: { message, kind } }));
}
export function Toaster() {
  const [items, setItems] = useState<{ id: number; message: string; kind: string }[]>([]);
  useEffect(() => {
    const h = (e: Event) => {
      const d = (e as CustomEvent).detail; const id = Date.now() + Math.random();
      setItems((x) => [...x, { id, ...d }]);
      setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 4500);
    };
    window.addEventListener("cc-toast", h); return () => window.removeEventListener("cc-toast", h);
  }, []);
  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 flex-col gap-2" role="status" aria-live="polite">
      {items.map((i) => (
        <div key={i.id} className={`pointer-events-auto rounded-md border px-3 py-2 text-sm shadow-lg ${i.kind === "error" ? "border-red-400 bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100" : "border-emerald-400 bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"}`}>
          {i.kind === "error" ? "✕ " : "✔ "}{i.message}
        </div>
      ))}
    </div>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => { if (e.target === ref.current) onClose(); }}
      className="w-[min(32rem,calc(100vw-2rem))] rounded-lg border border-line bg-surface p-0 text-fg backdrop:bg-black/50">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-base font-semibold">{title}</h2>
        <button type="button" className="btn btn-sm" aria-label="Fechar" onClick={onClose}><X className="h-4 w-4" aria-hidden /></button>
      </div>
      <div className="p-4">{children}</div>
    </dialog>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return <div className="rounded-lg border border-dashed border-line p-8 text-center"><p className="font-medium">{title}</p>{hint && <p className="mt-1 text-sm text-sub">{hint}</p>}</div>;
}
