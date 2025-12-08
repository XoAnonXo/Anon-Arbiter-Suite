/**
 * Toast Notifications Component
 * 
 * Uses sonner for elegant toast notifications.
 * Styled to match the app's dark theme.
 */
import { Toaster, toast } from 'sonner';

// Toast container component - add this to your app root
export function ToastProvider() {
  return (
    <Toaster 
      position="bottom-right"
      toastOptions={{
        style: {
          background: 'rgba(18, 18, 26, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          color: '#f0f0f5',
          backdropFilter: 'blur(10px)',
        },
        className: 'toast-notification',
      }}
      theme="dark"
      richColors
      closeButton
    />
  );
}

// Transaction toast helpers
export const txToast = {
  /**
   * Show a loading toast for a pending transaction
   */
  pending: (message: string, description?: string) => {
    return toast.loading(message, {
      description,
      duration: Infinity,
    });
  },

  /**
   * Update a toast to show success
   */
  success: (toastId: string | number, message: string, description?: string, txHash?: string) => {
    toast.success(message, {
      id: toastId,
      description: description || (txHash ? `TX: ${txHash.slice(0, 10)}...${txHash.slice(-8)}` : undefined),
      duration: 5000,
      action: txHash ? {
        label: 'View',
        onClick: () => window.open(`https://sonicscan.org/tx/${txHash}`, '_blank'),
      } : undefined,
    });
  },

  /**
   * Update a toast to show error
   */
  error: (toastId: string | number, message: string, description?: string) => {
    toast.error(message, {
      id: toastId,
      description,
      duration: 5000,
    });
  },

  /**
   * Dismiss a specific toast
   */
  dismiss: (toastId: string | number) => {
    toast.dismiss(toastId);
  },

  /**
   * Show an info toast
   */
  info: (message: string, description?: string) => {
    return toast.info(message, {
      description,
      duration: 4000,
    });
  },
};

// Re-export toast for direct usage
export { toast };

