import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
} from '@/components/ui';
import { localStorageManager } from '@/lib/utils/local-storage-manager';
import { useLogin, useOrganisations } from '@/api/auth';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const { mutate: login, isPending } = useLogin();
  const { refetch: fetchOrgs } = useOrganisations(false);

  const onSubmit = (data: LoginFormData) => {
    setServerError(null);
    login(data, {
      onSuccess: async (response) => {
        // SimpleJWT token pairing returns access & refresh inside data.
        const access = response?.data?.access;
        const refresh = response?.data?.refresh;

        if (access && refresh) {
          localStorageManager.setToken(access);
          localStorageManager.setRefreshToken(refresh);

          // Get organisations to set the active organisation ID.
          try {
            const orgsRes = await fetchOrgs();
            const orgs = orgsRes.data;
            if (orgs && orgs.length > 0) {
              localStorageManager.setActiveOrgId(orgs[0].id);
            }
          } catch (err) {
            console.error('Failed to pre-fetch organisations:', err);
          }

          navigate('/');
        } else {
          setServerError('Invalid server response payload.');
        }
      },
      onError: (error: any) => {
        const detail =
          error?.response?.data?.meta?.message ||
          error?.meta?.message ||
          'Invalid credentials. Please try again.';
        setServerError(detail);
      },
    });
  };

  return (
    <Card className="border-border bg-[var(--color-bg-surface)] shadow-lg">
      <CardHeader className="text-center">
        <CardTitle className="text-xl font-bold tracking-tight text-foreground">
          Welcome back
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          Login with your email and password
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-1.5">
            <label
              htmlFor="email"
              className="text-xs font-semibold text-foreground"
            >
              Email Address
            </label>
            <Input
              {...register('email')}
              id="email"
              type="email"
              placeholder="name@example.com"
              className="border-input text-foreground focus-visible:ring-primary"
            />
            {errors.email?.message && (
              <p className="text-[10px] text-destructive">
                {errors.email.message}
              </p>
            )}
          </div>
          <div className="grid gap-1.5">
            <label
              htmlFor="password"
              className="text-xs font-semibold text-foreground"
            >
              Password
            </label>
            <Input
              {...register('password')}
              id="password"
              type="password"
              placeholder="••••••••"
              className="border-input text-foreground focus-visible:ring-primary"
            />
            {errors.password?.message && (
              <p className="text-[10px] text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>
          {serverError && (
            <div className="rounded-md bg-destructive/10 p-2 text-center text-xs text-destructive">
              {serverError}
            </div>
          )}
          <Button
            type="submit"
            className="mt-2 w-full text-xs font-semibold"
            disabled={isPending}
          >
            {isPending ? 'Logging in...' : 'Login'}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center border-t border-border/50 pt-4">
        <p className="text-xs text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link
            to="/signup"
            className="font-medium text-primary hover:underline"
          >
            Sign up
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
