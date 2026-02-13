import { useState } from 'react';
import { Check, MessageSquare } from 'lucide-react';
import { useTransport } from '../../contexts/TransportContext';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import type { QuestionItem } from '@lifeos/shared/types';

interface QuestionPromptProps {
  sessionId: string;
  toolCallId: string;
  questions: QuestionItem[];
  /** Pre-submitted answers from history — renders collapsed immediately */
  answers?: Record<string, string>;
}

export function QuestionPrompt({ sessionId, toolCallId, questions, answers: preAnswers }: QuestionPromptProps) {
  const transport = useTransport();
  const [selections, setSelections] = useState<Record<string, string | string[]>>({});
  const [otherText, setOtherText] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(!!preAnswers);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('0');

  function handleSingleSelect(questionIdx: number, value: string) {
    setSelections(prev => ({ ...prev, [questionIdx]: value }));
  }

  function handleMultiSelect(questionIdx: number, value: string, checked: boolean) {
    setSelections(prev => {
      const current = (prev[questionIdx] as string[]) || [];
      if (checked) {
        return { ...prev, [questionIdx]: [...current, value] };
      }
      return { ...prev, [questionIdx]: current.filter(v => v !== value) };
    });
  }

  function handleOtherText(questionIdx: number, text: string) {
    setOtherText(prev => ({ ...prev, [questionIdx]: text }));
  }

  function hasAnswer(idx: number): boolean {
    const sel = selections[idx];
    if (!sel) return false;
    if (questions[idx].multiSelect) {
      const arr = sel as string[];
      return arr.length > 0 && (!arr.includes('__other__') || !!otherText[idx]?.trim());
    }
    return sel !== '__other__' || !!otherText[idx]?.trim();
  }

  function isComplete(): boolean {
    return questions.every((_q, idx) => hasAnswer(idx));
  }

  function getDisplayValue(q: QuestionItem, idx: number): string | null {
    if (preAnswers && preAnswers[String(idx)]) {
      const raw = preAnswers[String(idx)];
      if (q.multiSelect) {
        try { return (JSON.parse(raw) as string[]).join(', '); }
        catch { return raw; }
      }
      return raw;
    }
    if (!preAnswers) {
      const sel = selections[idx];
      if (!sel) return null;
      if (q.multiSelect) {
        return (sel as string[]).map(v => v === '__other__' ? otherText[idx] : v).join(', ');
      }
      return sel === '__other__' ? otherText[idx] : (sel as string);
    }
    return null;
  }

  async function handleSubmit() {
    if (!isComplete() || submitting) return;
    setSubmitting(true);
    setError(null);

    // Build answers record: key is question index as string, value is selected label(s)
    const answers: Record<string, string> = {};
    questions.forEach((q, idx) => {
      const sel = selections[idx];
      if (q.multiSelect) {
        const arr = (sel as string[]).map(v =>
          v === '__other__' ? otherText[idx]?.trim() || '' : v
        );
        answers[String(idx)] = JSON.stringify(arr);
      } else {
        answers[String(idx)] = sel === '__other__' ? otherText[idx]?.trim() || '' : (sel as string);
      }
    });

    try {
      await transport.submitAnswers(sessionId, toolCallId, answers);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit answers');
    } finally {
      setSubmitting(false);
    }
  }

  // Collapsed submitted state
  if (submitted) {
    const hasSpecificAnswers = preAnswers
      ? Object.values(preAnswers).some(v => v !== '')
      : Object.keys(selections).length > 0;

    return (
      <div className="my-1 rounded border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm transition-colors duration-200">
        {hasSpecificAnswers ? (
          <div className="flex items-start gap-2">
            <Check className="size-(--size-icon-md) text-emerald-500 mt-0.5 shrink-0" />
            <div className="space-y-1.5 min-w-0">
              {questions.map((q, idx) => {
                const displayValue = getDisplayValue(q, idx);
                if (!displayValue) return null;
                return (
                  <div key={idx}>
                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                      {q.header}
                    </span>
                    <p className="text-sm text-emerald-600 dark:text-emerald-400 break-words">
                      {displayValue}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Check className="size-(--size-icon-md) text-emerald-500" />
            <span className="text-emerald-600 dark:text-emerald-400">Questions answered</span>
          </div>
        )}
      </div>
    );
  }

  // Render a single question's form content
  function renderQuestionContent(q: QuestionItem, qIdx: number) {
    return (
      <div>
        <div className="flex items-center gap-2 mb-1">
          <MessageSquare className="size-(--size-icon-sm) text-amber-500" />
          <span className="font-semibold text-sm">{q.header}</span>
        </div>
        <p className="mb-2 text-foreground">{q.question}</p>

        <div className="space-y-1.5 ml-1">
          {q.options.map((opt, oIdx) => {
            const isSelected = q.multiSelect
              ? ((selections[qIdx] as string[]) || []).includes(opt.label)
              : selections[qIdx] === opt.label;

            return (
              <label
                key={oIdx}
                className={`flex items-start gap-2 rounded px-2 py-1.5 cursor-pointer transition-colors ${
                  isSelected ? 'bg-amber-500/15' : 'hover:bg-amber-500/5'
                }`}
              >
                <input
                  type={q.multiSelect ? 'checkbox' : 'radio'}
                  name={`q-${qIdx}`}
                  checked={isSelected}
                  disabled={submitting}
                  onChange={(e) => {
                    if (q.multiSelect) {
                      handleMultiSelect(qIdx, opt.label, e.target.checked);
                    } else {
                      handleSingleSelect(qIdx, opt.label);
                    }
                  }}
                  className="mt-0.5 accent-amber-500"
                />
                <div>
                  <span className="font-medium">{opt.label}</span>
                  {opt.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                  )}
                </div>
              </label>
            );
          })}

          {/* "Other" free-text option */}
          <label
            className={`flex items-start gap-2 rounded px-2 py-1.5 cursor-pointer transition-colors ${
              q.multiSelect
                ? ((selections[qIdx] as string[]) || []).includes('__other__') ? 'bg-amber-500/15' : 'hover:bg-amber-500/5'
                : selections[qIdx] === '__other__' ? 'bg-amber-500/15' : 'hover:bg-amber-500/5'
            }`}
          >
            <input
              type={q.multiSelect ? 'checkbox' : 'radio'}
              name={`q-${qIdx}`}
              checked={
                q.multiSelect
                  ? ((selections[qIdx] as string[]) || []).includes('__other__')
                  : selections[qIdx] === '__other__'
              }
              disabled={submitting}
              onChange={(e) => {
                if (q.multiSelect) {
                  handleMultiSelect(qIdx, '__other__', e.target.checked);
                } else {
                  handleSingleSelect(qIdx, '__other__');
                }
              }}
              className="mt-0.5 accent-amber-500"
            />
            <div className="flex-1">
              <span className="font-medium">Other</span>
              {(q.multiSelect
                ? ((selections[qIdx] as string[]) || []).includes('__other__')
                : selections[qIdx] === '__other__') && (
                <textarea
                  placeholder="Type your answer..."
                  rows={2}
                  value={otherText[qIdx] || ''}
                  disabled={submitting}
                  onChange={(e) => handleOtherText(qIdx, e.target.value)}
                  className="mt-1 w-full rounded border border-amber-500/30 bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500/50 resize-y"
                  autoFocus
                />
              )}
            </div>
          </label>
        </div>
      </div>
    );
  }

  // Pending state: render full question form
  return (
    <div className="my-1 rounded border border-amber-500/20 bg-amber-500/10 p-3 text-sm transition-colors duration-200">
      {questions.length === 1 ? (
        // Single question — render directly without tabs
        renderQuestionContent(questions[0], 0)
      ) : (
        // Multiple questions — wrap in Tabs
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="h-auto bg-transparent p-0 gap-1.5 mb-3 flex-wrap">
            {questions.map((q, idx) => (
              <TabsTrigger
                key={idx}
                value={String(idx)}
                className="h-auto rounded-full px-2.5 py-1 text-xs font-medium data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-700 dark:data-[state=active]:text-amber-300 data-[state=active]:shadow-none data-[state=inactive]:bg-muted/50"
              >
                {hasAnswer(idx) && <Check className="size-3 mr-1" />}
                <span className="max-w-[120px] truncate">{q.header}</span>
              </TabsTrigger>
            ))}
          </TabsList>
          {questions.map((q, idx) => (
            <TabsContent key={idx} value={String(idx)} className="mt-0">
              {renderQuestionContent(q, idx)}
            </TabsContent>
          ))}
        </Tabs>
      )}

      {error && (
        <p className="mt-2 text-xs text-red-500">{error}</p>
      )}

      <button
        onClick={handleSubmit}
        disabled={!isComplete() || submitting}
        className="mt-3 flex items-center gap-1 rounded bg-amber-600 px-3 py-1.5 text-white text-xs hover:bg-amber-700 disabled:opacity-50 transition-colors"
      >
        {submitting ? (
          <>Submitting...</>
        ) : (
          <><Check className="size-(--size-icon-xs)" /> Submit</>
        )}
      </button>
    </div>
  );
}
