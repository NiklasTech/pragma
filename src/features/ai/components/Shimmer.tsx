import type { CSSProperties, ElementType } from "react";
import { createElement, memo } from "react";

import { cn } from "@/shared/lib/utils";

export interface TextShimmerProps {
  children: string;
  as?: ElementType;
  className?: string;
  duration?: number;
}

const ShimmerComponent = ({
  children,
  as: Component = "p",
  className,
  duration = 2,
}: TextShimmerProps) =>
  createElement(
    Component,
    {
      className: cn(
        "pragma-shimmer relative inline-block bg-clip-text text-transparent",
        className,
      ),
      style: { "--shimmer-duration": `${duration}s` } as CSSProperties,
    },
    children,
  );

export const Shimmer = memo(ShimmerComponent);
