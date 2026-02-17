import { ProjectCard } from './ProjectCard'
import type { Project } from '../lib/types'

interface ProjectsGridProps {
  projects: Project[]
}

export function ProjectsGrid({ projects }: ProjectsGridProps) {
  return (
    <section id="features" className="py-40">
      {/* Section Label */}
      <span className="font-mono text-2xs tracking-[0.15em] uppercase text-brand-orange text-center block mb-20">
        Features
      </span>

      {/* Grid - 1px gap with border background */}
      <div
        className="grid grid-cols-1 md:grid-cols-2"
        style={{
          gap: '1px',
          backgroundColor: 'var(--border-warm)',
        }}
      >
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </section>
  )
}
