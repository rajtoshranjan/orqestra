import { useState, useEffect } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Moon, Sun, User, Palette, KeyRound } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useGetUserInfo, useUpdateProfile, useChangePassword } from '@/api';
import { PageLayout } from '@/components';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Button,
  Input,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui';
import { useFormErrorHandler } from '@/hooks';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useAppDispatch, useAppSelector } from '@/store';
import { setTheme } from '@/store/ui-slice';
import { getInitials } from '@/utils';

const themeOptions = [
  {
    value: 'dark',
    label: 'Dark',
    description: 'Use the darker canvas-oriented interface.',
    icon: Moon,
  },
  {
    value: 'light',
    label: 'Light',
    description: 'Use the brighter workspace interface.',
    icon: Sun,
  },
] as const;

const profileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
});

type ProfileFormData = z.infer<typeof profileSchema>;

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password is too long')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'Password must contain uppercase, lowercase and numbers',
      ),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type PasswordFormData = z.infer<typeof passwordSchema>;

export function Preferences() {
  const dispatch = useAppDispatch();
  const theme = useAppSelector((state) => state.ui.theme);

  const { data: user } = useGetUserInfo();
  const updateProfileMutation = useUpdateProfile();
  const changePasswordMutation = useChangePassword();
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  // Profile Form Hook
  const {
    register: registerProfile,
    handleSubmit: handleSubmitProfile,
    reset: resetProfile,
    setError: setProfileError,
    formState: { errors: errorsProfile, isDirty: isProfileDirty },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: '',
    },
  });

  // Populate Name when loaded
  useEffect(() => {
    if (user?.name) {
      resetProfile({
        name: user.name,
      });
    }
  }, [user, resetProfile]);

  const {
    serverError: profileServerError,
    handleErrors: handleProfileErrors,
    clearServerError: clearProfileServerError,
  } = useFormErrorHandler<ProfileFormData>(
    setProfileError,
    'Failed to update profile details.',
  );

  const onSubmitProfile = (data: ProfileFormData) => {
    clearProfileServerError();
    updateProfileMutation.mutate(
      { name: data.name },
      {
        onSuccess: () => {
          toast({
            title: 'Success',
            description: 'Profile details updated successfully.',
          });
          resetProfile({ name: data.name });
        },
        onError: handleProfileErrors,
      },
    );
  };

  // Password Form Hook
  const {
    register: registerPassword,
    handleSubmit: handleSubmitPassword,
    reset: resetPassword,
    setError: setPasswordError,
    formState: { errors: errorsPassword },
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const {
    serverError: passwordServerError,
    handleErrors: handlePasswordErrors,
    clearServerError: clearPasswordServerError,
  } = useFormErrorHandler<PasswordFormData>(
    setPasswordError,
    'Failed to change password.',
  );

  const onSubmitPassword = (data: PasswordFormData) => {
    clearPasswordServerError();

    changePasswordMutation.mutate(data, {
      onSuccess: () => {
        toast({
          title: 'Success',
          description: 'Password changed successfully.',
        });
        setIsChangePasswordOpen(false);
      },
      onError: (error: any) => {
        // Map backend snake_case errors keys to frontend camelCase keys before handling
        if (error?.response?.data?.errors) {
          const originalErrors = error.response.data.errors;
          const mappedErrors: Record<string, any> = {};
          if (originalErrors.current_password) {
            mappedErrors.currentPassword = originalErrors.current_password;
          }
          if (originalErrors.new_password) {
            mappedErrors.newPassword = originalErrors.new_password;
          }
          error.response.data.errors = mappedErrors;
        }
        handlePasswordErrors(error);
      },
    });
  };

  // Reset password form state when Modal closes
  useEffect(() => {
    if (!isChangePasswordOpen) {
      resetPassword({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      clearPasswordServerError();
    }
  }, [isChangePasswordOpen, resetPassword, clearPasswordServerError]);

  return (
    <PageLayout
      title="Preferences"
      description="Manage workspace preferences for the project dashboard and editor."
      maxWidthClass="max-w-5xl"
    >
      <Tabs defaultValue="profile" className="space-y-6">
        {/* Horizontal Tabs Header */}
        <TabsList className="grid h-auto w-full max-w-md grid-cols-2 rounded-lg border border-border bg-card p-1">
          <TabsTrigger
            value="profile"
            className="flex items-center gap-1.5 rounded-md py-1.5 text-xs"
          >
            <User className="size-3.5" />
            Profile Settings
          </TabsTrigger>
          <TabsTrigger
            value="appearance"
            className="flex items-center gap-1.5 rounded-md py-1.5 text-xs"
          >
            <Palette className="size-3.5" />
            Appearance
          </TabsTrigger>
        </TabsList>

        {/* Profile Settings Content */}
        <TabsContent
          value="profile"
          className="space-y-6 pt-4 outline-none duration-200 animate-in fade-in focus-visible:ring-0"
        >
          {/* Personal Details Card */}
          <Card className="max-w-2xl rounded-xl border border-border bg-card shadow-none">
            <CardHeader className="p-5">
              <CardTitle className="text-base font-bold text-foreground">
                Personal Details
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Update your account display name and view your registered email
                address.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 p-5 pt-0">
              {/* Initials Avatar Showcase */}
              <div className="flex items-center gap-4 border-b border-border/30 pb-4">
                <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 text-lg font-extrabold text-white shadow-md">
                  {getInitials(user?.name || 'U')}
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-foreground">
                    Your Avatar
                  </h4>
                  <p className="text-[10px] text-muted-foreground">
                    Generated dynamically from your initials
                  </p>
                </div>
              </div>

              <form
                onSubmit={handleSubmitProfile(onSubmitProfile)}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <label
                    htmlFor="email"
                    className="text-xs font-bold text-muted-foreground"
                  >
                    Email Address
                  </label>
                  <Input
                    id="email"
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="h-9 cursor-not-allowed border-border bg-muted/30 text-xs text-muted-foreground"
                  />
                  <p className="text-[10px] leading-normal text-muted-foreground/60">
                    Your email address is managed as a login identifier and
                    cannot be modified.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="name"
                    className="text-xs font-bold text-muted-foreground"
                  >
                    Display Name
                  </label>
                  <Input
                    id="name"
                    {...registerProfile('name')}
                    placeholder="Your Name"
                    className="h-9 border-border bg-background/30 text-xs text-foreground focus-visible:ring-primary"
                  />
                  {errorsProfile.name?.message && (
                    <p className="text-[10px] text-destructive">
                      {errorsProfile.name.message}
                    </p>
                  )}
                </div>

                {profileServerError && (
                  <div className="rounded-md bg-destructive/10 p-2.5 text-left text-xs text-destructive">
                    {profileServerError}
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <Button
                    type="submit"
                    className="h-8 px-4 text-xs font-semibold"
                    disabled={
                      updateProfileMutation.isPending || !isProfileDirty
                    }
                  >
                    {updateProfileMutation.isPending
                      ? 'Saving...'
                      : 'Save Changes'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Change Password Card */}
          <Card className="max-w-2xl rounded-xl border border-border bg-card shadow-none">
            <CardHeader className="p-5">
              <CardTitle className="text-base font-bold text-foreground">
                Password & Security
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Ensure your account is using a long, random password to stay
                secure.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              <div className="mt-2 flex items-center justify-between gap-4 border-t border-border/40 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/20 text-muted-foreground">
                    <KeyRound className="size-5" />
                  </div>
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold text-foreground">
                      Account Password
                    </h4>
                    <p className="text-[10px] text-muted-foreground">
                      Update the password used to log in to your account.
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsChangePasswordOpen(true)}
                  className="h-8 shrink-0 px-3 text-xs font-semibold"
                >
                  Change Password
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appearance Tab */}
        <TabsContent
          value="appearance"
          className="space-y-6 pt-4 outline-none duration-200 animate-in fade-in focus-visible:ring-0"
        >
          <Card className="max-w-2xl rounded-xl border border-border bg-card shadow-none">
            <CardHeader className="p-5">
              <CardTitle className="text-base font-bold text-foreground">
                Theme Settings
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Choose the color mode used across the workspace. Customise the
                interface styling to your preference.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              <div className="mt-2 grid gap-3 border-t border-border/40 pt-2 sm:grid-cols-2">
                {themeOptions.map((option) => {
                  const Icon = option.icon;
                  const active = theme === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => dispatch(setTheme(option.value))}
                      aria-pressed={active}
                      className={cn(
                        'flex min-h-[96px] items-start gap-3 rounded-lg border p-3 text-left transition-all duration-200',
                        active
                          ? 'border-primary bg-primary/5 text-foreground ring-1 ring-primary'
                          : 'border-border bg-card text-muted-foreground hover:border-[var(--color-border-hover)] hover:bg-muted hover:text-foreground',
                      )}
                    >
                      <span
                        className={cn(
                          'flex size-9 shrink-0 items-center justify-center rounded-md border',
                          active
                            ? 'border-primary/30 bg-primary text-primary-foreground'
                            : 'border-border bg-card text-muted-foreground',
                        )}
                      >
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">
                          {option.label}
                        </span>
                        <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                          {option.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Change Password Dialog Modal */}
      <Dialog
        open={isChangePasswordOpen}
        onOpenChange={setIsChangePasswordOpen}
      >
        <DialogContent className="border-border bg-card text-foreground sm:max-w-md">
          <DialogHeader className="space-y-1.5 pb-2">
            <DialogTitle className="flex items-center gap-2 text-sm font-bold text-foreground">
              <KeyRound className="size-4 text-primary" />
              Change Password
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Please enter your current password and choose a new secure
              password.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={handleSubmitPassword(onSubmitPassword)}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <label
                htmlFor="currentPassword"
                className="text-xs font-bold text-muted-foreground"
              >
                Current Password
              </label>
              <Input
                id="currentPassword"
                type="password"
                {...registerPassword('currentPassword')}
                placeholder="••••••••"
                className="h-9 border-border bg-background/30 text-xs text-foreground focus-visible:ring-primary"
              />
              {errorsPassword.currentPassword?.message && (
                <p className="text-[10px] text-destructive">
                  {errorsPassword.currentPassword.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="newPassword"
                className="text-xs font-bold text-muted-foreground"
              >
                New Password
              </label>
              <Input
                id="newPassword"
                type="password"
                {...registerPassword('newPassword')}
                placeholder="••••••••"
                className="h-9 border-border bg-background/30 text-xs text-foreground focus-visible:ring-primary"
              />
              {errorsPassword.newPassword?.message && (
                <p className="text-[10px] text-destructive">
                  {errorsPassword.newPassword.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="confirmPassword"
                className="text-xs font-bold text-muted-foreground"
              >
                Confirm New Password
              </label>
              <Input
                id="confirmPassword"
                type="password"
                {...registerPassword('confirmPassword')}
                placeholder="••••••••"
                className="h-9 border-border bg-background/30 text-xs text-foreground focus-visible:ring-primary"
              />
              {errorsPassword.confirmPassword?.message && (
                <p className="text-[10px] text-destructive">
                  {errorsPassword.confirmPassword.message}
                </p>
              )}
            </div>

            {passwordServerError && (
              <div className="rounded-md bg-destructive/10 p-2.5 text-left text-xs text-destructive">
                {passwordServerError}
              </div>
            )}

            <DialogFooter className="gap-2 border-t border-border/40 pt-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsChangePasswordOpen(false);
                }}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="h-8 text-xs font-semibold"
                disabled={changePasswordMutation.isPending}
              >
                {changePasswordMutation.isPending
                  ? 'Updating...'
                  : 'Update Password'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
