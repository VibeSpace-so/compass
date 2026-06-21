"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Terminal } from "lucide-react";
import { AppState, Project, ChatMessage, StageId } from "@/lib/types";
import {
  loadState,
  loadStateForProject,
  createProject,
  updateProject,
  deleteProject,
  selectProject,
  toggleProvider,
  hasAnyKeyConfigured,
  toggleIntegration,
  addChatMessage,
} from "@/lib/storage";
import {
  setProjectPassword,
  isProjectUnlocked,
  loadAllProjectKeys,
  loadEncryptedChat,
} from "@/lib/secure-storage";
import {
  setupProjectEncryption,
  isProjectEncrypted,
  cleanupOldGlobalEncryption,
  wipeProjectData,
} from "@/lib/crypto";
import { setActiveProjectForConnectors } from "@/lib/integration-service";
import { getCachedMemories, removeMemory, loadEncryptedMemories } from "@/lib/memories";
import NavBar from "@/components/nav-bar";
import Hero from "@/components/hero";
import JourneyMap from "@/components/journey-map";
import ProjectList from "@/components/project-list";
import ProjectDetail from "@/components/project-detail";
import CreateProjectModal from "@/components/create-project-modal";
import BYOKSettings from "@/components/byok-settings";
import ChatPanel from "@/components/chat-panel";
import ProjectUnlock from "@/components/password-gate";


type View = "home" | "project" | "unlock";

export default function CompassPage() {
  const [state, setState] = useState<AppState | null>(null);
  const [view, setView] = useState<View>("home");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBYOK, setShowBYOK] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const deleteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    cleanupOldGlobalEncryption();
    setState(loadState());
  }, []);

  const handleCreateProject = useCallback(
    async (name: string, description: string, password: string) => {
      if (!state) return;
      const newState = createProject(state, name, description);
      const newProject = newState.projects[newState.projects.length - 1];

      // Set up encryption for the new project
      await setupProjectEncryption(newProject.id, password);
      setProjectPassword(newProject.id, password);
      setActiveProjectForConnectors(newProject.id);

      setState(newState);
      setShowCreateModal(false);
      setView("project");
    },
    [state]
  );

  const handleSelectProject = useCallback(
    (id: string) => {
      if (!state) return;
      const newState = selectProject(state, id);
      setState(newState);

      // Check if project is already unlocked in this session
      if (isProjectUnlocked(id)) {
        // Reload state with project's decrypted keys
        setActiveProjectForConnectors(id);
        setState(loadStateForProject(id));
        setView("project");
      } else if (isProjectEncrypted(id)) {
        // Needs unlock
        setView("unlock");
      } else {
        // Legacy project without encryption — open directly
        setView("project");
      }
    },
    [state]
  );

  const handleUnlockProject = useCallback(
    async (password: string) => {
      if (!state || !state.selectedProjectId) return;
      const projectId = state.selectedProjectId;

      setProjectPassword(projectId, password);
      await loadAllProjectKeys(projectId);
      await loadEncryptedChat(projectId);
      await loadEncryptedMemories(projectId);
      setActiveProjectForConnectors(projectId);

      // Reload state with decrypted keys, chat, and memories
      setState(loadStateForProject(projectId));
      setView("project");
    },
    [state]
  );

  const handleWipeProject = useCallback(() => {
    if (!state || !state.selectedProjectId) return;
    // Project data wiped — go back to project list
    setState(loadState());
    setView("home");
  }, [state]);

  const handleUpdateProject = useCallback(
    (updates: Partial<Project>) => {
      if (!state || !state.selectedProjectId) return;
      setState(updateProject(state, state.selectedProjectId, updates));
    },
    [state]
  );

  const handleDeleteProject = useCallback(
    (id: string) => {
      if (!state) return;
      if (deleteTimeoutRef.current) {
        clearTimeout(deleteTimeoutRef.current);
        deleteTimeoutRef.current = null;
      }
      if (confirmDelete === id) {
        // Also wipe encrypted data for deleted project
        wipeProjectData(id);
        const newState = deleteProject(state, id);
        setState(newState);
        setConfirmDelete(null);
        if (state.selectedProjectId === id) {
          setView("home");
        }
      } else {
        setConfirmDelete(id);
        deleteTimeoutRef.current = setTimeout(
          () => setConfirmDelete(null),
          3000
        );
      }
    },
    [state, confirmDelete]
  );

  const handleToggleProvider = useCallback(
    (id: string) => {
      if (!state) return;
      setState(toggleProvider(state, id));
    },
    [state]
  );

  const handleReloadProviders = useCallback(() => {
    if (!state?.selectedProjectId) return;
    setState(loadStateForProject(state.selectedProjectId));
  }, [state]);

  const handleGoHome = useCallback(() => {
    if (!state) return;
    setActiveProjectForConnectors(null);
    setState(selectProject(state, null));
    setView("home");
  }, [state]);

  const handleStart = useCallback(() => {
    if (!state) return;
    if (state.projects.length > 0) {
      document
        .getElementById("projects-section")
        ?.scrollIntoView({ behavior: "smooth" });
    } else {
      setShowCreateModal(true);
    }
  }, [state]);

  const handleToggleIntegration = useCallback(
    (id: string) => {
      if (!state) return;
      setState(toggleIntegration(state, id));
    },
    [state]
  );

  const handleSendMessage = useCallback(
    (message: ChatMessage) => {
      setState((prev) => {
        if (!prev || !prev.selectedProjectId) return prev;
        return addChatMessage(prev, prev.selectedProjectId, message);
      });
    },
    []
  );

  const handleStageAdvance = useCallback(
    (newStage: StageId) => {
      setState((prev) => {
        if (!prev || !prev.selectedProjectId) return prev;
        return updateProject(prev, prev.selectedProjectId, { currentStage: newStage });
      });
    },
    []
  );

  const handleRemoveMemory = useCallback(
    (memoryId: string) => {
      if (!state || !state.selectedProjectId) return;
      removeMemory(state.selectedProjectId, memoryId);
      // Refresh memories in state
      const updated = getCachedMemories(state.selectedProjectId);
      setState((prev) => {
        if (!prev || !prev.selectedProjectId) return prev;
        return { ...prev, memories: { ...prev.memories, [prev.selectedProjectId!]: updated } };
      });
    },
    [state]
  );

  const handleMemoriesRefresh = useCallback(() => {
    if (!state?.selectedProjectId) return;
    const updated = getCachedMemories(state.selectedProjectId);
    setState((prev) => {
      if (!prev || !prev.selectedProjectId) return prev;
      return { ...prev, memories: { ...prev.memories, [prev.selectedProjectId!]: updated } };
    });
  }, [state]);

  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-sm text-[var(--accent-44)] animate-pulse">
          Loading compass...
        </div>
      </div>
    );
  }

  const selectedProject = state.projects.find(
    (p) => p.id === state.selectedProjectId
  );

  const chatEnabled = hasAnyKeyConfigured(state);

  return (
    <>
      <NavBar
        hasProjects={state.projects.length > 0}
        onSettingsClick={() => setShowBYOK(true)}
        onLogoClick={handleGoHome}
      />

      <main className="relative z-10 flex-1">
        {view === "unlock" && selectedProject ? (
          <ProjectUnlock
            projectId={selectedProject.id}
            projectName={selectedProject.name}
            onUnlock={handleUnlockProject}
            onBack={handleGoHome}
            onWipe={handleWipeProject}
          />
        ) : view === "project" && selectedProject ? (
          <ProjectDetail
            project={selectedProject}
            onUpdate={handleUpdateProject}
            onBack={handleGoHome}
            chatPanel={
              <ChatPanel
                project={selectedProject}
                messages={
                  state.chatHistory[selectedProject.id] || []
                }
                onSendMessage={handleSendMessage}
                isEnabled={chatEnabled}
                onSetupKeys={() => setShowBYOK(true)}
                integrations={state.integrations}
                enabledProviderIds={
                  state.byokSettings.providers
                    .filter((p) => p.enabled && p.keySet)
                    .map((p) => p.id)
                }
                onStageAdvance={handleStageAdvance}
                onMemoriesChange={handleMemoriesRefresh}
              />
            }
            integrations={state.integrations}
            onToggleIntegration={handleToggleIntegration}
            memories={state.memories[selectedProject.id] || []}
            onRemoveMemory={handleRemoveMemory}
          />
        ) : (
          <>
            <Hero onStart={handleStart} hasProjects={state.projects.length > 0} />

            <div className="border-t border-[var(--accent-26)]">
              <JourneyMap />
            </div>

            <div
              id="projects-section"
              className="border-t border-[var(--accent-26)]"
            >
              <ProjectList
                projects={state.projects}
                selectedId={state.selectedProjectId}
                onSelect={handleSelectProject}
                onDelete={handleDeleteProject}
                onCreate={() => setShowCreateModal(true)}
              />
            </div>
          </>
        )}
      </main>

      <footer className="border-t border-[var(--accent-26)] bg-[#0a0a0a] py-8">
        <div className="max-w-3xl mx-auto w-full px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-[var(--accent)]" />
              <span className="text-xs font-medium text-[var(--accent)]">
                vibe_space / compass
              </span>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="https://vibespace.so"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-[var(--accent-cc)] hover:text-[var(--accent)] transition-colors"
              >
                vibespace.so
              </a>
              <a
                href="https://luma.com/vibespace"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-[var(--accent-cc)] hover:text-[var(--accent)] transition-colors"
              >
                /luma
              </a>
              <a
                href="https://x.com/VibeSpace_SO"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-[var(--accent-cc)] hover:text-[var(--accent)] transition-colors"
              >
                /twitter
              </a>
            </div>
          </div>
          <div className="border-t border-[var(--accent-26)] mt-6 pt-4 text-center">
            <span className="text-[10px] text-[var(--accent-66)]">
              &copy; {new Date().getFullYear()} Vibe Space. All data stays in your
              browser.
            </span>
          </div>
        </div>
      </footer>

      <CreateProjectModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateProject}
      />

      <BYOKSettings
        open={showBYOK}
        onClose={() => setShowBYOK(false)}
        providers={state.byokSettings.providers}
        onToggleProvider={handleToggleProvider}
        onProvidersChange={handleReloadProviders}
        projectId={state.selectedProjectId}
      />

      {confirmDelete && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded border border-red-500/40 bg-[#0a0a0a] text-xs text-red-400 shadow-lg">
          Click delete again to confirm
        </div>
      )}
    </>
  );
}
