import { useState } from 'react';

import { Edit2, Plug, Trash2 } from 'lucide-react';

import { describeAgentError } from '@/agent/errors';
import {
  useLLMConfigs,
  useUpdateLLMConfig,
  useDeleteLLMConfig,
  LLM_PROVIDERS,
  PROVIDER_LABELS,
  type LLMConfig,
  type LLMProvider,
} from '@/api/llm-configs';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  Dialog,
  EmptyState,
  LoadingState,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
import { toast } from '@/hooks/use-toast';

import { LLMSetupDialog } from './llm-setup-dialog';
import { PROVIDER_SETUP } from './llm-setup-utils';

type LLMConfigsTabProps = {
  canManage: boolean;
};

type SetupTarget = { provider: LLMProvider; configId?: string };

export function LLMConfigsTab({ canManage }: LLMConfigsTabProps) {
  const { data: configs = [], isLoading, isError, refetch } = useLLMConfigs();
  const updateMutation = useUpdateLLMConfig();
  const deleteMutation = useDeleteLLMConfig();
  const [setupTarget, setSetupTarget] = useState<SetupTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LLMConfig | null>(null);

  const handleDelete = async (): Promise<void> => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast({ title: 'Model removed', description: deleteTarget.name });
    } catch (error: unknown) {
      toast({
        title: 'Could not remove the model',
        description: describeAgentError(error),
        variant: 'destructive',
      });
    } finally {
      setDeleteTarget(null);
    }
  };

  const makeDefault = async (config: LLMConfig): Promise<void> => {
    try {
      await updateMutation.mutateAsync({
        configId: config.id,
        data: { isDefault: true },
      });
    } catch (error: unknown) {
      toast({
        title: 'Could not change the default',
        description: describeAgentError(error),
        variant: 'destructive',
      });
    }
  };

  if (isLoading) return <LoadingState />;
  if (isError)
    return (
      <Card>
        <CardContent className="space-y-3 pt-6">
          <p role="alert" className="text-sm text-destructive">
            Could not load your AI models.
          </p>
          <Button variant="outline" onClick={() => void refetch()}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI models</CardTitle>
        <CardDescription>
          Connect a provider and choose from its available models. Projects use
          your organisation’s default unless they pick their own.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {canManage && (
          <div className="grid gap-3 sm:grid-cols-2">
            {LLM_PROVIDERS.map((provider) => {
              const connected = configs.some(
                (config) => config.provider === provider,
              );
              return (
                <div
                  key={provider}
                  className="flex flex-col items-start gap-2 rounded-lg border p-4"
                >
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium">
                      {PROVIDER_LABELS[provider]}
                    </h3>
                    {connected && <Badge variant="outline">Configured</Badge>}
                  </div>
                  <p className="flex-1 text-xs text-muted-foreground">
                    {PROVIDER_SETUP[provider].description}
                  </p>
                  <Button
                    size="sm"
                    variant={connected ? 'outline' : 'default'}
                    onClick={() => setSetupTarget({ provider })}
                    className="gap-1.5"
                  >
                    <Plug size={13} aria-hidden="true" />
                    {connected
                      ? 'Choose another model'
                      : `Connect ${PROVIDER_LABELS[provider]}`}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
        {configs.length === 0 ? (
          <EmptyState
            icon={Plug}
            title="No AI models connected"
            description={
              canManage
                ? 'Choose a provider above. The first model you save becomes the organisation default.'
                : 'An owner or admin needs to connect a provider before the agent can run.'
            }
            size="sm"
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Key</TableHead>
                {canManage && (
                  <TableHead className="w-[1%] text-right">Actions</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {configs.map((config) => (
                <TableRow key={config.id}>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-2">
                      {config.name}
                      {config.isDefault && (
                        <Badge variant="outline" className="text-[10px]">
                          Default
                        </Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {PROVIDER_LABELS[config.provider]}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {config.model}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {config.hasApiKey ? 'Stored' : '—'}
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {!config.isDefault && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            disabled={updateMutation.isPending}
                            onClick={() => void makeDefault(config)}
                          >
                            Make default
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="size-7 p-0"
                          onClick={() =>
                            setSetupTarget({
                              provider: config.provider,
                              configId: config.id,
                            })
                          }
                          aria-label={`Edit ${config.name}`}
                        >
                          <Edit2 size={13} aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="size-7 p-0 text-destructive"
                          onClick={() => setDeleteTarget(config)}
                          aria-label={`Remove ${config.name}`}
                        >
                          <Trash2 size={13} aria-hidden="true" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <Dialog
        open={canManage && setupTarget !== null}
        onOpenChange={(open) => !open && setSetupTarget(null)}
      >
        {canManage && setupTarget && (
          <LLMSetupDialog
            key={setupTarget.configId ?? setupTarget.provider}
            provider={setupTarget.provider}
            configs={configs}
            editing={configs.find(
              (config) => config.id === setupTarget.configId,
            )}
            onClose={() => setSetupTarget(null)}
          />
        )}
      </Dialog>
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Remove this model?"
        description={
          deleteTarget?.isDefault
            ? `${deleteTarget.name} is the organisation default. Another model will take over as default, or the agent stops working if this is the last one.`
            : `Projects using ${deleteTarget?.name ?? 'it'} will fall back to the organisation default.`
        }
        confirmText="Remove"
        variant="destructive"
        onConfirm={() => void handleDelete()}
      />
    </Card>
  );
}
