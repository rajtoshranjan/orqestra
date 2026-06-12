import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  Lock,
  Unlock,
  Grid,
  Cloud,
  Rocket,
  Sparkles,
  Trash2,
  Copy,
} from 'lucide-react';

import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '@/components/ui/toast';
import { useToast } from '@/hooks/use-toast';

// Selects an appropriate icon based on the toast title, description, and variant.
function getToastIcon(title?: string, description?: string, variant?: string) {
  if (variant === 'destructive') {
    return <AlertCircle className="size-4 shrink-0 text-destructive" />;
  }

  const text = `${title || ''} ${description || ''}`.toLowerCase();

  if (text.includes('locked')) {
    return <Lock className="size-4 shrink-0 text-primary" />;
  }
  if (text.includes('unlocked')) {
    return <Unlock className="size-4 shrink-0 text-success" />;
  }
  if (text.includes('grid') || text.includes('snap')) {
    return <Grid className="size-4 shrink-0 text-primary" />;
  }
  if (text.includes('save') || text.includes('saved')) {
    return <Cloud className="size-4 shrink-0 text-success" />;
  }
  if (text.includes('deploy') || text.includes('started')) {
    return <Rocket className="size-4 shrink-0 text-primary" />;
  }
  if (text.includes('layout')) {
    return <Sparkles className="size-4 shrink-0 text-primary" />;
  }
  if (text.includes('copy') || text.includes('clipboard')) {
    return <Copy className="size-4 shrink-0 text-primary" />;
  }
  if (
    text.includes('clear') ||
    text.includes('deleted') ||
    text.includes('removed')
  ) {
    return <Trash2 className="size-4 shrink-0 text-destructive" />;
  }
  if (
    text.includes('warning') ||
    text.includes('attention') ||
    text.includes('no selection') ||
    text.includes('empty')
  ) {
    return <AlertTriangle className="size-4 shrink-0 text-warning" />;
  }
  if (
    text.includes('success') ||
    text.includes('created') ||
    text.includes('added') ||
    text.includes('applied')
  ) {
    return <CheckCircle2 className="size-4 shrink-0 text-success" />;
  }

  return <Info className="size-4 shrink-0 text-primary" />;
}

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider duration={4000}>
      {toasts.map(function ({
        id,
        title,
        description,
        action,
        variant,
        icon,
        ...props
      }) {
        const titleStr = typeof title === 'string' ? title : '';
        const descStr = typeof description === 'string' ? description : '';

        // If an icon is provided by the caller, use it. Otherwise, select a fallback icon.
        const toastIcon =
          icon !== undefined
            ? icon
            : getToastIcon(titleStr, descStr, variant || undefined);

        return (
          <Toast key={id} variant={variant} {...props}>
            <div className="flex items-center gap-2.5">
              {toastIcon}
              <div className="flex min-w-0 flex-col">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && (
                  <ToastDescription>{description}</ToastDescription>
                )}
              </div>
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
