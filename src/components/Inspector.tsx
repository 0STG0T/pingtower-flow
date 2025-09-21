import { useEffect, useMemo, useState, type ChangeEventHandler } from "react";
import clsx from "clsx";
import { useShallow } from "zustand/react/shallow";

import { useFlowStore } from "../state/store";
import type { BlockVariant, NodeStatus } from "../flow/nodes/types";

const statusOptions: { value: NodeStatus; label: string; className: string }[] = [
  { value: "idle", label: "Ожидание", className: "border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300 hover:text-slate-600" },
  { value: "running", label: "Выполняется", className: "border-amber-200 bg-amber-50 text-amber-600 hover:border-amber-300 hover:text-amber-700" },
  { value: "success", label: "Готово", className: "border-emerald-200 bg-emerald-50 text-emerald-600 hover:border-emerald-300 hover:text-emerald-700" },
  { value: "error", label: "Ошибка", className: "border-rose-200 bg-rose-50 text-rose-600 hover:border-rose-300 hover:text-rose-700" },
];

const typeLabels: Record<BlockVariant, string> = {
  website: "Источник",
  llm: "Логика",
  messenger: "Доставка",
};

export default function Inspector() {
  const { selectedNodeId, nodes, updateNodeData } = useFlowStore(
    useShallow((state) => ({
      selectedNodeId: state.selectedNodeId,
      nodes: state.nodes,
      updateNodeData: state.updateNodeData,
    }))
  );

  const node = useMemo(
    () => nodes.find((candidate) => candidate.id === selectedNodeId),
    [nodes, selectedNodeId]
  );

  const [form, setForm] = useState({
    title: "",
    description: "",
    status: "idle" as NodeStatus,
  });

  useEffect(() => {
    if (!node) return;
    setForm({
      title: node.data.title ?? "",
      description: node.data.description ?? "",
      status: node.data.status ?? "idle",
    });
  }, [node]);

  const handleChange = (
    field: "title" | "description"
  ): ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement> =>
    (event) => {
      const value = event.target.value;
      setForm((prev) => ({ ...prev, [field]: value }));
      if (node) {
        if (node.data[field] !== value) {
          updateNodeData(node.id, { [field]: value });
        }
      }
    };

  const handleStatusChange = (status: NodeStatus) => {
    setForm((prev) => ({ ...prev, status }));
    if (node && node.data.status !== status) {
      updateNodeData(node.id, { status });
    }
  };

  if (!node) {
    return (
      <aside className="hidden w-80 flex-none flex-col items-center justify-center border-l border-slate-200 bg-white/85 px-6 text-center text-sm text-slate-400 backdrop-blur lg:flex">
        <div className="flex flex-col items-center gap-3">
          <span className="text-2xl">🧩</span>
          <p>Выберите блок, чтобы настроить его свойства</p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="hidden w-80 flex-none flex-col border-l border-slate-200 bg-white/85 px-6 pb-6 pt-5 backdrop-blur lg:flex">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Инспектор</p>
          <p className="text-xs text-slate-500">Настройка выбранного блока</p>
        </div>
        <span className="rounded-full border border-slate-200 px-2 py-1 text-[11px] font-semibold uppercase text-slate-400">
          {typeLabels[node.type as BlockVariant] ?? node.type}
        </span>
      </div>

      <div className="mt-5 space-y-5">
        {/* Название */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Название</label>
          <input
            value={form.title}
            onChange={handleChange("title")}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-200"
          />
        </div>

        {/* Описание */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Описание</label>
          <textarea
            value={form.description}
            onChange={handleChange("description")}
            rows={3}
            className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-200"
          />
        </div>

        {/* Статус */}
        <div className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Статус</span>
          <div className="grid grid-cols-2 gap-2">
            {statusOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleStatusChange(option.value)}
                className={clsx(
                  "rounded-xl border px-3 py-2 text-xs font-semibold transition",
                  option.className,
                  form.status === option.value && "ring-2 ring-offset-1 ring-sky-200"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* URL для website */}
        {node.type === "website" && (
          <>
            {/* URL */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-slate-400">URL сайта</label>
              <input
                value={form.description}
                onChange={handleChange("description")}
                className="w-full rounded-xl border px-3 py-2 text-sm text-slate-700"
              />
            </div>

            {/* Интервал */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-slate-400">Интервал (сек)</label>
              <input
                type="number"
                min={5}
                max={3600}
                value={node.data.ping_interval ?? 30}
                onChange={(e) => updateNodeData(node.id, { ping_interval: Number(e.target.value) })}
                className="w-full rounded-xl border px-3 py-2 text-sm text-slate-700"
              />
            </div>

            {/* Кнопки */}
            <div className="flex gap-2 pt-4">
              <button
                className="flex-1 rounded-xl bg-sky-600 px-4 py-2 text-white"
                onClick={async () => {
                  const saved = await useFlowStore.getState().saveSite(node);
                  if (saved && saved.id) {
                    useFlowStore.setState({ selectedNodeId: String(saved.id) });
                  }
                }}
              >
                💾 Сохранить
              </button>
              <button
                className="flex-1 rounded-xl bg-rose-600 px-4 py-2 text-white"
                onClick={() => {
                  if (node.id.startsWith("temp-")) {
                    // удалить только локально
                    useFlowStore.setState((state) => ({
                      nodes: state.nodes.filter((n) => n.id !== node.id),
                    }));
                  } else {
                    // удалить и на сервере, и локально
                    useFlowStore.getState().deleteSiteNode(node.id, Number(node.id));
                  }
                }}
              >
                🗑 Удалить
              </button>
            </div>
          </>
        )}

        {/* Метаданные read-only */}
        {node.data.metadata && node.data.metadata.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Метаданные</span>
            <div className="space-y-2">
              {node.data.metadata.map((item) => (
                <div
                  key={`${item.label}-${item.value}`}
                  className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2 text-xs text-slate-600"
                >
                  <span className="font-semibold text-slate-500">{item.label}</span>
                  <span className="text-slate-700">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Служебка */}
        <div className="space-y-1 text-xs text-slate-400">
          <div className="flex items-center justify-between">
            <span>ID блока</span>
            <span className="font-mono text-slate-500">{node.id}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Тип</span>
            <span className="font-medium text-slate-500">{node.type}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
