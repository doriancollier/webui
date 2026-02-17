'use client'

import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Moon, Sun } from 'lucide-react'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="relative"
    >
      <Sun className="size-[18px] rotate-0 scale-100 transition-transform duration-200 dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute size-[18px] rotate-90 scale-0 transition-transform duration-200 dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
