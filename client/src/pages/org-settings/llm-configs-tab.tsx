import { useState } from 'react';

import { CheckCircle2, Edit2, Plug, Plus, Trash2, XCircle } from 'lucide-react';

import {
  useLLMConfigs,
  useCreateLLMConfig,
  useUpdateLLMConfig,
  useDeleteLLMConfig,
  testLLMConnection,
  LLM_PROVIDERS,
  PROVIDER_LABELS,
  PROVIDERS_REQUIRING_BASE_URL,
  PROVIDERS_REQUIRING_KEY,
  type CreateLLMConfigPayload,
  type LLMConfig,
  type LLMConnectionResult,
  type LLMProvider,
} from '@/api';
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
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Input,
  LoadingState,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
import { toast } from '@/hooks/use-toast';

type LLMConfigsTabProps = {
  canManage: boolean;
};

const EMPTY_FORM: CreateLLMConfigPayload = {
  name: '',
  provider: 'anthropic',
  model: '',
  apiKey: '',
  baseUrl: '',
  contextWindow: 0,
};

/** A sensible starting model per provider, so the field is never a blank guess. */
const MODEL_PLACEHOLDER: Record<LLMProvider, string> = {
  anthropic: 'claude-sonnet-5',
  gemini: 'gemini-2.5-flash',
  ollama: 'qwen3:8b',
};

export function LLMConfigsTab({ canManage }: LLMConfigsTabProps) {
  const { data: configs = [], isLoading } = useLLMConfigs();
  const createMutation = useCreateLLMConfig();
  const updateMutation = useUpdateLLMConfig();
  const deleteMutation = useDeleteLLMConfig();

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<CreateLLMConfigPayload>(EMPTY_FORM);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<LLMConnectionResult | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<LLMConfig | null>(null);

  const needsKey = PROVIDERS_REQUIRING_KEY.includes(formData.provider);
  const needsBaseUrl = PROVIDERS_REQUIRING_BASE_URL.includes(formData.provider);
  const isEditing = editingId !== null;

  const closeForm = (open: boolean): void => {
    setFormOpen(open);
    if (!open) {
      setFormData(EMPTY_FORM);
      setEditingId(null);
      setTestResult(null);
    }
  };

  const startEdit = (config: LLMConfig): void => {
    setEditingId(config.id);
    setFormData({
      name: config.name,
      provider: config.provider,
      model: config.model,
      // Never prefilled: the server doesn't return it. Blank means "keep it".
      apiKey: '',
      baseUrl: config.baseUrl,
      contextWindow: config.contextWindow,
    });
    setTestResult(null);
    setFormOpen(true);
  };

  const missingRequired = (): string | null => {
    if (!formData.name.trim()) return 'Give this model a name.';
    if (!formData.model.trim()) return 'Enter the model id.';
    if (needsKey && !formData.apiKey && !isEditing)
      return `${PROVIDER_LABELS[formData.provider]} needs an API key.`;
    if (needsBaseUrl && !formData.baseUrl?.trim())
      return 'Enter the endpoint URL.';
    return null;
  };

  const handleTest = async (): Promise<void> => {
    const problem = missingRequired();
    if (problem) {
      setTestResult({ ok: false, error: problem });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      setTestResult(
        await testLLMConnection({
          ...formData,
          ...(editingId ? { configId: editingId } : {}),
        }),
      );
    } catch {
      setTestResult({ ok: false, error: 'Could not reach the server.' });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async (): Promise<void> => {
    const problem = missingRequired();
    if (problem) {
      toast({
        title: 'Missing details',
        description: problem,
        variant: 'destructive',
      });
      return;
    }
    try {
      if (editingId) {
        await updateMutation.mutateAsync({
          configId: editingId,
          data: formData,
        });
      } else {
        await createMutation.mutateAsync(formData);
      }
      toast({
        title: editingId ? 'Model updated' : 'Model added',
        description: `${formData.name} is ready for the agent to use.`,
      });
      closeForm(false);
    } catch {
      toast({
        title: 'Could not save',
        description: 'Check the details and try again.',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast({ title: 'Model removed', description: deleteTarget.name });
    } catch {
      toast({ title: 'Could not remove the model', variant: 'destructive' });
    } finally {
      setDeleteTarget(null);
    }
  };

  const makeDefault = async (config: LLMConfig): Promise<void> => {
    await updateMutation.mutateAsync({
      configId: config.id,
      data: { isDefault: true },
    });
  };

  if (isLoading) return <LoadingState />;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1.5">
          <CardTitle>AI models</CardTitle>
          <CardDescription>
            Models the agent can use. Keys are stored encrypted and never leave
            the server. Projects use the default unless they pick their own.
          </CardDescription>
        </div>
        {canManage && (
          <Button
            size="sm"
            onClick={() => setFormOpen(true)}
            className="gap-1.5"
          >
            <Plus size={14} aria-hidden="true" /> Add model
          </Button>
        )}
      </CardHeader>

      <CardContent>
        {configs.length === 0 ? (
          <EmptyState
            icon={Plug}
            title="No AI models yet"
            description={
              canManage
                ? 'Add a model so the agent can design on the canvas.'
                : 'An owner or admin needs to add one before the agent can run.'
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
                            onClick={() => void makeDefault(config)}
                          >
                            Make default
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="size-7 p-0"
                          onClick={() => startEdit(config)}
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

      <Dialog open={formOpen} onOpenChange={closeForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit model' : 'Add model'}</DialogTitle>
            <DialogDescription>
              The agent uses this to design on the canvas. Test the connection
              before saving to catch a wrong key or model id here rather than
              mid-run.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="llm-name">
                Name
              </label>
              <Input
                id="llm-name"
                value={formData.name}
                onChange={(event) =>
                  setFormData({ ...formData, name: event.target.value })
                }
                placeholder="Claude Sonnet 5"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="llm-provider">
                Provider
              </label>
              <Select
                id="llm-provider"
                value={formData.provider}
                onChange={(event) =>
                  setFormData({
                    ...formData,
                    provider: event.target.value as LLMProvider,
                    model: '',
                  })
                }
              >
                {LLM_PROVIDERS.map((provider) => (
                  <option key={provider} value={provider}>
                    {PROVIDER_LABELS[provider]}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="llm-model">
                Model id
              </label>
              <Input
                id="llm-model"
                value={formData.model}
                onChange={(event) =>
                  setFormData({ ...formData, model: event.target.value })
                }
                placeholder={MODEL_PLACEHOLDER[formData.provider]}
                className="font-mono text-xs"
              />
            </div>

            {needsBaseUrl && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="llm-base-url">
                  Endpoint URL
                </label>
                <Input
                  id="llm-base-url"
                  value={formData.baseUrl ?? ''}
                  onChange={(event) =>
                    setFormData({ ...formData, baseUrl: event.target.value })
                  }
                  placeholder="http://host.docker.internal:11434"
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Use <code>https://ollama.com</code> for cloud models, or the
                  host address your server can reach for a local one.
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="llm-api-key">
                API key{' '}
                {!needsKey && (
                  <span className="font-normal text-muted-foreground">
                    (optional for a local endpoint)
                  </span>
                )}
              </label>
              <Input
                id="llm-api-key"
                type="password"
                value={formData.apiKey ?? ''}
                onChange={(event) =>
                  setFormData({ ...formData, apiKey: event.target.value })
                }
                placeholder={
                  isEditing ? 'Leave blank to keep the stored key' : ''
                }
              />
            </div>

            {needsBaseUrl && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="llm-ctx">
                  Context window
                </label>
                <Input
                  id="llm-ctx"
                  type="number"
                  min={0}
                  value={formData.contextWindow || ''}
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      contextWindow: Number(event.target.value) || 0,
                    })
                  }
                  placeholder="32768"
                />
                <p className="text-xs text-muted-foreground">
                  Local endpoints default to 4096, which truncates the service
                  catalog out of the prompt. Leave blank for cloud models.
                </p>
              </div>
            )}

            {testResult && (
              <div
                role="status"
                className={`flex items-start gap-2 rounded-lg border p-3 text-xs ${
                  testResult.ok
                    ? 'border-success/40 bg-success/10 text-success'
                    : 'border-destructive/40 bg-destructive/10 text-destructive'
                }`}
              >
                {testResult.ok ? (
                  <CheckCircle2 size={14} className="mt-px shrink-0" />
                ) : (
                  <XCircle size={14} className="mt-px shrink-0" />
                )}
                <span className="min-w-0 break-words">
                  {testResult.ok
                    ? `Connected. ${testResult.model} responded.`
                    : testResult.error}
                </span>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              variant="outline"
              onClick={() => void handleTest()}
              disabled={testing}
              className="gap-1.5"
            >
              <Plug size={14} aria-hidden="true" />
              {testing ? 'Testing…' : 'Test connection'}
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => closeForm(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => void handleSave()}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                Save
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
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
