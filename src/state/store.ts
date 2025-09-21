import { create } from "zustand";
import { fetchSites, createSite, updateSite, deleteSite } from "../lib/api";
import {
  type BaseNodeData,
  type FlowNode,
  buildWebsiteMetadata,
  DEFAULT_PING_INTERVAL,
  MAX_PING_INTERVAL,
  MIN_PING_INTERVAL,
  normalizePingInterval,
} from "../flow/nodes/types";
import type { Edge, XYPosition } from "reactflow";

export type NodeStatus = "idle" | "running" | "success" | "error";

const websiteSyncTimers = new Map<string, ReturnType<typeof setTimeout>>();

const cancelWebsiteSyncTimer = (nodeId: string) => {
  const timer = websiteSyncTimers.get(nodeId);
  if (timer) {
    clearTimeout(timer);
    websiteSyncTimers.delete(nodeId);
  }
};

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
  createWebsiteNode: (position: XYPosition, template: BaseNodeData) => Promise<FlowNode | undefined>;
  saveSite: (node: FlowNode) => Promise<{ id: number; url: string; name: string; ping_interval: number } | undefined>;
  deleteSiteNode: (nodeId: string, siteId: number) => Promise<void>;
  syncWebsiteNode: (node: FlowNode) => Promise<{ id: number; url: string; name: string; ping_interval: number } | undefined>;
  updateNodeData: (id: string, data: Partial<BaseNodeData>) => void;
  removeNode: (nodeId: string) => void;

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
          ping_interval: site.ping_interval ?? DEFAULT_PING_INTERVAL,
          metadata: buildWebsiteMetadata({
            title: site.name,
            description: site.url,
            ping_interval: site.ping_interval ?? DEFAULT_PING_INTERVAL,
          }),
        },
      }));
      set({ nodes, isDirty: false });
    } catch (err) {
      console.error("[FlowStore] Ошибка загрузки сайтов:", err);
    }
  },

  createWebsiteNode: async (position, template) => {
    if (typeof window === "undefined") return;

    const defaultUrl = template.description?.trim() || "https://example.com";
    const defaultName = template.title?.trim() || "Новый сайт";
    const defaultInterval = template.ping_interval ?? DEFAULT_PING_INTERVAL;

    const urlInput = window.prompt("Введите URL сайта", defaultUrl);
    if (urlInput === null) return;
    const url = urlInput.trim();
    if (!url) {
      window.alert("URL не может быть пустым");
      return;
    }

    const nameInput = window.prompt("Введите название сайта", defaultName);
    if (nameInput === null) return;
    const name = nameInput.trim();
    if (!name) {
      window.alert("Название не может быть пустым");
      return;
    }

    const intervalInput = window.prompt(
      "Введите интервал опроса (сек)",
      String(defaultInterval)
    );
    if (intervalInput === null) return;

    const normalizedInterval = normalizePingInterval(intervalInput);
    if (!normalizedInterval) {
      window.alert(
        `Интервал должен быть положительным числом от ${MIN_PING_INTERVAL} до ${MAX_PING_INTERVAL}`
      );
      return;
    }

    try {
      const saved = await createSite(url, name, normalizedInterval);

      const node: FlowNode = {
        id: String(saved.id),
        type: "website",
        position,
        data: {
          emoji: template.emoji ?? "🌐",
          status: template.status ?? "idle",
          title: saved.name,
          description: saved.url,
          ping_interval: saved.ping_interval ?? normalizedInterval,
          metadata: buildWebsiteMetadata({
            title: saved.name,
            description: saved.url,
            ping_interval: saved.ping_interval ?? normalizedInterval,
          }),
        },
      };

      set((state) => ({
        nodes: state.nodes.concat(node),
        selectedNodeId: node.id,
        isDirty: false,
        lastSavedAt: new Date(),
      }));

      return node;
    } catch (err) {
      console.error("[FlowStore] Ошибка создания сайта:", err);
    }
  },

  // 💾 сохранить / обновить сайт
  saveSite: async (node) => {
    if (node.type !== "website") return;

    try {
      const url = node.data.description || "";
      const name = node.data.title || "Без имени";
      const ping_interval = node.data.ping_interval ?? DEFAULT_PING_INTERVAL;

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
                  metadata: buildWebsiteMetadata({
                    title: saved.name,
                    description: saved.url,
                    ping_interval: saved.ping_interval,
                  }),
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
      console.warn("[FlowStore] Сервер не нашёл сайт, удаляем только локально", { nodeId, siteId, err });
    } finally {
      cancelWebsiteSyncTimer(nodeId);
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
  updateNodeData: (id, data) => {
    let updatedNode: FlowNode | undefined;

    set((state) => ({
      nodes: state.nodes.map((node) => {
        if (node.id !== id) return node;

        const nextData: BaseNodeData = {
          ...node.data,
          ...data,
        };

        if (node.type === "website") {
          nextData.metadata = buildWebsiteMetadata(nextData);
        }

        const nextNode = { ...node, data: nextData };
        updatedNode = nextNode;
        return nextNode;
      }),
      isDirty: true,
    }));

    const shouldSyncWebsite =
      updatedNode?.type === "website" &&
      ("title" in data || "description" in data || "ping_interval" in data);

    if (updatedNode && shouldSyncWebsite) {
      const existingTimer = websiteSyncTimers.get(updatedNode.id);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const timer = setTimeout(() => {
        void get().syncWebsiteNode(updatedNode!);
        websiteSyncTimers.delete(updatedNode!.id);
      }, 500);

      websiteSyncTimers.set(updatedNode.id, timer);
    }
  },

  removeNode: (nodeId) => {
    cancelWebsiteSyncTimer(nodeId);
    set((state) => ({
      nodes: state.nodes.filter((node) => node.id !== nodeId),
      isDirty: true,
    }));
  },

  runFlow: () => set({ isRunning: true, lastRunAt: new Date() }),
  stopFlow: () => set({ isRunning: false }),

  saveFlow: () => set({ isDirty: false, lastSavedAt: new Date() }),

  isRunning: false,
  isDirty: false,
  lastRunAt: undefined,
  lastSavedAt: undefined,
}));
