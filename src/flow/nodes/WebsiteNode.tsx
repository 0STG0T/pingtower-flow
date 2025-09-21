import type { NodeProps } from "reactflow";
import BaseBlock from "./BaseBlock";
import { buildWebsiteMetadata, type BaseNodeData } from "./types";

export default function WebsiteNode(props: NodeProps<BaseNodeData>) {
  const { data } = props;

  const metadata = data.metadata ?? buildWebsiteMetadata(data);

  return <BaseBlock {...props} variant="website" data={{ ...data, metadata }} />;
}
