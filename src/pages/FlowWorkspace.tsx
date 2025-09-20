import FlowCanvas from "../flow/FlowCanvas";
import Inspector from "../components/Inspector";
import NodeLibrary from "../components/NodeLibrary";
import Toolbar from "../components/Toolbar";

export default function FlowWorkspace() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Toolbar />
      <div className="flex flex-1 overflow-hidden">
        <NodeLibrary />
        <main className="relative flex flex-1 bg-slate-100">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-white/60 via-white/30 to-transparent" />
          <FlowCanvas />
        </main>
        <Inspector />
      </div>
    </div>
  );
}
