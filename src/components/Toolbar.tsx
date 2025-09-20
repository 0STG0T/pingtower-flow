import { useEffect, useState, type KeyboardEventHandler } from "react";
import clsx from "clsx";

import { useShallow } from "zustand/react/shallow";

import { useFlowStore } from "../state/store";
import { formatRelativeTime } from "../utils/date";

export default function Toolbar() {
  const {
    flowName,
    setFlowName,
    nodes,
    edges,
    runFlow,
    stopFlow,
    saveFlow,
    isRunning,
    isDirty,
    lastRunAt,
    lastSavedAt,

  } = useFlowStore(
    useShallow((state) => ({
      flowName: state.flowName,
      setFlowName: state.setFlowName,
      nodes: state.nodes,
      edges: state.edges,
      runFlow: state.runFlow,
      stopFlow: state.stopFlow,
      saveFlow: state.saveFlow,
      isRunning: state.isRunning,
      isDirty: state.isDirty,
      lastRunAt: state.lastRunAt,
      lastSavedAt: state.lastSavedAt,
    }))
  );


  const [isEditingName, setIsEditingName] = useState(false);
  const [draftName, setDraftName] = useState(flowName);

  useEffect(() => {
    setDraftName((previous: string) => (previous === flowName ? previous : flowName));
  }, [flowName]);

  const handleSubmitName = () => {
    const normalized = draftName.trim();
    const nextName = normalized === "" ? "Новый сценарий" : normalized;

    if (nextName === flowName) {
      setDraftName(nextName);
      setIsEditingName(false);
      return;
    }

    setDraftName(nextName);
    setFlowName(nextName);

    setIsEditingName(false);
  };

  const handleKeyDown: KeyboardEventHandler<HTMLInputElement> = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSubmitName();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setDraftName(flowName);
      setIsEditingName(false);
    }
  };

  const saveButtonClass = clsx(
    "rounded-xl border px-4 py-2 text-sm font-semibold transition",
    isDirty
      ? "border-slate-300 bg-white text-slate-700 hover:border-sky-300 hover:text-sky-600"
      : "border-slate-200 bg-slate-100 text-slate-400"
  );

  const runButtonClass = clsx(
    "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition focus:outline-none focus:ring-2 focus:ring-offset-1",
    isRunning
      ? "bg-rose-500 hover:bg-rose-600 focus:ring-rose-200"
      : "bg-sky-500 hover:bg-sky-600 focus:ring-sky-200"
  );

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white/85 px-6 py-4 backdrop-blur">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          <span className="h-2 w-2 animate-pulse rounded-full bg-sky-400" /> Flow
        </div>
        <div className="flex flex-col gap-1">
          {isEditingName ? (
            <input
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              onBlur={handleSubmitName}
              onKeyDown={handleKeyDown}
              autoFocus
              className="rounded-lg border border-sky-300 bg-white px-3 py-1 text-lg font-semibold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
            />
          ) : (
            <button
              type="button"
              onClick={() => setIsEditingName(true)}
              className="text-left text-lg font-semibold text-slate-800 transition hover:text-slate-900"
            >
              {flowName}
            </button>
          )}
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span>Сохранено {formatRelativeTime(lastSavedAt)}</span>
            <span className="hidden md:inline">•</span>
            <span className="hidden md:inline">
              Последний запуск {lastRunAt ? formatRelativeTime(lastRunAt) : "не запускался"}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="hidden items-center gap-3 text-xs text-slate-500 xl:flex">
          <span>{nodes.length} узлов</span>
          <span className="text-slate-300">•</span>
          <span>{edges.length} связей</span>
          {isDirty && (
            <span className="flex items-center gap-1 text-amber-500">
              <span className="h-2 w-2 animate-ping rounded-full bg-amber-400" />
              Изменения не сохранены
            </span>
          )}
        </div>

        <button
          type="button"
          className={saveButtonClass}
          disabled={!isDirty}
          onClick={saveFlow}
        >
          Сохранить
        </button>
        <button
          type="button"
          className={runButtonClass}
          onClick={isRunning ? stopFlow : runFlow}
        >
          <span className="text-base">{isRunning ? "■" : "▶"}</span>
          {isRunning ? "Остановить" : "Запустить"}
        </button>
      </div>
    </header>
  );
}