import { type MouseEventHandler } from "react";
import { NodeToolbar, type NodeProps } from "reactflow";
import { useFlowStore } from "../../state/store";
import BaseBlock from "./BaseBlock";
import { buildWebsiteMetadata, DEFAULT_PING_INTERVAL, type BaseNodeData } from "./types";

function normalizeInterval(value: string) {
  const numeric = Number(value.trim());
  if (!Number.isFinite(numeric)) return undefined;
  if (numeric <= 0) return undefined;
  return Math.min(3600, Math.max(1, Math.round(numeric)));
}

export default function WebsiteNode(props: NodeProps<BaseNodeData>) {
  const { data, id, selected } = props;

  const setSelectedNode = useFlowStore((state) => state.setSelectedNode);
  const updateNodeData = useFlowStore((state) => state.updateNodeData);

  const metadata = data.metadata ?? buildWebsiteMetadata(data);

  const handleEditClick: MouseEventHandler<HTMLButtonElement> = (event) => {
    event.stopPropagation();
    setSelectedNode(id);

    const state = useFlowStore.getState();
    const current = state.nodes.find((node) => node.id === id);
    if (!current || current.type !== "website") return;

    const currentUrl = current.data.description ?? "";
    const nextUrl = window.prompt("Введите URL сайта", currentUrl);
    if (nextUrl === null) return;
    const trimmedUrl = nextUrl.trim();

    const currentName = current.data.title ?? "";
    const nextName = window.prompt("Введите название сайта", currentName);
    if (nextName === null) return;
    const trimmedName = nextName.trim();

    const currentInterval = current.data.ping_interval ?? DEFAULT_PING_INTERVAL;
    const nextIntervalRaw = window.prompt(
      "Введите интервал опроса (сек)",
      String(currentInterval)
    );
    if (nextIntervalRaw === null) return;

    const normalizedInterval = normalizeInterval(nextIntervalRaw);
    if (!normalizedInterval) {
      window.alert("Интервал должен быть положительным числом от 1 до 3600");
      return;
    }

    const updates: Partial<BaseNodeData> = {};
    if (trimmedUrl !== currentUrl && trimmedUrl !== "") {
      updates.description = trimmedUrl;
    }
    if (trimmedName !== currentName && trimmedName !== "") {
      updates.title = trimmedName;
    }
    if (normalizedInterval !== currentInterval) {
      updates.ping_interval = normalizedInterval;
    }

    if (Object.keys(updates).length > 0) {
      updateNodeData(id, updates);
    }
  };

  return (
    <>
      <NodeToolbar isVisible={selected} position="top">
        <button
          type="button"
          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-600"
          onClick={handleEditClick}
        >
          ✏️ Изменить сайт
        </button>
      </NodeToolbar>
      <BaseBlock {...props} variant="website" data={{ ...data, metadata }} />
    </>
  );
}
