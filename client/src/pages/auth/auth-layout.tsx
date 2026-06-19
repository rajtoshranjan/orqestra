import { Link, Outlet } from 'react-router-dom';

import { OrqestraMark } from '@/components/icons';

export const AuthLayout = () => {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-6 overflow-hidden bg-background p-6 md:p-10">
      {/* Decorative Glow Blobs */}
      <div className="pointer-events-none absolute inset-0 select-none overflow-hidden">
        <div className="animate-pulse-glow absolute -left-1/4 -top-1/4 size-3/5 rounded-full bg-primary/10 blur-[130px]" />
        <div className="absolute -bottom-1/4 -right-1/4 size-3/5 rounded-full bg-primary/10 blur-[130px]" />
      </div>

      <div className="relative z-10 flex w-full max-w-sm flex-col gap-6">
        <Link
          to="/"
          className="group flex items-center gap-2 self-center text-xl font-extrabold tracking-[-0.03em] text-foreground transition-all duration-200 hover:opacity-95"
        >
          <OrqestraMark
            variant="color"
            size={24}
            className="logo-mark-aligned shrink-0"
          />
          Orqestra
        </Link>
        <div className="flex flex-col gap-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
};
