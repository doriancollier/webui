import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTransport } from '@/layers/shared/model';
import {
  FieldCard,
  FieldCardContent,
  Button,
  SettingRow,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/layers/shared/ui';
import { RecreateDorkBotDialog } from './RecreateDorkBotDialog';

/** Agents section within Settings — default agent dropdown and DorkBot recreation. */
export function AgentsTab() {
  const transport = useTransport();
  const queryClient = useQueryClient();
  const [showRecreation, setShowRecreation] = useState(false);

  const { data: agentsData } = useQuery({
    queryKey: ['mesh', 'agents'],
    queryFn: () => transport.listMeshAgents(),
    staleTime: 30_000,
  });

  const { data: config } = useQuery({
    queryKey: ['config'],
    queryFn: () => transport.getConfig(),
    staleTime: 30_000,
  });

  const agents = agentsData?.agents ?? [];
  const currentDefault = config?.agents?.defaultAgent ?? 'dorkbot';
  const dorkbotExists = agents.some((a) => a.name === 'dorkbot');

  async function handleSetDefaultAgent(agentName: string) {
    await transport.setDefaultAgent(agentName);
    await queryClient.invalidateQueries({ queryKey: ['config'] });
  }

  return (
    <>
      {agents.length > 0 && (
        <FieldCard>
          <FieldCardContent>
            <SettingRow
              label="Default agent"
              description="The primary agent used for new sessions and post-onboarding"
            >
              <Select value={currentDefault} onValueChange={handleSetDefaultAgent}>
                <SelectTrigger className="w-44" data-testid="default-agent-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.name}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingRow>
          </FieldCardContent>
        </FieldCard>
      )}

      {!dorkbotExists && (
        <>
          <FieldCard className="border-dashed" data-testid="recreate-dorkbot-card">
            <FieldCardContent>
              <div className="space-y-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium">DorkBot</p>
                  <p className="text-muted-foreground text-sm">
                    DorkBot is the default DorkOS agent. It was deleted or not created during
                    onboarding.
                  </p>
                </div>
                <Button variant="outline" onClick={() => setShowRecreation(true)}>
                  Recreate DorkBot
                </Button>
              </div>
            </FieldCardContent>
          </FieldCard>

          <RecreateDorkBotDialog open={showRecreation} onOpenChange={setShowRecreation} />
        </>
      )}
    </>
  );
}
