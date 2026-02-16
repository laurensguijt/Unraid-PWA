import { Check, ChevronDown, Settings } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ServerRecord, Tab } from "../../types";

const TAB_LABELS: Record<string, string> = {
  overview: "Unraid",
  array: "Storage",
  shares: "Shares",
  docker: "Docker",
  vms: "VM",
};

type AppHeaderProps = {
  setupDone: boolean;
  tab: Tab;
  headerServerName: string;
  offline: boolean;
  servers: ServerRecord[];
  activeServerId: string | null;
  onActivateServer: (id: string) => void;
  onOpenSettings: () => void;
};

export function AppHeader({
  setupDone,
  tab,
  headerServerName,
  offline,
  servers,
  activeServerId,
  onActivateServer,
  onOpenSettings,
}: AppHeaderProps) {
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const switcherMenuRef = useRef<HTMLDivElement | null>(null);
  const [switcherPosition, setSwitcherPosition] = useState<{
    top: number;
    left: number;
    minWidth: number;
  } | null>(null);
  const switcherId = "server-switcher-menu";
  const title = setupDone
    ? tab === "overview"
      ? headerServerName
      : (TAB_LABELS[tab] ?? tab)
    : "Unraid";
  const activeServer = useMemo(
    () => servers.find((server) => server.id === activeServerId) ?? null,
    [servers, activeServerId],
  );

  useEffect(() => {
    setSwitcherOpen(false);
  }, [activeServerId]);

  useEffect(() => {
    if (!switcherOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (switcherRef.current?.contains(target)) {
        return;
      }
      if (switcherMenuRef.current?.contains(target)) {
        return;
      }
      setSwitcherOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSwitcherOpen(false);
      }
    }

    function updatePosition() {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }
      const viewportPadding = 12;
      const desiredWidth = Math.max(rect.width, 220);
      const maxLeft = Math.max(
        viewportPadding,
        window.innerWidth - viewportPadding - desiredWidth,
      );
      const left = Math.max(viewportPadding, Math.min(rect.left, maxLeft));
      setSwitcherPosition({
        top: rect.bottom + 8,
        left,
        minWidth: desiredWidth,
      });
    }

    updatePosition();
    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [switcherOpen]);

  const switcherMenu =
    switcherOpen && switcherPosition && typeof document !== "undefined"
      ? createPortal(
          <div
            className="server-switcher-menu server-switcher-menu-portal"
            id={switcherId}
            role="listbox"
            ref={switcherMenuRef}
            style={{
              top: `${switcherPosition.top}px`,
              left: `${switcherPosition.left}px`,
              minWidth: `${switcherPosition.minWidth}px`,
            }}
          >
            {servers.map((server) => {
              const isActive = server.id === activeServerId;
              return (
                <button
                  key={server.id}
                  className={`server-switcher-item${isActive ? " active" : ""}`}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={() => {
                    if (!isActive) {
                      onActivateServer(server.id);
                    }
                    setSwitcherOpen(false);
                  }}
                >
                  <span
                    className="server-switcher-dot"
                    style={{ backgroundColor: server.accentColor }}
                    aria-hidden
                  />
                  <span className="server-switcher-item-name">{server.name}</span>
                  {isActive ? <Check size={14} className="server-switcher-check" /> : null}
                </button>
              );
            })}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <header className="header">
        <div className="header-title-stack">
          <h1>{title}</h1>
          {setupDone && tab === "overview" ? (
            <small className={offline ? "header-status offline" : "header-status online"}>
              <span className="header-status-dot" aria-hidden />
              {offline ? "offline" : "online"}
            </small>
          ) : null}
        </div>
        <div className="header-actions">
          {setupDone && servers.length > 1 && activeServerId ? (
            <div className="server-switcher-popover" ref={switcherRef}>
              <button
                className="server-switcher-trigger"
                type="button"
                aria-haspopup="listbox"
                aria-expanded={switcherOpen}
                aria-controls={switcherId}
                onClick={() => setSwitcherOpen((value) => !value)}
                ref={triggerRef}
              >
                <span
                  className="server-switcher-dot"
                  style={{ backgroundColor: activeServer?.accentColor ?? "#ea580c" }}
                  aria-hidden
                />
                <span className="server-switcher-label">
                  {activeServer?.name ?? "Select server"}
                </span>
                <ChevronDown size={15} />
              </button>
            </div>
          ) : null}
          {setupDone ? (
            <button
              className="circle-button"
              type="button"
              aria-label="Settings"
              onClick={onOpenSettings}
            >
              <Settings size={18} />
            </button>
          ) : null}
        </div>
      </header>
      {switcherMenu}
    </>
  );
}
