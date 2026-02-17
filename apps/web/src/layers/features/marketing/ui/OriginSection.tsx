interface OriginSectionProps {
  label?: string
}

export function OriginSection({ label = 'The Origin' }: OriginSectionProps) {
  return (
    <section className="py-32 px-8 bg-cream-tertiary">
      <div className="max-w-[600px] mx-auto text-center relative">
        {/* Corner brackets - engineering document aesthetic */}
        <div className="absolute -top-8 -left-8 w-6 h-6 border-l-2 border-t-2 border-warm-gray-light/30" />
        <div className="absolute -top-8 -right-8 w-6 h-6 border-r-2 border-t-2 border-warm-gray-light/30" />
        <div className="absolute -bottom-8 -left-8 w-6 h-6 border-l-2 border-b-2 border-warm-gray-light/30" />
        <div className="absolute -bottom-8 -right-8 w-6 h-6 border-r-2 border-b-2 border-warm-gray-light/30" />

        {/* Label */}
        <span className="font-mono text-2xs tracking-[0.15em] uppercase text-warm-gray-light block mb-10">
          {label}
        </span>

        {/* Content paragraphs */}
        <p className="text-warm-gray text-lg leading-[1.7] mb-6">
          <strong className="font-mono font-semibold text-charcoal">DorkOS</strong> started because Claude Code deserved a proper browser interface. The terminal is powerful, but sometimes you want rich markdown, tool approval dialogs, and a chat you can share.
        </p>

        <p className="text-warm-gray text-lg leading-[1.7] mb-6">
          Built on the Claude Agent SDK, DorkOS reads the same session files as the CLI. No separate backend, no data duplication. One source of truth.
        </p>

        <p className="text-warm-gray-light text-lg leading-[1.7] italic">
          The name is playful. The tool is serious.
        </p>
      </div>
    </section>
  )
}
