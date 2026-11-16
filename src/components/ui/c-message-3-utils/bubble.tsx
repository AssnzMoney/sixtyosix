import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/*
 * Cores por variável CSS, com padrão claro: quem usa (ex.: o chat do painel) troca
 * --bubble, --bubble-foreground e --bubble-muted no tema escuro.
 * O canto do lado da linha fica menos arredondado, como a "ponta" do balão.
 */
const bubbleVariants = cva(
  "relative max-w-full min-w-0 rounded-2xl text-sm leading-relaxed group-data-[align=end]/message:rounded-br-md group-data-[align=start]/message:rounded-bl-md",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--bubble,#15803d)] text-[var(--bubble-foreground,#ffffff)] shadow-sm",
        muted:
          "border border-[var(--bubble-muted-border,rgba(31,70,71,0.1))] bg-[var(--bubble-muted,#f8f6f0)] text-[var(--bubble-muted-foreground,#1f4647)]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Bubble({
  variant,
  className,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof bubbleVariants>) {
  return (
    <div
      data-slot="bubble"
      data-variant={variant ?? "default"}
      className={cn(bubbleVariants({ variant }), className)}
      {...props}
    />
  );
}

function BubbleContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="bubble-content"
      className={cn(
        "px-3.5 py-2.5 whitespace-pre-wrap [overflow-wrap:anywhere]",
        className,
      )}
      {...props}
    />
  );
}

export { Bubble, BubbleContent, bubbleVariants };
