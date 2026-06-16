"use client";

import * as React from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import { CheckCircle, Info, Warning, XCircle, Spinner } from "@phosphor-icons/react";

function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      icons={{
        success: <CheckCircle className="size-4 text-status-success" />,
        info: <Info className="size-4 text-primary" />,
        warning: <Warning className="size-4 text-status-warning" />,
        error: <XCircle className="size-4 text-status-error" />,
        loading: <Spinner className="size-4 animate-spin text-primary" />,
      }}
      style={
        {
          "--normal-bg": "var(--color-bg-elevated)",
          "--normal-text": "var(--color-fg-default)",
          "--normal-border": "var(--color-border)",
          "--border-radius": "var(--radius-md)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
