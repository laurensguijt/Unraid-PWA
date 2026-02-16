import { ConfirmDialog } from "./components/ConfirmDialog";
import { FrostedCard } from "./components/FrostedCard";
import { SectionHeader } from "./components/SectionHeader";
import { SkeletonLine } from "./components/SkeletonLine";
import { Toast } from "./components/Toast";
import { AppHeader } from "./components/app/AppHeader";
import { AppTabBar } from "./components/app/AppTabBar";
import { ArrayTab } from "./components/app/ArrayTab";
import { DockerDetailsDialog } from "./components/app/DockerDetailsDialog";
import { DockerTab } from "./components/app/DockerTab";
import { OverviewTab } from "./components/app/OverviewTab";
import { SettingsDialog } from "./components/app/SettingsDialog";
import { SetupForm } from "./components/app/SetupForm";
import { SharesTab } from "./components/app/SharesTab";
import { VmDetailsDialog } from "./components/app/VmDetailsDialog";
import { VmsTab } from "./components/app/VmsTab";
import { useUnraidAppController } from "./hooks/useUnraidAppController";

export default function App() {
  const app = useUnraidAppController();
  const selectedDocker = app.selectedDocker;
  const selectedVm = app.selectedVm;
  const showSetupForm = !app.setupDone || app.addServerOpen;

  return (
    <main className={`app theme-${app.themeMode}`} style={app.appStyle}>
      <div className="gradient" />

      <section className="panel">
        <AppHeader
          setupDone={app.setupDone}
          tab={app.tab}
          headerServerName={app.headerServerName}
          offline={app.offline}
          servers={app.servers}
          activeServerId={app.activeServerId}
          onActivateServer={(id) => {
            void app.activateServer(id);
          }}
          onOpenSettings={() => app.setSettingsOpen(true)}
        />

        {showSetupForm && (
          <SetupForm
            title={app.setupDone ? "Add server" : "First run setup"}
            scopeInfo={app.scopeInfo}
            missingScopes={app.missingScopes}
            serverName={app.serverName}
            serverUrl={app.serverUrl}
            apiKey={app.apiKey}
            trustSelfSigned={app.trustSelfSigned}
            managementAccessUrl={app.managementAccessUrl}
            isTestingSetup={app.isTestingSetup}
            isSavingSetup={app.isSavingSetup}
            onServerNameChange={app.setServerName}
            onServerUrlChange={app.setServerUrl}
            onApiKeyChange={app.setApiKey}
            onTrustSelfSignedChange={app.setTrustSelfSigned}
            onTestConnection={() => {
              void app.handleTestConnection();
            }}
            onCancel={app.addServerOpen ? () => app.setAddServerOpen(false) : undefined}
            onSubmit={() => {
              void app.handleSetup();
            }}
          />
        )}

        {app.setupDone && app.tab === "overview" && app.isLoading && (
          <FrostedCard>
            <SectionHeader title="Loading overview" />
            <SkeletonLine />
            <SkeletonLine width="70%" />
          </FrostedCard>
        )}

        {app.setupDone && app.tab === "overview" && app.overview && !app.isLoading && (
          <OverviewTab
            overview={app.overview}
            canWriteControls={app.canWriteControls}
            archivingNotificationId={app.archivingNotificationId}
            onArchiveNotification={(notificationId) => {
              void app.archiveNotificationById(notificationId);
            }}
          />
        )}

        {app.setupDone && app.tab === "array" && app.arrayData && (
          <ArrayTab
            arrayData={app.arrayData}
            canWriteControls={app.canWriteControls}
            onRequestArrayAction={(action) => app.setPendingAction({ target: "array", action })}
          />
        )}

        {app.setupDone && app.tab === "shares" && <SharesTab shares={app.sharesData?.shares ?? []} />}

        {app.setupDone && app.tab === "docker" && (
          <DockerTab
            docker={app.docker}
            filteredContainers={app.filteredContainers}
            dockerSearch={app.dockerSearch}
            onDockerSearchChange={app.setDockerSearch}
            onOpenContainerInfo={app.setDockerInfoOpenId}
          />
        )}

        {app.setupDone && app.tab === "docker" && selectedDocker && (
          <DockerDetailsDialog
            container={selectedDocker}
            activeServerBaseUrl={app.activeServer?.baseUrl}
            canWriteControls={app.canWriteControls}
            onClose={() => app.setDockerInfoOpenId(null)}
            onRequestAction={(action) =>
              app.setPendingAction({ target: "docker", id: selectedDocker.id, action })
            }
          />
        )}

        {app.setupDone && app.tab === "vms" && app.vmsData && (
          <VmsTab
            vmsData={app.vmsData}
            filteredVms={app.filteredVms}
            vmSearch={app.vmSearch}
            onVmSearchChange={app.setVmSearch}
            onOpenVmInfo={app.setVmInfoOpenId}
          />
        )}

        {app.setupDone && app.tab === "vms" && selectedVm && (
          <VmDetailsDialog
            vm={selectedVm}
            canWriteControls={app.canWriteControls}
            onClose={() => app.setVmInfoOpenId(null)}
            onRequestAction={(action) =>
              app.setPendingAction({ target: "vm", id: selectedVm.id, action })
            }
          />
        )}

        <SettingsDialog
          open={app.setupDone && app.settingsOpen}
          servers={app.servers}
          activeServerId={app.activeServerId}
          renameInput={app.renameInput}
          apiKeyInput={app.apiKeyInput}
          themeMode={app.themeMode}
          updateIntervalMs={app.updateIntervalMs}
          onClose={() => app.setSettingsOpen(false)}
          onActivateServer={(id) => {
            void app.activateServer(id);
          }}
          onStartRename={(id, currentName) =>
            app.setRenameInput((prev) => ({
              ...prev,
              [id]: currentName,
            }))
          }
          onRenameInputChange={(id, value) =>
            app.setRenameInput((prev) => ({
              ...prev,
              [id]: value,
            }))
          }
          onApiKeyInputChange={(id, value) =>
            app.setApiKeyInput((prev) => ({
              ...prev,
              [id]: value,
            }))
          }
          onSaveRename={(id) => {
            void app.renameServerById(id);
          }}
          onSaveApiKey={(id) => {
            void app.replaceServerApiKey(id);
          }}
          onRemoveServer={(id) => {
            void app.removeServer(id);
          }}
          onSetServerTrustSelfSigned={(id, value) => {
            void app.setServerTrustSelfSigned(id, value);
          }}
          onSetServerAccentColor={(id, value) => {
            void app.setServerAccentColor(id, value);
          }}
          onAddServer={app.openAddServerFlow}
          onThemeModeChange={(mode) => {
            void app.saveAppSettings(mode, app.accentColor);
          }}
          onUpdateIntervalChange={app.setUpdateIntervalMs}
        />

        {app.setupDone && !app.addServerOpen && <AppTabBar tab={app.tab} onChange={app.setTab} />}

        <ConfirmDialog
          open={Boolean(app.pendingAction)}
          title="Confirm action"
          message={
            app.pendingAction
              ? app.pendingAction.target === "docker"
                ? `Do you want to ${app.pendingAction.action} container ${app.pendingAction.id}?`
                : app.pendingAction.target === "vm"
                  ? `Do you want to ${app.pendingAction.action} VM ${app.pendingAction.id}?`
                  : `Do you want to ${app.pendingAction.action} the array?`
              : ""
          }
          onCancel={() => app.setPendingAction(null)}
          onConfirm={() => {
            void app.runAction();
          }}
        />

        <Toast message={app.message} variant={app.messageVariant} />
      </section>
    </main>
  );
}
