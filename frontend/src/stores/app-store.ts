import { create } from "zustand";
import { Scene, Difficulty, Model, ScenesConfig, scenesApi, Session, sessionsApi } from "@/lib/api";

interface AppState {
  // UI
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;

  // Config
  scenes: Scene[];
  difficulties: Difficulty[];
  models: Model[];
  configLoaded: boolean;
  loadConfig: () => Promise<void>;

  // Current selections
  currentScene: string;
  currentDifficulty: string;
  currentModel: string;
  currentTrainingMode: string;
  setCurrentScene: (key: string) => void;
  setCurrentDifficulty: (key: string) => void;
  setCurrentModel: (key: string) => void;
  setCurrentTrainingMode: (mode: string) => void;

  // Session
  activeSession: Session | null;
  setActiveSession: (session: Session | null) => void;
  createSession: () => Promise<Session | null>;
  endSession: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  // UI
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  // Config
  scenes: [],
  difficulties: [],
  models: [],
  configLoaded: false,

  loadConfig: async () => {
    try {
      const { data } = await scenesApi.getConfig();
      set({
        scenes: data.scenes,
        difficulties: data.difficulties,
        models: data.models,
        configLoaded: true,
        currentScene: data.scenes[0]?.key || "job_interview",
        currentDifficulty: data.difficulties[0]?.key || "beginner",
        currentModel: data.models[0]?.key || "gpt-4o",
      });
    } catch (err) {
      console.error("Failed to load config:", err);
      set({ configLoaded: true });
    }
  },

  // Current selections
  currentScene: "job_interview",
  currentDifficulty: "beginner",
  currentModel: "gpt-4o",
  currentTrainingMode: "immersive",
  setCurrentScene: (key) => set({ currentScene: key }),
  setCurrentDifficulty: (key) => set({ currentDifficulty: key }),
  setCurrentModel: (key) => set({ currentModel: key }),
  setCurrentTrainingMode: (mode) => set({ currentTrainingMode: mode }),

  // Session
  activeSession: null,
  setActiveSession: (session) => set({ activeSession: session }),

  createSession: async () => {
    const { currentScene, currentDifficulty, currentModel, currentTrainingMode } = get();
    try {
      const { data } = await sessionsApi.create(
        currentScene,
        currentDifficulty,
        currentModel,
        currentTrainingMode,
      );
      set({ activeSession: data });
      return data;
    } catch (err) {
      console.error("Failed to create session:", err);
      return null;
    }
  },

  endSession: async () => {
    const { activeSession } = get();
    if (!activeSession) return;
    try {
      await sessionsApi.end(activeSession.id);
    } catch (err) {
      console.error("Failed to end session:", err);
    } finally {
      // Always clear the active session — the backend may have already ended it
      // (e.g. 400 "Session is not active"), so we must clear local state.
      set({ activeSession: null });
    }
  },
}));
