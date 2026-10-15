"use client";

import { Fragment, type ReactNode } from "react";

import type { ChatSession } from "@/shared/stores/ai";

import type { ThreadSection } from "./categories";
import { CategoryHeader } from "./CategoryHeader";
import { RepositoryGroupHeader } from "./RepositoryGroupHeader";
import type { RepositoryGroup } from "./repositoryGroups";

interface ThreadGroupListProps {
  groups: RepositoryGroup<ChatSession>[];
  /** Shows a collapsible header per repository; one group without a header otherwise. */
  byRepository: boolean;
  activePath: string | null;
  collapsed: ReadonlySet<string>;
  onToggle: (key: string) => void;
  renderThread: (session: ChatSession) => ReactNode;
}

export function ThreadGroupList({
  groups,
  byRepository,
  activePath,
  collapsed,
  onToggle,
  renderThread,
}: ThreadGroupListProps) {
  const renderSections = (sections: ThreadSection<ChatSession>[]) =>
    sections.map((section) => {
      const isCollapsed = collapsed.has(section.key);
      return (
        <section key={section.key} aria-label={section.label} className="flex flex-col gap-0.5">
          {section.isCategory ? (
            <CategoryHeader
              label={section.label}
              count={section.items.length}
              collapsed={isCollapsed}
              onToggle={() => onToggle(section.key)}
            />
          ) : (
            <h3 className="px-2 pb-0.5 text-ui-2xs font-semibold tracking-wide text-fg-subtle uppercase">
              {section.label}
            </h3>
          )}
          {!isCollapsed && section.items.map(renderThread)}
        </section>
      );
    });

  return (
    <div className="flex flex-col gap-3">
      {groups.map((group) =>
        byRepository ? (
          <section key={group.key} aria-label={group.name} className="flex flex-col gap-1.5">
            <RepositoryGroupHeader
              name={group.name}
              path={group.path}
              count={group.count}
              active={group.path === activePath}
              collapsed={collapsed.has(group.key)}
              onToggle={() => onToggle(group.key)}
            />
            {!collapsed.has(group.key) && (
              <div className="flex flex-col gap-3">{renderSections(group.sections)}</div>
            )}
          </section>
        ) : (
          <Fragment key={group.key}>{renderSections(group.sections)}</Fragment>
        ),
      )}
    </div>
  );
}
