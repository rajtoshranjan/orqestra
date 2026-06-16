import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';

import { useSignup } from '@/api/auth';
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
import { useFormErrorHandler } from '@/hooks';

const signupSchema = z
  .object({
    name: z
      .string()
      .min(2, 'Name must be at least 2 characters')
      .max(100, 'Name must be less than 100 characters'),
    email: z.string().email('Invalid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'Password must contain uppercase, lowercase and numbers',
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type SignupFormData = z.infer<typeof signupSchema>;

export function SignUpPage() {
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
  });

  const { serverError, handleErrors, clearServerError } =
    useFormErrorHandler<SignupFormData>(
      setError,
      'Failed to sign up. Email may already be in use.',
    );

  const { mutate: signup, isPending } = useSignup();

  const onSubmit = (data: SignupFormData) => {
    clearServerError();
    signup(data, {
      onSuccess: () => {
        navigate('/login');
      },
      onError: handleErrors,
    });
  };

  return (
    <Card className="border-border bg-card shadow-lg">
      <CardHeader className="text-center">
        <CardTitle className="text-xl font-bold tracking-tight text-foreground">
          Sign up
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          Create a new account to get started
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
          <div className="grid gap-1.5">
            <label
              htmlFor="name"
              className="text-xs font-semibold text-foreground"
            >
              Name
            </label>
            <Input
              {...register('name')}
              id="name"
              type="text"
              placeholder="John Doe"
              className="border-input text-foreground focus-visible:ring-primary"
            />
            {errors.name?.message && (
              <p className="text-[10px] text-destructive">
                {errors.name.message}
              </p>
            )}
          </div>
          <div className="grid gap-1.5">
            <label
              htmlFor="email"
              className="text-xs font-semibold text-foreground"
            >
              Email address
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
          <div className="grid gap-1.5">
            <label
              htmlFor="confirmPassword"
              className="text-xs font-semibold text-foreground"
            >
              Confirm password
            </label>
            <Input
              {...register('confirmPassword')}
              id="confirmPassword"
              type="password"
              placeholder="••••••••"
              className="border-input text-foreground focus-visible:ring-primary"
            />
            {errors.confirmPassword?.message && (
              <p className="text-[10px] text-destructive">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>
          {serverError && (
            <div className="rounded-md bg-destructive/10 p-2 text-left text-xs text-destructive">
              {serverError}
            </div>
          )}
          <Button
            type="submit"
            className="mt-2 w-full text-xs font-semibold"
            disabled={isPending}
          >
            {isPending ? 'Signing up…' : 'Sign up'}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center border-t border-border/50 pt-4">
        <p className="text-xs text-muted-foreground">
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-medium text-primary hover:underline"
          >
            Log in
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
