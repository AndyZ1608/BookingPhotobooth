import * as React from "react";

import { cn } from "@/lib/cn";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "min-h-24 w-full rounded-md border border-[#e7cdd5] bg-white px-3 py-2 text-sm text-[#2c1720] outline-none transition placeholder:text-[#9b7b86] focus:border-[#6b1837] focus:ring-2 focus:ring-[#6b1837]/15 disabled:cursor-not-allowed disabled:bg-[#f5e7eb]",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
