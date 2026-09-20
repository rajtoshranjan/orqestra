import { useState } from 'react';

import { useMutation } from '@tanstack/react-query';

import { describeAgentError } from '@/agent/errors';
import {
  discoverLLMModels,
  testLLMConnection,
  useCreateLLMConfig,
  useUpdateLLMConfig,
  type CreateLLMConfigPayload,
  type LLMConfig,
  type LLMModel,
  type LLMProvider,
} from '@/api/llm-configs';
import { toast } from '@/hooks/use-toast';

import {
  connectionProblem,
  initialLLMForm,
  NEW_CREDENTIALS,
  selectedModelPayload,
} from './llm-setup-utils';

const EMPTY_MODELS: LLMModel[] = [];

export function useLLMSetup(
  provider: LLMProvider,
  configs: LLMConfig[],
  editing: LLMConfig | undefined,
  onSaved: () => void,
) {
  const connections = configs.filter((config) => config.provider === provider);
  const initialSource = editing ?? connections[0];
  const [sourceId, setSourceId] = useState<string>(
    initialSource?.id ?? NEW_CREDENTIALS,
  );
  const [form, setForm] = useState<CreateLLMConfigPayload>(() => ({
    ...initialLLMForm(provider, editing),
    baseUrl: initialSource?.baseUrl ?? '',
    contextWindow: initialSource?.contextWindow ?? 0,
  }));
  const [manual, setManual] = useState<boolean>(false);
  const [problem, setProblem] = useState<string | null>(null);
  const discovery = useMutation({ mutationFn: discoverLLMModels, gcTime: 0 });
  const test = useMutation({ mutationFn: testLLMConnection, gcTime: 0 });
  const create = useCreateLLMConfig();
  const update = useUpdateLLMConfig();
  const source = connections.find((config) => config.id === sourceId);
  const models = discovery.data?.ok ? discovery.data.models : EMPTY_MODELS;
  const payload = selectedModelPayload(form, models, manual);
  const credentials = {
    provider,
    apiKey: form.apiKey?.trim(),
    baseUrl: form.baseUrl?.trim(),
    ...(source ? { configId: source.id } : {}),
  };
  const saving = create.isPending || update.isPending;

  const changeForm = (changes: Partial<CreateLLMConfigPayload>): void => {
    const connectionChanged = 'apiKey' in changes || 'baseUrl' in changes;
    setForm((current) => ({
      ...current,
      ...changes,
      ...(connectionChanged ? { model: '' } : {}),
    }));
    test.reset();
    setProblem(null);
    if (connectionChanged) discovery.reset();
  };

  const changeSource = (nextId: string): void => {
    const nextSource = connections.find((config) => config.id === nextId);
    setSourceId(nextId);
    setForm({
      ...initialLLMForm(provider),
      baseUrl: nextSource?.baseUrl ?? '',
      contextWindow: nextSource?.contextWindow ?? 0,
    });
    discovery.reset();
    test.reset();
    setProblem(null);
  };

  const loadModels = (): void => {
    const issue = connectionProblem(form, source);
    setProblem(issue);
    if (issue) return;
    test.reset();
    discovery.mutate(credentials);
  };

  const validateModel = (): boolean => {
    const issue =
      connectionProblem(form, source) ||
      (!payload.model ? 'Choose a model first.' : null);
    setProblem(issue);
    return !issue;
  };

  const testModel = (): void => {
    if (validateModel()) test.mutate({ ...payload, ...credentials });
  };

  const save = async (): Promise<void> => {
    if (!validateModel()) return;
    try {
      if (editing) {
        await update.mutateAsync({
          configId: editing.id,
          data: {
            ...payload,
            apiKey: credentials.apiKey,
            baseUrl: credentials.baseUrl,
          },
        });
      } else {
        await create.mutateAsync({ ...payload, ...credentials });
      }
      toast({
        title: editing ? 'Model updated' : 'Model connected',
        description: payload.name,
      });
      onSaved();
    } catch (error: unknown) {
      setProblem(describeAgentError(error));
    }
  };

  const changeManual = (): void => {
    setManual(!manual);
    changeForm({ model: '' });
  };

  return {
    form,
    payload,
    source,
    sourceId,
    connections,
    manual,
    models,
    discovery,
    test,
    saving,
    problem,
    changeForm,
    changeSource,
    changeManual,
    loadModels,
    testModel,
    save,
  };
}
