import type { Node, Edge } from "reactflow";
import type { BaseNodeData } from "../flow/nodes/types";

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
export type BaseNodeData = {
  title?: string;
  description?: string;
  emoji?: string;
  status?: NodeStatus;
  metadata?: NodeMetadataEntry[];
  ping_interval?: number; // 🔹 новое поле
};

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
