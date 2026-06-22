import * as React from "react";

import { cn } from "@/lib/cn";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-11 w-full rounded-md border border-[#e7cdd5] bg-white px-3 text-sm text-[#2c1720] outline-none transition placeholder:text-[#9b7b86] focus:border-[#6b1837] focus:ring-2 focus:ring-[#6b1837]/15 disabled:cursor-not-allowed disabled:bg-[#f5e7eb]",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
