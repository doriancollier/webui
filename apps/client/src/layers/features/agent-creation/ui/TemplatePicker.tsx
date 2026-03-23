/**
 * Template picker grid with category filtering and custom GitHub URL input.
 *
 * Renders built-in templates as a card grid organized by category tabs,
 * with a custom URL input for GitHub repositories as an alternative.
 * Grid selection and URL input are mutually exclusive.
 */
import { useState } from 'react';
import { Check } from 'lucide-react';
import type { TemplateCategory } from '@dorkos/shared/template-catalog';
import { Button, Input, Label } from '@/layers/shared/ui';
import { cn } from '@/layers/shared/lib';
import { useTemplateCatalog } from '../model/use-template-catalog';

const CATEGORY_TABS: Array<{ value: 'all' | TemplateCategory; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'general', label: 'General' },
  { value: 'frontend', label: 'Frontend' },
  { value: 'backend', label: 'Backend' },
  { value: 'library', label: 'Library' },
  { value: 'tooling', label: 'Tooling' },
];

interface TemplatePickerProps {
  /** Currently selected template ID or custom URL, or null if nothing selected. */
  selectedTemplate: string | null;
  /** Called when selection changes. Receives template ID, custom URL, or null. */
  onSelect: (template: string | null) => void;
}

/** Template picker with category-filtered grid and custom GitHub URL input. */
export function TemplatePicker({ selectedTemplate, onSelect }: TemplatePickerProps) {
  const [category, setCategory] = useState<'all' | TemplateCategory>('all');
  const [customUrl, setCustomUrl] = useState('');
  const { data: templates } = useTemplateCatalog();

  const filtered =
    category === 'all' ? templates : templates?.filter((t) => t.category === category);

  return (
    <div className="space-y-3">
      <Label>Template (optional)</Label>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-1" role="tablist" aria-label="Template categories">
        {CATEGORY_TABS.map((tab) => (
          <Button
            key={tab.value}
            variant={category === tab.value ? 'default' : 'ghost'}
            size="sm"
            role="tab"
            aria-selected={category === tab.value}
            onClick={() => setCategory(tab.value)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Template grid */}
      <div className="grid grid-cols-4 gap-2" data-testid="template-grid">
        {filtered?.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => {
              onSelect(selectedTemplate === template.id ? null : template.id);
              setCustomUrl('');
            }}
            className={cn(
              'hover:border-primary rounded-lg border p-3 text-left transition-colors',
              selectedTemplate === template.id && 'border-primary bg-primary/5'
            )}
            data-testid={`template-card-${template.id}`}
          >
            <p className="text-sm font-medium">{template.name}</p>
            <p className="text-muted-foreground line-clamp-2 text-xs">{template.description}</p>
            {selectedTemplate === template.id && (
              <Check className="text-primary mt-1 size-4" aria-hidden />
            )}
          </button>
        ))}
      </div>

      {/* Custom URL input */}
      <div className="space-y-1">
        <p className="text-muted-foreground text-xs">Or enter GitHub URL:</p>
        <Input
          value={customUrl}
          onChange={(e) => {
            const url = e.target.value;
            setCustomUrl(url);
            onSelect(url || null);
          }}
          placeholder="github.com/org/repo"
          data-testid="custom-url-input"
        />
      </div>
    </div>
  );
}
