import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-neutral-900 text-neutral-50 shadow dark:bg-neutral-50 dark:text-neutral-900',
        secondary:
          'border-transparent bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-50',
        destructive:
          'border-transparent bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-50',
        outline: 'text-neutral-950 border-neutral-200 dark:text-neutral-50 dark:border-neutral-800',
        success: 'border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
        info: 'border-transparent bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
        warning: 'border-transparent bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
