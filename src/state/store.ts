import { create } from "zustand";
import { fetchSites, createSite, updateSite, deleteSite } from "../lib/api";
import type { FlowNode, BaseNodeData } from "../flow/nodes/types";
import type { Edge } from "reactflow";

export type NodeStatus = "idle" | "running" | "success" | "error";

type FlowStore = {
  flowName: string;
  setFlowName: (name: string) => void;

  nodes: FlowNode[];
  edges: Edge[];
  setNodes: (updater: FlowNode[] | ((nodes: FlowNode[]) => FlowNode[])) => void;
  setEdges: (updater: Edge[] | ((edges: Edge[]) => Edge[])) => void;

  selectedNodeId?: string;
  setSelectedNode: (id?: string) => void;

  initFromDb: () => Promise<void>;
  saveSite: (node: FlowNode) => Promise<{ id: number; url: string; name: string; ping_interval: number } | undefined>;
  deleteSiteNode: (nodeId: string, siteId: number) => Promise<void>;
  syncWebsiteNode: (node: FlowNode) => Promise<{ id: number; url: string; name: string; ping_interval: number } | undefined>;
  updateNodeData: (id: string, data: Partial<BaseNodeData>) => void;

  runFlow: () => void;
  stopFlow: () => void;
  saveFlow: () => void;

  isRunning: boolean;
  isDirty: boolean;
  lastRunAt?: Date;
  lastSavedAt?: Date;
};

export const useFlowStore = create<FlowStore>((set, get) => ({
  flowName: "Новый сценарий",
  setFlowName: (name) => set({ flowName: name, isDirty: true }),

  nodes: [],
  edges: [],
  setNodes: (updater) =>
    set((state) => ({
      nodes: typeof updater === "function" ? updater(state.nodes) : updater,
      isDirty: true,
    })),
  setEdges: (updater) =>
    set((state) => ({
      edges: typeof updater === "function" ? updater(state.edges) : updater,
      isDirty: true,
    })),

  selectedNodeId: undefined,
  setSelectedNode: (id) => set({ selectedNodeId: id }),

  // 📥 загрузка из БД
  initFromDb: async () => {
    try {
      const sites = await fetchSites();
      const nodes: FlowNode[] = sites.map((site) => ({
        id: String(site.id),
        type: "website",
        position: { x: Math.random() * 400, y: Math.random() * 400 },
        data: {
          title: site.name,
          description: site.url,
          emoji: "🌐",
          status: "idle" as NodeStatus,
          ping_interval: site.ping_interval ?? 30,
          metadata: [
            { label: "URL", value: site.url },
            { label: "Имя", value: site.name },
            { label: "Интервал", value: site.ping_interval?.toString() ?? "30" },
          ],
        },
      }));
      set({ nodes, isDirty: false });
    } catch (err) {
      console.error("[FlowStore] Ошибка загрузки сайтов:", err);
    }
  },

  // 💾 сохранить / обновить сайт
  saveSite: async (node) => {
    if (node.type !== "website") return;

    try {
      const url = node.data.description || "";
      const name = node.data.title || "Без имени";
      const ping_interval = node.data.ping_interval ?? 30;

      const saved = node.id.startsWith("temp-")
        ? await createSite(url, name, ping_interval)
        : await updateSite(Number(node.id), { url, name, ping_interval });

      set((state) => ({
        nodes: state.nodes.map((n) =>
          n.id === node.id
            ? {
                ...n,
                id: String(saved.id),
                data: {
                  ...n.data,
                  title: saved.name,
                  description: saved.url,
                  ping_interval: saved.ping_interval,
                },
              }
            : n
        ),
        isDirty: false,
        lastSavedAt: new Date(),
      }));

      return saved;
    } catch (err) {
      console.error("[FlowStore] Ошибка сохранения сайта:", err);
    }
  },

  // 🗑 удалить сайт
  deleteSiteNode: async (nodeId, siteId) => {
    try {
      await deleteSite(Number(siteId));
    } catch (err) {
      console.warn("[FlowStore] Сервер не нашёл сайт, удаляем только локально", { nodeId, siteId });
    } finally {
      set((state) => ({
        nodes: state.nodes.filter((n) => n.id !== nodeId),
        isDirty: true,
      }));
    }
  },

  // 🔄 синхронизация
  syncWebsiteNode: async (node) => {
    if (node.type === "website") {
      return await get().saveSite(node);
    }
  },

  // ✏️ обновить локально
  updateNodeData: (id, data) =>
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...data } } : node
      ),
      isDirty: true,
    })),

  runFlow: () => set({ isRunning: true, lastRunAt: new Date() }),
  stopFlow: () => set({ isRunning: false }),

  saveFlow: () => set({ isDirty: false, lastSavedAt: new Date() }),

  isRunning: false,
  isDirty: false,
  lastRunAt: undefined,
  lastSavedAt: undefined,
}));
