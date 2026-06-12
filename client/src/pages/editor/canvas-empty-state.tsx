import { Sparkles, Grid3x3, Lock, Rocket } from 'lucide-react';

import { registry } from '@/services';
import type { DiagramNode, DiagramEdge } from '@/types';
import {
  createServerlessApiTemplate,
  createEventDrivenTemplate,
  createSecureVpcTemplate,
  createMicroservicesTemplate,
} from '@/utils';

type CanvasEmptyStateProps = {
  onApplyStarter: (starter: {
    nodes: DiagramNode[];
    edges: DiagramEdge[];
  }) => void;
};

export function CanvasEmptyState({ onApplyStarter }: CanvasEmptyStateProps) {
  const lambdaSvc = registry.find('lambda');
  const s3Svc = registry.find('s3');
  const vpcSvc = registry.find('vpc');
  const sfSvc = registry.find('step-function');

  const LambdaIcon = lambdaSvc?.icon || Sparkles;
  const S3Icon = s3Svc?.icon || Grid3x3;
  const VpcIcon = vpcSvc?.icon || Lock;
  const SfIcon = sfSvc?.icon || Rocket;

  const starters = [
    {
      title: 'Serverless REST API',
      description:
        'API Gateway, Lambda, and DynamoDB for serverless workloads.',
      Icon: LambdaIcon,
      color: lambdaSvc?.accentColor || '#3b82f6',
      create: createServerlessApiTemplate,
    },
    {
      title: 'Event-Driven Processor',
      description:
        'Asynchronous processing using S3 events, SNS topics, and SQS queues.',
      Icon: S3Icon,
      color: s3Svc?.accentColor || '#f59e0b',
      create: createEventDrivenTemplate,
    },
    {
      title: 'Secure VPC Network',
      description:
        'Standard multi-tier layout with Public and Private Subnets in a VPC.',
      Icon: VpcIcon,
      color: vpcSvc?.accentColor || '#10b981',
      create: createSecureVpcTemplate,
    },
    {
      title: 'Microservices Pipeline',
      description:
        'API Proxy routing to private Lambda workers orchestrated via Step Functions.',
      Icon: SfIcon,
      color: sfSvc?.accentColor || '#8b5cf6',
      create: createMicroservicesTemplate,
    },
  ];

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex select-none flex-col items-center justify-center bg-background/30 p-8 backdrop-blur-[2px]">
      <div className="pointer-events-auto flex w-full max-w-5xl select-text flex-col items-center text-center">
        <div className="mb-8 text-center">
          <h1 className="bg-gradient-to-r from-primary to-accent bg-clip-text text-3xl font-extrabold tracking-tight text-foreground">
            Design Your Cloud Infrastructure
          </h1>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
            Choose a production-grade starter template below to begin designing
            your architecture.
          </p>
        </div>

        <div className="mt-12 grid w-full max-w-5xl grid-cols-1 gap-4 text-left sm:grid-cols-2 lg:grid-cols-4">
          {starters.map(({ title, description, Icon, color, create }) => (
            <div
              key={title}
              onClick={() => onApplyStarter(create())}
              className="group relative flex cursor-pointer flex-col items-start rounded-2xl border border-border bg-card/60 p-5 shadow-sm transition-all duration-300 hover:border-primary/50 hover:bg-accent/10"
            >
              <div
                className="mb-4 flex size-10 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110"
                style={{ backgroundColor: `${color}18`, color }}
              >
                <Icon size={20} />
              </div>
              <h3 className="text-sm font-bold text-foreground transition-colors group-hover:text-primary">
                {title}
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground/80">
                {description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
