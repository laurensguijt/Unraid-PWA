import { Boxes, Folder, Gauge, HardDrive, Monitor, type LucideIcon } from "lucide-react";
import type { Tab } from "../../types";

const TAB_LABELS: Record<Tab, string> = {
  overview: "Dash",
  array: "Storage",
  shares: "Shares",
  docker: "Docker",
  vms: "VM",
};

const TABS: Array<{ id: Tab; icon: LucideIcon }> = [
  { id: "overview", icon: Gauge },
  { id: "array", icon: HardDrive },
  { id: "shares", icon: Folder },
  { id: "docker", icon: Boxes },
  { id: "vms", icon: Monitor },
];

type AppTabBarProps = {
  tab: Tab;
  onChange: (tab: Tab) => void;
};

export function AppTabBar({ tab, onChange }: AppTabBarProps) {
  return (
    <nav className="tabbar">
      {TABS.map((item) => (
        <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => onChange(item.id)}>
          <span className="tab-icon">
            <item.icon size={16} />
          </span>
          <span className="tab-label">{TAB_LABELS[item.id]}</span>
        </button>
      ))}
    </nav>
  );
}
