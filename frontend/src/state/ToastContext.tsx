import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { ConfirmModal, type ConfirmModalProps } from "../app/components/ConfirmModal";

export interface ToastItem {
  id: string;
  message: string;
  type: "success" | "error" | "info";
  duration?: number;
}

export interface ConfirmOptions {
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "destructive" | "default" | "success";
  onConfirm: () => Promise<void> | void;
}

export interface ToastContextType {
  toast: {
    success: (message: string, duration?: number) => void;
    error: (message: string, duration?: number) => void;
    info: (message: string, duration?: number) => void;
    show: (message: string, type?: "success" | "error" | "info", duration?: number) => void;
  };
  confirm: (options: ConfirmOptions) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmConfig, setConfirmConfig] = useState<ConfirmOptions | null>(null);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "info", duration = 4000) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type, duration }]);
  }, []);

  const toast = React.useMemo(() => ({
    success: (message: string, duration?: number) => showToast(message, "success", duration),
    error: (message: string, duration?: number) => showToast(message, "error", duration),
    info: (message: string, duration?: number) => showToast(message, "info", duration),
    show: showToast
  }), [showToast]);

  const confirm = useCallback((options: ConfirmOptions) => {
    setConfirmConfig(options);
  }, []);

  return (
    <ToastContext.Provider value={{ toast, confirm }}>
      {children}

      {/* Floating Toast Container */}
      <div className="fixed top-6 right-6 z-[100] flex flex-col gap-3 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((item) => (
          <ToastCard key={item.id} item={item} onRemove={() => removeToast(item.id)} />
        ))}
      </div>

      {/* Global Confirm Modal */}
      {confirmConfig && (
        <ConfirmModal
          isOpen={Boolean(confirmConfig)}
          onClose={() => setConfirmConfig(null)}
          title={confirmConfig.title}
          description={confirmConfig.description}
          confirmText={confirmConfig.confirmText}
          cancelText={confirmConfig.cancelText}
          variant={confirmConfig.variant}
          onConfirm={confirmConfig.onConfirm}
        />
      )}
    </ToastContext.Provider>
  );
}

function ToastCard({ item, onRemove }: { item: ToastItem; onRemove: () => void }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove();
    }, item.duration || 4000);
    return () => clearTimeout(timer);
  }, [item, onRemove]);

  const getStyle = () => {
    if (item.type === "success") {
      return {
        bg: "bg-white border-green-200 text-green-900 shadow-green-500/10",
        icon: <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />,
        bar: "bg-green-500"
      };
    }
    if (item.type === "error") {
      return {
        bg: "bg-white border-red-200 text-red-900 shadow-red-500/10",
        icon: <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />,
        bar: "bg-red-500"
      };
    }
    return {
      bg: "bg-white border-blue-200 text-blue-900 shadow-blue-500/10",
      icon: <Info className="w-5 h-5 text-blue-600 shrink-0" />,
      bar: "bg-blue-500"
    };
  };

  const style = getStyle();

  return (
    <div className={`pointer-events-auto border rounded-xl p-4 shadow-xl ${style.bg} flex items-start gap-3 relative overflow-hidden animate-in slide-in-from-top-2 fade-in duration-200`}>
      {style.icon}
      <div className="flex-1 text-sm font-medium leading-tight pr-6">
        {item.message}
      </div>
      <button
        onClick={onRemove}
        className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-md"
      >
        <X className="w-4 h-4" />
      </button>
      <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${style.bar} opacity-40`} />
    </div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
