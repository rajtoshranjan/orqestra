import { useState, useCallback } from 'react';
import { UseFormSetError, FieldValues, Path } from 'react-hook-form';

/**
 * A custom hook to handle and map Django REST Framework validation and auth errors
 * to React Hook Form fields or a fallback general serverError banner state.
 */
export function useFormErrorHandler<T extends FieldValues>(
  setError: UseFormSetError<T>,
  defaultMessage = 'An unexpected error occurred.',
) {
  const [serverError, setServerError] = useState<string | null>(null);

  const handleErrors = useCallback(
    (error: any) => {
      const validationErrors = error?.response?.data?.errors;
      if (validationErrors && typeof validationErrors === 'object') {
        let hasSetFieldError = false;
        Object.entries(validationErrors).forEach(([field, messages]) => {
          const message = Array.isArray(messages) ? messages[0] : messages;
          if (message) {
            setError(field as Path<T>, {
              type: 'server',
              message: String(message),
            });
            hasSetFieldError = true;
          }
        });

        const nonFieldMsg =
          validationErrors.non_field_errors?.[0] ||
          validationErrors.detail?.[0] ||
          validationErrors.detail;

        if (nonFieldMsg) {
          setServerError(String(nonFieldMsg));
          return;
        }

        if (hasSetFieldError) {
          return;
        }
      }

      const detail =
        error?.response?.data?.meta?.message ||
        error?.meta?.message ||
        defaultMessage;
      setServerError(detail);
    },
    [setError, defaultMessage],
  );

  const clearServerError = useCallback(() => {
    setServerError(null);
  }, []);

  return {
    serverError,
    setServerError,
    handleErrors,
    clearServerError,
  };
}
