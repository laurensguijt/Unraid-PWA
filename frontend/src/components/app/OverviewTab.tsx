import {
  Activity,
  Archive,
  Bell,
  BellRing,
  CircleX,
  Cpu,
  Gauge,
  HardDrive,
  LayoutGrid,
  MemoryStick,
  Network,
  Thermometer,
} from "lucide-react";
import { formatRelativeDaysAgo, formatUnraidLine, formatUpsRuntime } from "../../lib/ui";
import type { Overview } from "../../types";
import { BadgePill } from "../BadgePill";
import { FrostedCard } from "../FrostedCard";
import { IconRow } from "../IconRow";
import { ProgressBar } from "../ProgressBar";
import { SectionHeader } from "../SectionHeader";
import { StatusPill } from "../StatusPill";
import { UrlValue } from "./UrlValue";

type OverviewTabProps = {
  overview: Overview;
  canWriteControls: boolean;
  archivingNotificationId: string | null;
  onArchiveNotification: (notificationId: string) => void;
};

export function OverviewTab({
  overview,
  canWriteControls,
  archivingNotificationId,
  onArchiveNotification,
}: OverviewTabProps) {
  return (
    <>
      <FrostedCard>
        <SectionHeader title="Usage" />
        <IconRow label="CPU" value={`${overview.cpuPercent}%`} icon={Cpu} />
        <ProgressBar value={overview.cpuPercent} />
        <small>
          {overview.cpuModel} - {overview.cpuCores || "?"} cores / {overview.cpuThreads || "?"} threads @{" "}
          {overview.cpuSpeedGhz ? `${overview.cpuSpeedGhz.toFixed(2)} GHz` : "-"}
        </small>
        <IconRow label="Memory" value={`${overview.memoryPercent}%`} icon={MemoryStick} />
        <ProgressBar value={overview.memoryPercent} />
        <small>
          {overview.memoryUsed} / {overview.memoryTotal} Used (apps)
        </small>
        <small>
          Available: {overview.memoryAvailable} | Cache: {overview.memoryCache} | Free: {overview.memoryFree}
        </small>
      </FrostedCard>

      <FrostedCard>
        <SectionHeader title="System" />
        <IconRow label="Hostname" value={overview.hostname} icon={Network} />
        <IconRow label="Uptime" value={overview.uptime} icon={Activity} />
        <IconRow label="Motherboard" value={overview.motherboard} icon={HardDrive} />
        <IconRow
          label="Unraid"
          value={formatUnraidLine(overview.osDistro, overview.licenseType, overview.unraidVersion)}
          icon={HardDrive}
        />
        <IconRow label="Kernel" value={overview.kernelVersion} icon={Cpu} />
      </FrostedCard>

      <FrostedCard>
        <SectionHeader title="Array Health" />
        <IconRow label="State" value={overview.arrayState} icon={HardDrive} />
        <IconRow label="Used" value={overview.arrayUsed} icon={Gauge} />
        <IconRow label="Free" value={overview.arrayFree} icon={CircleX} />
        <IconRow label="Total" value={overview.arrayTotal} icon={LayoutGrid} />
        <IconRow label="Usage" value={`${overview.arrayUsagePercent}%`} icon={Gauge} />
        <ProgressBar value={overview.arrayUsagePercent} />
      </FrostedCard>

      <FrostedCard>
        <SectionHeader title="Parity" />
        <IconRow
          label="Parity status"
          value={
            overview.parity.status.toLowerCase() === "completed"
              ? `${overview.parity.status} (${overview.parity.errors} errors)`
              : overview.parity.status
          }
          icon={Activity}
        />
        {(overview.parity.running || overview.parity.status.toLowerCase() === "running") && (
          <>
            <IconRow label="Parity progress" value={`${overview.parity.progress}%`} icon={Gauge} />
            <IconRow label="Speed" value={overview.lastParityCheck.speed} icon={HardDrive} />
            <IconRow label="Parity errors" value={String(overview.parity.errors)} icon={CircleX} />
          </>
        )}
        <IconRow label="Last run" value={formatRelativeDaysAgo(overview.lastParityCheck.date)} icon={Activity} />
        <IconRow label="Duration" value={overview.lastParityCheck.duration} icon={Gauge} />
      </FrostedCard>

      {overview.ups.devices.length > 0 && (
        <FrostedCard>
          <SectionHeader title="Backups / UPS" right={<BadgePill value={overview.ups.devices.length} />} />
          {overview.ups.devices.map((device) => (
            <div key={device.id} className="list-item">
              <div className="row">
                <strong>{device.model || device.name}</strong>
                <StatusPill
                  status={device.status.toLowerCase().includes("online") ? "running" : "stopped"}
                  label={device.status.toLowerCase().includes("online") ? "active" : "not active"}
                />
              </div>
              {device.name && device.name !== device.model ? <small>{device.name}</small> : null}
              <div className="array-grid">
                <IconRow label="Battery" value={`${device.batteryLevel}%`} icon={Gauge} />
                <IconRow
                  label="Runtime"
                  value={formatUpsRuntime(device.estimatedRuntimeSeconds)}
                  icon={Activity}
                />
                <IconRow label="Health" value={device.batteryHealth} icon={CircleX} />
              </div>
              <IconRow
                label="Load"
                value={`${Math.max(0, Math.min(100, device.loadPercentage))}%`}
                icon={Cpu}
              />
              <ProgressBar value={Math.max(0, Math.min(100, device.loadPercentage))} />
              <div className="array-grid">
                <IconRow label="Input" value={`${device.inputVoltage || 0} V`} icon={Network} />
                <IconRow label="Output" value={`${device.outputVoltage || 0} V`} icon={Network} />
              </div>
            </div>
          ))}
        </FrostedCard>
      )}

      <FrostedCard>
        <SectionHeader title="Notifications" right={<BadgePill value={overview.unreadNotifications.total} />} />
        <div className="array-grid">
          <IconRow label="Alerts" value={String(overview.unreadNotifications.alert)} icon={CircleX} />
          <IconRow label="Warnings" value={String(overview.unreadNotifications.warning)} icon={Thermometer} />
          <IconRow label="Info" value={String(overview.unreadNotifications.info)} icon={Activity} />
        </div>
        {overview.notifications.slice(0, 5).map((item) => (
          <div key={item.id} className="notification">
            <div className="row notification-top">
              <div className="notification-title-wrap">
                {item.type === "alert" ? (
                  <CircleX size={16} className="notification-icon alert" aria-hidden />
                ) : item.type === "warning" ? (
                  <BellRing size={16} className="notification-icon warning" aria-hidden />
                ) : (
                  <Bell size={16} className="notification-icon info" aria-hidden />
                )}
                <strong>{item.title}</strong>
              </div>
              <button
                className="icon-button notification-archive"
                type="button"
                disabled={!canWriteControls || archivingNotificationId === item.id}
                onClick={() => onArchiveNotification(item.id)}
                aria-label={`Archive notification ${item.title}`}
                title="Archive notification"
              >
                <Archive size={14} />
              </button>
            </div>
            <span>
              {item.category} - {new Date(item.date).toLocaleDateString()}
            </span>
            <p>{item.snippet}</p>
          </div>
        ))}
        {overview.notifications.length === 0 && overview.unreadNotifications.total === 0 && (
          <small>No active warnings/alerts.</small>
        )}
        {overview.notifications.length === 0 && overview.unreadNotifications.total > 0 && (
          <small>Unread notifications exist, but details could not be loaded yet.</small>
        )}
      </FrostedCard>

      <FrostedCard>
        <SectionHeader title="Network Access URLs" right={<BadgePill value={overview.accessUrls.length} />} />
        {overview.accessUrls.slice(0, 8).map((url, index) => (
          <div key={`${url.type}-${url.name}-${index}`} className="list-item">
            <div className="row">
              <strong>{url.type}</strong>
              <BadgePill value={url.name || "-"} />
            </div>
            {(() => {
              const uniqueUrls = Array.from(
                new Set([url.ipv4, url.ipv6].filter((value) => value && value !== "-")),
              );
              if (uniqueUrls.length === 0) {
                return <small className="url-text">-</small>;
              }
              return (
                <div className="url-stack">
                  {uniqueUrls.map((value) => (
                    <div key={value}>
                      <UrlValue value={value} />
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        ))}
        {overview.accessUrls.length === 0 && <small>No access URLs available.</small>}
      </FrostedCard>
    </>
  );
}
