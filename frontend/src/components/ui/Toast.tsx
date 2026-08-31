import React from 'react';
import { useToast, ToastMessage } from '../../context/ToastContext';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';

const icons = {
  success: <CheckCircle2 className="w-5 h-5 text-accent shrink-0" />,
  error: <AlertCircle className="w-5 h-5 text-destructive shrink-0" />,
  warning: <AlertTriangle className="w-5 h-5 text-chart-4 shrink-0" />,
  info: <Info className="w-5 h-5 text-chart-2 shrink-0" />,
};

const borderStyles = {
  success: 'border-accent/40 bg-card text-foreground',
  error: 'border-destructive/40 bg-card text-foreground',
  warning: 'border-chart-4/40 bg-card text-foreground',
  info: 'border-chart-2/40 bg-card text-foreground',
};

export const ToastItem: React.FC<{ toast: ToastMessage }> = ({ toast }) => {
  const { removeToast } = useToast();

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-xl border shadow-lg transition-all duration-300 max-w-md w-full ${borderStyles[toast.type]}`}
    >
      {icons[toast.type]}
      <div className="flex-1 text-sm font-medium leading-relaxed">{toast.message}</div>
      <button
        type="button"
        onClick={() => removeToast(toast.id)}
        className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted"
        aria-label="Close notification"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export const ToastContainer: React.FC = () => {
  const { toasts } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none px-4">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} />
        </div>
      ))}
    </div>
  );
};
