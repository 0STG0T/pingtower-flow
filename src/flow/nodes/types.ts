import type { Edge, Node } from "reactflow";

// Варианты блоков
export type BlockVariant = "website" | "llm" | "messenger";

// Статусы нод
export type NodeStatus = "idle" | "running" | "success" | "error";

// Метаданные
export type NodeMetadataEntry = {
  label: string;
  value: string;
};

// Базовые данные ноды
export const DEFAULT_PING_INTERVAL = 30;

export type BaseNodeData = {
  title?: string;
  description?: string;
  emoji?: string;
  status?: NodeStatus;
  metadata?: NodeMetadataEntry[];
  ping_interval?: number;
};

export function buildWebsiteMetadata(data: BaseNodeData): NodeMetadataEntry[] {
  const interval = data.ping_interval ?? DEFAULT_PING_INTERVAL;

  return [
    { label: "URL", value: data.description ?? "—" },
    { label: "Название", value: data.title ?? "Без имени" },
    { label: "Интервал", value: `${interval} сек` },
  ];
}

// FlowNode
export type FlowNode = Node<BaseNodeData>;

// Состояние стора
export type FlowStore = {
  flowName: string;
  setFlowName: (name: string) => void;

  nodes: FlowNode[];
  edges: Edge[];

  runFlow: () => void;
  stopFlow: () => void;
  saveFlow: () => void;

  isRunning: boolean;
  isDirty: boolean;
  lastRunAt?: Date;
  lastSavedAt?: Date;
};
