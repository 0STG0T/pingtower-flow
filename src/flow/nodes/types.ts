import type { Node } from "reactflow";

export type BlockVariant = "website" | "llm" | "messenger";

export type NodeStatus = "idle" | "running" | "success" | "error";

export type NodeMetadataEntry = {
  label: string;
  value: string;
};

export type BaseNodeData = {
  title: string;
  emoji: string;
  description?: string;
  status: NodeStatus;
  metadata: { label: string; value: string }[];
  siteId?: number; // 👈 сюда будем сохранять id из БД
};

export type FlowNode = Node<BaseNodeData>;


