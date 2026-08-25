"use client";
import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn, initials } from "@/lib/utils";

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root ref={ref} className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full", className)} {...props} />
));
Avatar.displayName = "Avatar";

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback> & { color?: string }
>(({ className, color, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    style={{ backgroundColor: color ?? "#4F46E5" }}
    className={cn("flex h-full w-full items-center justify-center rounded-full text-xs font-semibold text-white", className)}
    {...props}
  />
));
AvatarFallback.displayName = "AvatarFallback";

function UserAvatar({ name, color, className }: { name: string; color?: string; className?: string }) {
  return (
    <Avatar className={className}>
      <AvatarFallback color={color}>{initials(name)}</AvatarFallback>
    </Avatar>
  );
}

export { Avatar, AvatarFallback, UserAvatar };
