import * as React from "react";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import { cn } from "@/shared/lib/utils";
import { CaretRight, DotsThree } from "@phosphor-icons/react";

function Breadcrumb({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      aria-label="breadcrumb"
      data-slot="breadcrumb"
      className={cn("flex", className)}
      {...props}
    />
  );
}

function BreadcrumbList({ className, ...props }: React.ComponentProps<"ol">) {
  return (
    <ol
      data-slot="breadcrumb-list"
      className={cn(
        "flex flex-wrap items-center gap-0.5 text-ui-xs text-fg-subtle wrap-break-word",
        className,
      )}
      {...props}
    />
  );
}

function BreadcrumbItem({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="breadcrumb-item"
      className={cn("inline-flex items-center gap-0.5", className)}
      {...props}
    />
  );
}

function BreadcrumbLink({
  className,
  asChild,
  render,
  children,
  ...props
}: useRender.ComponentProps<"a"> & {
  asChild?: boolean;
  children?: React.ReactNode;
}) {
  return useRender({
    defaultTagName: "a",
    props: mergeProps<"a">(
      {
        className: cn(
          "rounded-sm px-1 py-0.5 text-fg-subtle transition-colors duration-150 hover:bg-bg-hover hover:text-fg-default",
          className,
        ),
      },
      props,
    ),
    render: asChild && React.isValidElement(children) ? children : render,
    state: {
      slot: "breadcrumb-link",
    },
  });
}

function BreadcrumbPage({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="breadcrumb-page"
      role="link"
      aria-disabled="true"
      aria-current="page"
      className={cn("rounded-sm px-1 py-0.5 font-medium text-fg-default", className)}
      {...props}
    />
  );
}

function BreadcrumbSeparator({ children, className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="breadcrumb-separator"
      role="presentation"
      aria-hidden="true"
      className={cn("px-0.5 text-fg-subtle/40 [&>svg]:size-3", className)}
      {...props}
    >
      {children ?? <CaretRight />}
    </li>
  );
}

function BreadcrumbEllipsis({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="breadcrumb-ellipsis"
      role="presentation"
      aria-hidden="true"
      className={cn(
        "flex size-4 items-center justify-center rounded-sm text-fg-subtle [&>svg]:size-3.5",
        className,
      )}
      {...props}
    >
      <DotsThree />
      <span className="sr-only">More</span>
    </span>
  );
}

export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
};
