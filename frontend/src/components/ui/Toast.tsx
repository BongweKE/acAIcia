import React from 'react';
import { useToast, ToastMessage } from '../../context/ToastContext';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';

const icons = {
  success: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
  error: <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />,
  warning: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />,
  info: <Info className="w-5 h-5 text-blue-400 shrink-0" />,
};

const borderStyles = {
  success: 'border-emerald-500/40 bg-forest-800/90 text-emerald-100',
  error: 'border-rose-500/40 bg-forest-800/90 text-rose-100',
  warning: 'border-amber-500/40 bg-forest-800/90 text-amber-100',
  info: 'border-blue-500/40 bg-forest-800/90 text-blue-100',
};

export const ToastItem: React.FC<{ toast: ToastMessage }> = ({ toast }) => {
  const { removeToast } = useToast();

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-lg border backdrop-blur-md shadow-lg transition-all duration-300 max-w-md w-full ${borderStyles[toast.type]}`}
    >
      {icons[toast.type]}
      <div className="flex-1 text-sm font-medium leading-relaxed">{toast.message}</div>
      <button
        onClick={() => removeToast(toast.id)}
        className="text-gray-400 hover:text-white transition-colors p-1 rounded-md hover:bg-white/10"
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
