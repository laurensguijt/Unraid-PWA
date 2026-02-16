import { PropsWithChildren } from "react";

type Props = PropsWithChildren<{ className?: string }>;

export function FrostedCard({ className, children }: Props) {
  return <article className={`card ${className ?? ""}`.trim()}>{children}</article>;
}
