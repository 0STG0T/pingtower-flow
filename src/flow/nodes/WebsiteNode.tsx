import type { NodeProps } from "reactflow";
import BaseBlock from "./BaseBlock";
import type { BaseNodeData } from "./types";

export default function WebsiteNode(props: NodeProps<BaseNodeData>) {
  const { data } = props;

  // 🔹 добавляем ping_interval в metadata, если его нет
  const metadata = [
    ...(data.metadata ?? []),
    { label: "PING INTERVAL", value: `${data.ping_interval ?? 30} сек` },
  ];

  return <BaseBlock {...props} variant="website" data={{ ...data, metadata }} />;
}
