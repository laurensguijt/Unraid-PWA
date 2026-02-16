import { Circle, PauseCircle, TriangleAlert, HelpCircle } from "lucide-react";

type Props = {
  status: "running" | "stopped" | "warning" | "unknown";
  label?: string;
};

export function StatusPill({ status, label }: Props) {
  const cls =
    status === "running" ? "ok" : status === "warning" ? "warning" : status === "stopped" ? "stopped" : "";
  const Icon =
    status === "running"
      ? Circle
      : status === "stopped"
        ? PauseCircle
        : status === "warning"
          ? TriangleAlert
          : HelpCircle;
  return (
    <span className={`pill ${cls}`.trim()}>
      <Icon size={13} aria-hidden="true" />
      {label ?? status}
    </span>
  );
}
