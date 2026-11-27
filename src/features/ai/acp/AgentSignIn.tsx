import { SignIn, Spinner } from "@phosphor-icons/react";

import { Button } from "@/shared/components/ui/button";
import { useAIStore } from "@/shared/stores/ai";

import { useAcpSignInStore, type AcpSignInMethod } from "./signIn";
import type { CliSessionOptions } from "./useCliSessionOptions";

const NO_METHODS: AcpSignInMethod[] = [];

interface AgentSignInCardProps {
  providerName: string;
  methods: AcpSignInMethod[];
  pending: boolean;
  error: string | null;
  onSignIn: (methodId: string) => void;
}

/// Offers the sign-in methods of a coding CLI that needs a signed-in account.
export function AgentSignInCard({
  providerName,
  methods,
  pending,
  error,
  onSignIn,
}: AgentSignInCardProps) {
  if (methods.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-bg-surface px-3 py-2.5 text-ui-xs">
      <div className="flex items-center gap-2 text-fg-default">
        <SignIn size={14} className="shrink-0 text-fg-muted" />
        <span className="font-medium">{providerName} needs a sign-in.</span>
      </div>
      {pending ? (
        <div className="flex items-center gap-2 text-fg-muted">
          <Spinner size={13} className="animate-spin text-primary motion-reduce:animate-none" />
          <span>Finish the sign-in in your browser. Pragma waits up to 5 minutes.</span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {methods.map((method) => (
            <Button
              key={method.id}
              size="sm"
              variant="secondary"
              title={method.description ?? undefined}
              onClick={() => onSignIn(method.id)}
            >
              Sign in with {method.name}
            </Button>
          ))}
        </div>
      )}
      {error && <span className="text-status-error">{error}</span>}
    </div>
  );
}

/// The sign-in card of the active chat's coding CLI, shown while it needs a sign-in.
export function AgentSignIn({ session }: { session: CliSessionOptions }) {
  const chatSessionId = useAIStore((state) => state.activeChatSessionId);
  const methods = useAcpSignInStore((state) =>
    chatSessionId ? (state.methods[chatSessionId] ?? NO_METHODS) : NO_METHODS,
  );
  const pending = useAcpSignInStore((state) =>
    chatSessionId ? (state.pending[chatSessionId] ?? false) : false,
  );
  const error = useAcpSignInStore((state) =>
    chatSessionId ? (state.errors[chatSessionId] ?? null) : null,
  );
  return (
    <AgentSignInCard
      providerName={session.providerName}
      methods={methods}
      pending={pending}
      error={error}
      onSignIn={session.signIn}
    />
  );
}
