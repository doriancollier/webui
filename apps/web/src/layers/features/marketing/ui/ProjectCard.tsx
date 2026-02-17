'use client'

import Link from 'next/link'
import posthog from 'posthog-js'
import { Badge } from '@/components/ui/badge'
import type { Project, ProjectStatus } from '../lib/types'

const statusColors: Record<ProjectStatus, string> = {
  stable: 'text-brand-green',
  beta: 'text-brand-orange',
  planned: 'text-brand-blue',
  experimental: 'text-brand-purple',
}

const statusLabels: Record<ProjectStatus, string> = {
  stable: 'Stable',
  beta: 'Beta',
  planned: 'Planned',
  experimental: 'Experimental',
}

interface ProjectCardProps {
  project: Project
}

export function ProjectCard({ project }: ProjectCardProps) {
  const statusColor = statusColors[project.status]

  const handleProjectClick = () => {
    posthog.capture('project_clicked', {
      project_title: project.title,
      project_status: project.status,
      project_type: project.type,
      project_href: project.href,
    })
  }

  const content = (
    <>
      {/* Meta: Status + Type */}
      <div className="flex items-center justify-center gap-3 mb-5">
        <span className={`font-mono text-3xs font-medium tracking-[0.1em] uppercase ${statusColor}`}>
          {statusLabels[project.status]}
        </span>
        <Badge className="font-mono text-3xs tracking-[0.06em] text-warm-gray-light px-2 py-1 bg-cream-secondary border-transparent">
          {project.type}
        </Badge>
      </div>

      {/* Title */}
      <h3 className="text-charcoal font-semibold text-xl tracking-[-0.01em] mb-3">
        {project.title}
      </h3>

      {/* Description */}
      <p className="text-warm-gray text-sm leading-relaxed">
        {project.description}
      </p>
    </>
  )

  const baseClassName = "text-center py-12 px-6 bg-cream-primary transition-smooth"
  const hoverClassName = project.href ? "hover:bg-cream-secondary cursor-pointer" : ""

  if (project.href) {
    return (
      <Link
        href={project.href}
        target="_blank"
        rel="noopener noreferrer"
        className={`${baseClassName} ${hoverClassName}`}
        onClick={handleProjectClick}
      >
        {content}
      </Link>
    )
  }

  return <article className={baseClassName}>{content}</article>
}
