/**
 * Custom Hook for API Calls with Loading and Error States
 * Provides consistent error handling and loading states across components
 */

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { ApiResponse } from '../lib/api-client';

interface UseApiCallOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
  showErrorToast?: boolean;
  showSuccessToast?: boolean;
  successMessage?: string;
}

interface UseApiCallReturn<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  execute: (...args: any[]) => Promise<T | null>;
  reset: () => void;
}

/**
 * Hook for handling API calls with automatic loading and error states
 *
 * @example
 * const { data, loading, error, execute } = useApiCall(apiClient.getUserProfile, {
 *   showErrorToast: true,
 *   onSuccess: (user) => console.log('Loaded user:', user)
 * });
 *
 * // Call it
 * useEffect(() => {
 *   execute();
 * }, []);
 */
export function useApiCall<T = any>(
  apiFunction: (...args: any[]) => Promise<ApiResponse<T>>,
  options: UseApiCallOptions = {}
): UseApiCallReturn<T> {
  const {
    onSuccess,
    onError,
    showErrorToast = true,
    showSuccessToast = false,
    successMessage = 'Success!',
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(
    async (...args: any[]): Promise<T | null> => {
      setLoading(true);
      setError(null);

      try {
        const response = await apiFunction(...args);

        if (response.success && response.data) {
          setData(response.data);
          setLoading(false);

          if (showSuccessToast) {
            toast.success(successMessage);
          }

          if (onSuccess) {
            onSuccess(response.data);
          }

          return response.data;
        } else {
          const errorMessage = response.error?.message || 'An error occurred';
          setError(errorMessage);
          setLoading(false);

          if (showErrorToast) {
            toast.error(errorMessage);
          }

          if (onError) {
            onError(response.error);
          }

          return null;
        }
      } catch (err: any) {
        const errorMessage = err.message || 'Network error';
        setError(errorMessage);
        setLoading(false);

        if (showErrorToast) {
          toast.error(errorMessage);
        }

        if (onError) {
          onError(err);
        }

        return null;
      }
    },
    [apiFunction, onSuccess, onError, showErrorToast, showSuccessToast, successMessage]
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return { data, loading, error, execute, reset };
}

/**
 * Simplified hook for API calls that returns a mutation function
 * Similar to React Query's useMutation
 */
export function useApiMutation<T = any, TVariables = any>(
  apiFunction: (variables: TVariables) => Promise<ApiResponse<T>>,
  options: UseApiCallOptions = {}
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(
    async (variables: TVariables): Promise<T | null> => {
      setLoading(true);
      setError(null);

      try {
        const response = await apiFunction(variables);

        if (response.success && response.data) {
          setLoading(false);

          if (options.showSuccessToast) {
            toast.success(options.successMessage || 'Success!');
          }

          if (options.onSuccess) {
            options.onSuccess(response.data);
          }

          return response.data;
        } else {
          const errorMessage = response.error?.message || 'An error occurred';
          setError(errorMessage);
          setLoading(false);

          if (options.showErrorToast !== false) {
            toast.error(errorMessage);
          }

          if (options.onError) {
            options.onError(response.error);
          }

          return null;
        }
      } catch (err: any) {
        const errorMessage = err.message || 'Network error';
        setError(errorMessage);
        setLoading(false);

        if (options.showErrorToast !== false) {
          toast.error(errorMessage);
        }

        if (options.onError) {
          options.onError(err);
        }

        return null;
      }
    },
    [apiFunction, options]
  );

  return { mutate, loading, error };
}
