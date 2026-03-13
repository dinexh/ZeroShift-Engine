import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        active: "border-indigo-500/30 bg-indigo-500/15 text-indigo-400",
        deploying: "border-amber-500/30 bg-amber-500/15 text-amber-400 animate-pulse",
        failed: "border-red-500/30 bg-red-500/15 text-red-400",
        rolled_back: "border-zinc-500/30 bg-zinc-500/15 text-zinc-400",
        pending: "border-zinc-700/30 bg-zinc-800/30 text-zinc-500",
        blue: "border-blue-500/30 bg-blue-500/15 text-blue-400",
        green: "border-indigo-500/30 bg-indigo-500/15 text-indigo-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
