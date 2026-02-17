/** Antagonist framing section — cloud vs. local positioning. */
export function ProblemSection() {
  return (
    <section className="py-32 px-8 bg-cream-tertiary">
      <div className="max-w-[600px] mx-auto text-center relative">
        {/* Corner brackets — engineering document aesthetic */}
        <div className="absolute -top-8 -left-8 w-6 h-6 border-l-2 border-t-2 border-warm-gray-light/30" />
        <div className="absolute -top-8 -right-8 w-6 h-6 border-r-2 border-t-2 border-warm-gray-light/30" />
        <div className="absolute -bottom-8 -left-8 w-6 h-6 border-l-2 border-b-2 border-warm-gray-light/30" />
        <div className="absolute -bottom-8 -right-8 w-6 h-6 border-r-2 border-b-2 border-warm-gray-light/30" />

        <p className="text-warm-gray text-lg leading-[1.7] mb-6">
          Every AI coding interface you&apos;ve used lives in someone
          else&apos;s cloud. Their servers. Their logs. Their uptime. Their
          rules.
        </p>

        <p className="text-charcoal font-semibold text-lg leading-[1.7] mb-6">
          DorkOS is different.
        </p>

        <p className="text-warm-gray text-lg leading-[1.7]">
          It runs on your machine. You access it from any browser. Your
          sessions, your transcripts, your infrastructure.
        </p>
      </div>
    </section>
  )
}
