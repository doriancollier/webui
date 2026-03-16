interface PlaygroundSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

/** Reusable section card for the dev playground. */
export function PlaygroundSection({
  title,
  description,
  children,
}: PlaygroundSectionProps) {
  const anchorId = title.toLowerCase().replace(/\s+/g, '-');

  return (
    <section id={anchorId} className="rounded-xl border border-border bg-card p-6">
      <h2 className="group mb-1 text-lg font-semibold text-foreground">
        {title}
        <a
          href={`#${anchorId}`}
          className="ml-2 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground"
          aria-label={`Link to ${title}`}
        >
          #
        </a>
      </h2>
      {description && (
        <p className="mb-4 text-sm text-muted-foreground">{description}</p>
      )}
      <div className="space-y-6">{children}</div>
    </section>
  );
}
