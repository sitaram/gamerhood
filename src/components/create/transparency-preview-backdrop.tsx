import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Standard light checkerboard so transparent + soft-edge pixels read like a design tool. */
const CHECKER_STYLE: CSSProperties = {
  backgroundColor: "#ffffff",
  backgroundImage: `
    linear-gradient(45deg, #d4d4d4 25%, transparent 25%),
    linear-gradient(-45deg, #d4d4d4 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #d4d4d4 75%),
    linear-gradient(-45deg, transparent 75%, #d4d4d4 75%)`,
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
};

export function TransparencyPreviewBackdrop({
  active,
  className,
  children,
}: {
  /** When true, show a checkerboard instead of the flat muted panel. */
  active: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn(className, !active && "bg-muted")} style={active ? CHECKER_STYLE : undefined}>
      {children}
    </div>
  );
}
