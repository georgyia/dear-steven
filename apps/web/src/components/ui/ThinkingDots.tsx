/** Three quiet dots while Dear Steven thinks; the label is for screen readers (P7-05, P7-06). */
export function ThinkingDots({ label, className = 'h-9' }: { label: string; className?: string }) {
  return (
    <p role="status" className={`flex items-center gap-1.5 ${className}`}>
      <span className="sr-only">{label}</span>
      {[0, 180, 360].map((delay) => (
        <span
          key={delay}
          aria-hidden="true"
          className="h-1.5 w-1.5 rounded-full bg-ivory-2 animate-[ds-breathe_1.2s_ease-in-out_infinite] motion-reduce:animate-none"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </p>
  );
}
