"use client";

import { Toaster as Sonner } from "sonner";
import { CheckCircle, Info, Warning, XCircle, Loader2 } from "lucide-react";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      icons={{
        success: <CheckCircle className="size-4 text-status-success" />,
        info: <Info className="size-4 text-primary" />,
        warning: <Warning className="size-4 text-status-warning" />,
        error: <XCircle className="size-4 text-status-error" />,
        loading: <Loader2 className="size-4 animate-spin text-primary" />,
      }}
      style={
        {
          "--normal-bg": "var(--color-bg-elevated)",
          "--normal-text": "var(--color-fg-default)",
          "--normal-border": "var(--color-border)",
          "--border-radius": "var(--radius-lg)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast glass-strong",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
