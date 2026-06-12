import { Hexagon } from 'lucide-react';
import { Link, Outlet } from 'react-router-dom';

export const AuthLayout = () => {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-6 overflow-hidden bg-[var(--color-bg-base)] p-6 md:p-10">
      {/* Decorative Glow Blobs */}
      <div className="pointer-events-none absolute inset-0 select-none overflow-hidden">
        <div className="animate-pulse-glow absolute -left-1/4 -top-1/4 size-3/5 rounded-full bg-primary/10 blur-[130px]" />
        <div className="absolute -bottom-1/4 -right-1/4 size-3/5 rounded-full bg-primary/10 blur-[130px]" />
      </div>

      <div className="relative z-10 flex w-full max-w-sm flex-col gap-6">
        <Link
          to="/"
          className="flex items-center gap-2.5 self-center text-lg font-bold tracking-tight text-foreground transition-opacity hover:opacity-90"
        >
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm shadow-primary/20">
            <Hexagon className="animate-spin-slow size-4" />
          </span>
          Orqestra
        </Link>
        <div className="flex flex-col gap-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
};
