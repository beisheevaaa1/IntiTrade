import React, { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AlertTriangle, CheckCircle2, Loader2, Info, X } from "lucide-react";
import { Button } from "./ui/button";

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "destructive" | "default" | "success";
  onConfirm: () => Promise<void> | void;
}

export function ConfirmModal({
  isOpen,
  onClose,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default",
  onConfirm
}: ConfirmModalProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      console.error("Confirmation action failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const getIcon = () => {
    if (variant === "destructive") {
      return <div className="p-3 bg-red-100 text-red-600 rounded-full shrink-0"><AlertTriangle className="w-6 h-6" /></div>;
    }
    if (variant === "success") {
      return <div className="p-3 bg-green-100 text-green-600 rounded-full shrink-0"><CheckCircle2 className="w-6 h-6" /></div>;
    }
    return <div className="p-3 bg-blue-100 text-blue-600 rounded-full shrink-0"><Info className="w-6 h-6" /></div>;
  };

  const getConfirmButtonClass = () => {
    if (variant === "destructive") return "bg-red-600 hover:bg-red-700 text-white font-semibold";
    if (variant === "success") return "bg-green-600 hover:bg-green-700 text-white font-semibold";
    return "bg-primary hover:bg-primary/90 text-white font-semibold";
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !loading && !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-in fade-in duration-200" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl border border-border z-50 animate-in fade-in zoom-in-95 duration-200 focus:outline-none">
          <div className="flex items-start gap-4 mb-4">
            {getIcon()}
            <div className="flex-1 min-w-0">
              <Dialog.Title className="text-lg font-bold text-gray-900 mb-1">
                {title}
              </Dialog.Title>
              <Dialog.Description className="text-sm text-gray-600 leading-relaxed">
                {description}
              </Dialog.Description>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl font-medium"
            >
              {cancelText}
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              className={`rounded-xl px-5 ${getConfirmButtonClass()}`}
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {confirmText}
            </Button>
          </div>

          <Dialog.Close asChild>
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="absolute top-4 right-4 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
