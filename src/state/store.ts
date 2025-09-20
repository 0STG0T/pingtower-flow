import { create } from "zustand";
import { MarkerType, type Edge } from "reactflow";

import type {
  BaseNodeData,
  FlowNode,
  NodeStatus,
} from "../flow/nodes/types";

type FlowStore = {
  flowName: string;
  nodes: FlowNode[];
  edges: Edge[];
  selectedNodeId?: string;
  isRunning: boolean;
  isDirty: boolean;
  lastRunAt?: number;
  lastSavedAt?: number;
  lastChangeAt?: number;
  setNodes: (updater: (nodes: FlowNode[]) => FlowNode[]) => void;
  setEdges: (updater: (edges: Edge[]) => Edge[]) => void;
  addNode: (node: FlowNode) => void;
  updateNodeData: (id: string, data: Partial<BaseNodeData>) => void;
  setSelectedNode: (id?: string) => void;
  setFlowName: (name: string) => void;
  saveFlow: () => void;
  runFlow: () => void;
  stopFlow: () => void;
};

const edgeColor = "#38bdf8";

const initialNodes: FlowNode[] = [
  {
    id: "1",
    type: "website",
    position: { x: 120, y: 200 },
    data: {
      title: "Мониторинг pingtower.com",
      emoji: "🌐",
      description: "Следит за доступностью и временем ответа",
      status: "success",
      metadata: [
        { label: "URL", value: "pingtower.com" },
        { label: "Интервал", value: "60 сек" },
      ],
    },
  },
  {
    id: "2",
    type: "llm",
    position: { x: 420, y: 200 },
    data: {
      title: "Анализ обращений",
      emoji: "🧠",
      description: "Определяет приоритет и формирует ответ",
      status: "idle",
      metadata: [
        { label: "Модель", value: "GPT-4o" },
        { label: "Темп", value: "0.6" },
      ],
    },
  },
  {
    id: "3",
    type: "messenger",
    position: { x: 720, y: 200 },
    data: {
      title: "Telegram уведомления",
      emoji: "💬",
      description: "Оповещает ответственных в чат",
      status: "idle",
      metadata: [
        { label: "Канал", value: "@pingtower-team" },
        { label: "Формат", value: "Markdown" },
      ],
    },
  },
];

const initialEdges: Edge[] = [
  {
    id: "1-2",
    source: "1",
    target: "2",
    type: "smoothstep",
    animated: true,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: edgeColor,
      width: 20,
      height: 20,
    },

    style: { stroke: edgeColor, strokeWidth: 2 },
  },
  {
    id: "2-3",
    source: "2",
    target: "3",
    type: "smoothstep",
    animated: true,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: edgeColor,
      width: 20,
      height: 20,
    },

    style: { stroke: edgeColor, strokeWidth: 2 },
  },
];

const statusOrder: NodeStatus[] = ["success", "running", "success"];

export const useFlowStore = create<FlowStore>((set, get) => ({
  flowName: "PingTower Автоматизация",
  nodes: initialNodes,
  edges: initialEdges,
  selectedNodeId: undefined,
  isRunning: false,
  isDirty: false,
  lastRunAt: undefined,
  lastSavedAt: Date.now(),
  lastChangeAt: Date.now(),
  setNodes: (updater) =>
    set((state) => ({
      nodes: updater(state.nodes),
      isDirty: true,
      lastChangeAt: Date.now(),
    })),
  setEdges: (updater) =>
    set((state) => ({
      edges: updater(state.edges),
      isDirty: true,
      lastChangeAt: Date.now(),
    })),
  addNode: (node) =>
    set((state) => ({
      nodes: [...state.nodes, node],
      isDirty: true,
      lastChangeAt: Date.now(),
    })),
  updateNodeData: (id, data) =>
    set((state) => {
      let didChange = false;

      const nodes = state.nodes.map((node) => {
        if (node.id !== id) {
          return node;
        }

        const nextData = {
          ...node.data,
          ...data,
        };

        const titleChanged =
          "title" in data && typeof data.title === "string" && data.title !== node.data.title;
        const descriptionChanged =
          "description" in data && data.description !== node.data.description;
        const statusChanged = "status" in data && data.status !== node.data.status;
        const otherKeysChanged = Object.keys(data).some(
          (key) => key !== "title" && key !== "description" && key !== "status"
        );

        if (!titleChanged && !descriptionChanged && !statusChanged && !otherKeysChanged) {
          return node;
        }

        didChange = true;
        return {
          ...node,
          data: nextData,
        };
      });

      if (!didChange) {
        return state;
      }

      return {
        nodes,
        isDirty: true,
        lastChangeAt: Date.now(),
      };
    }),
  setSelectedNode: (id) => set({ selectedNodeId: id }),
  setFlowName: (name) =>
    set((state) => {
      const normalized = name.trim();
      const nextName = normalized === "" ? "Новый сценарий" : normalized;

      if (nextName === state.flowName) {
        return state;
      }

      return {
        flowName: nextName,
        isDirty: true,
        lastChangeAt: Date.now(),
      };
    }),
  saveFlow: () =>
    set((state) => ({
      lastSavedAt: Date.now(),
      isDirty: false,
      lastChangeAt: state.lastChangeAt,
    })),
  runFlow: () => {
    const startedAt = Date.now();
    set((state) => ({
      isRunning: true,
      lastRunAt: startedAt,
      nodes: state.nodes.map((node) => ({
        ...node,
        data: { ...node.data, status: "running" as NodeStatus },
      })),
      isDirty: state.isDirty,
    }));

    setTimeout(() => {
      const { isRunning } = get();
      if (!isRunning) return;

      set((state) => ({
        isRunning: false,
        nodes: state.nodes.map((node, index) => ({
          ...node,
          data: { ...node.data, status: statusOrder[index] ?? "success" },
        })),
        isDirty: state.isDirty,
      }));
    }, 1300);
  },
  stopFlow: () =>
    set((state) => ({
      isRunning: false,
      nodes: state.nodes.map((node) => ({
        ...node,
        data: { ...node.data, status: "idle" as NodeStatus },
      })),
      isDirty: state.isDirty,
    })),
}));
