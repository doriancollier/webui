export type ProjectStatus = 'stable' | 'beta' | 'planned' | 'experimental'
export type ProjectType = 'Core' | 'Interface' | 'Developer' | 'Integration'

export interface Project {
  id: string
  title: string
  description: string
  status: ProjectStatus
  type: ProjectType
  href?: string
}

export interface PhilosophyItem {
  number: string
  title: string
  description: string
}

export interface NavLink {
  label: string
  href: string
}
