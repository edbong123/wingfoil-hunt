"use client";
import { useFormStatus } from "react-dom";

export function SubmitButton({ children, className, disabled }: { children: React.ReactNode; className?: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={disabled || pending}>
      {pending ? "..." : children}
    </button>
  );
}
