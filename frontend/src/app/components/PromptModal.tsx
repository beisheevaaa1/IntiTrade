import React, { useState, useEffect } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Input } from "./ui/input";
import { getApiErrorMessage } from "../../utils/errors";

interface PromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
  isTextarea?: boolean;
  required?: boolean;
  onSubmit: (value: string) => void | Promise<void>;
}

export const PromptModal: React.FC<PromptModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  placeholder = "Enter your reason or comments...",
  defaultValue = "",
  confirmText = "Submit",
  cancelText = "Cancel",
  isTextarea = true,
  required = true,
  onSubmit
}) => {
  const [value, setValue] = useState(defaultValue);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue);
      setError("");
      setLoading(false);
    }
  }, [isOpen, defaultValue]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (required && !value.trim()) {
      setError("Please enter a response before continuing.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await onSubmit(value.trim());
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, "An error occurred while submitting."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !loading) onClose(); }}>
      <DialogContent className="sm:max-w-md bg-white rounded-2xl border border-border shadow-2xl p-6">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl font-bold text-foreground flex items-center gap-2">
              {title}
            </DialogTitle>
            {description && (
              <DialogDescription className="text-sm text-muted-foreground mt-1">
                {description}
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="py-2">
            {isTextarea ? (
              <Textarea
                value={value}
                onChange={(e) => { setValue(e.target.value); if (error) setError(""); }}
                placeholder={placeholder}
                disabled={loading}
                className="min-h-[110px] resize-none text-sm rounded-xl border-border bg-gray-50/50 p-3.5 focus:bg-white"
                autoFocus
              />
            ) : (
              <Input
                value={value}
                onChange={(e) => { setValue(e.target.value); if (error) setError(""); }}
                placeholder={placeholder}
                disabled={loading}
                className="h-11 text-sm rounded-xl border-border bg-gray-50/50 px-3.5 focus:bg-white"
                autoFocus
              />
            )}

            {error && (
              <div className="flex items-center gap-1.5 text-xs text-red-600 mt-2 bg-red-50 p-2.5 rounded-lg border border-red-100">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <DialogFooter className="mt-6 flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl h-11 px-5 font-semibold text-muted-foreground hover:text-foreground"
            >
              {cancelText}
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="rounded-xl h-11 px-6 font-bold shadow-md"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {confirmText}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
