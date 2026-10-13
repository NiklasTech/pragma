import type { ChatSession, WorkEnvironment } from "@/shared/stores/ai";

export function sessionEnvironment(
  session: Pick<ChatSession, "environmentId"> | undefined,
  environments: readonly WorkEnvironment[],
): WorkEnvironment | undefined {
  const id = session?.environmentId;
  return id ? environments.find((environment) => environment.id === id) : undefined;
}

export function sessionCwd(
  session: Pick<ChatSession, "environmentId"> | undefined,
  environments: readonly WorkEnvironment[],
  workspaceRoot: string,
): string {
  const environment = sessionEnvironment(session, environments);
  if (environment?.setupStatus === "ready") return environment.path;
  return workspaceRoot;
}
