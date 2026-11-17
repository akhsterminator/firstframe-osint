export function Mark({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <path d="M2 10V2h8M22 2h8v8M30 22v8h-8M10 30H2v-8" stroke="currentColor" strokeWidth="3" fill="none" />
      <circle cx="10" cy="10" r="3.5" className="fill-alert" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <Mark />
      <span className="text-[17px] font-semibold tracking-[-0.01em]">FirstFrame</span>
    </span>
  );
}
