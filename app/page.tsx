"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Terminal } from "lucide-react";
import { AppState, Project, ChatMessage } from "@/lib/types";
import {
  loadState,
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
  setSessionPassword,
  migrateToEncrypted,
  loadAllEncryptedKeys,
} from "@/lib/secure-storage";
import NavBar from "@/components/nav-bar";
import Hero from "@/components/hero";
import JourneyMap from "@/components/journey-map";
import ProjectList from "@/components/project-list";
import ProjectDetail from "@/components/project-detail";
import CreateProjectModal from "@/components/create-project-modal";
import BYOKSettings from "@/components/byok-settings";
import ChatPanel from "@/components/chat-panel";
import PasswordGate from "@/components/password-gate";


type View = "home" | "project";

export default function CompassPage() {
  const [state, setState] = useState<AppState | null>(null);
  const [view, setView] = useState<View>("home");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBYOK, setShowBYOK] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const deleteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function handleUnlock(password: string) {
    setSessionPassword(password);
    await migrateToEncrypted();
    await loadAllEncryptedKeys();
    setState(loadState());
    setUnlocked(true);
  }

  useEffect(() => {
    // Don't load state until unlocked
  }, []);

  const handleCreateProject = useCallback(
    (name: string, description: string) => {
      if (!state) return;
      const newState = createProject(state, name, description);
      setState(newState);
      setShowCreateModal(false);
      setView("project");
    },
    [state]
  );

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

  const handleSelectProject = useCallback(
    (id: string) => {
      if (!state) return;
      setState(selectProject(state, id));
      setView("project");
    },
    [state]
  );

  const handleToggleProvider = useCallback(
    (id: string) => {
      if (!state) return;
      setState(toggleProvider(state, id));
    },
    [state]
  );

  const handleReloadProviders = useCallback(() => {
    setState(loadState());
  }, []);

  const handleGoHome = useCallback(() => {
    if (!state) return;
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

  if (!unlocked) {
    return <PasswordGate onUnlock={handleUnlock} />;
  }

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
        {view === "project" && selectedProject ? (
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
              />
            }
            integrations={state.integrations}
            onToggleIntegration={handleToggleIntegration}
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
      />

      {confirmDelete && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded border border-red-500/40 bg-[#0a0a0a] text-xs text-red-400 shadow-lg">
          Click delete again to confirm
        </div>
      )}
    </>
  );
}
