import { cn } from "@/shared/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-[4px] bg-bg-hover", className)}
      {...props}
    />
  );
}

export { Skeleton };
