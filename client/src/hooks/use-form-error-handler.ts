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

        const getErrorMessage = (value: any): string | null => {
          if (!value) return null;
          if (Array.isArray(value)) {
            return value[0] ? String(value[0]) : null;
          }
          return String(value);
        };

        const nonFieldMsg =
          getErrorMessage(validationErrors.non_field_errors) ||
          getErrorMessage(validationErrors.detail);

        if (nonFieldMsg) {
          setServerError(nonFieldMsg);
          return;
        }

        Object.entries(validationErrors).forEach(([field, messages]) => {
          if (field === 'detail' || field === 'non_field_errors') return;

          const message = getErrorMessage(messages);
          if (message) {
            setError(field as Path<T>, {
              type: 'server',
              message: message,
            });
            hasSetFieldError = true;
          }
        });

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
