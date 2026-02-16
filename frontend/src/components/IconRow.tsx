import type { LucideIcon } from "lucide-react";

type Props = {
  label: string;
  value: string;
  subtitle?: string;
  icon?: LucideIcon;
};

export function IconRow({ label, value, subtitle, icon: Icon }: Props) {
  return (
    <div className="icon-row">
      <div className="icon-row-left">
        {Icon && <Icon className="row-icon" size={16} aria-hidden="true" />}
        <strong>{label}</strong>
        {subtitle && <small>{subtitle}</small>}
      </div>
      <span>{value}</span>
    </div>
  );
}
