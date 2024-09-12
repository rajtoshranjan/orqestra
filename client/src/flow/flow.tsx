import classNames from "clsx";
import React from "react";
import ReactFlow, {
  Background,
  Controls,
  Node,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from "reactflow";
import "reactflow/dist/style.css";

type FlowProps = React.HTMLProps<HTMLDivElement>;

const initialNodes: Node[] = [
  {
    id: "1",
    data: { label: "VPC" },
    position: { x: 100, y: 100 },
  },
];

export const Flow: React.FC<FlowProps> = ({ className, ...rest }) => {
  // States.
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState([]);

  // Constants.
  const customClassName = classNames(className, "p-4");

  return (
    <div className={customClassName} {...rest}>
      <ReactFlowProvider>
        <ReactFlow
          proOptions={{ hideAttribution: true }}
          nodes={nodes}
          onNodesChange={onNodesChange}
          edges={edges}
          onEdgesChange={onEdgesChange}
        >
          <Background />
          <Controls position="bottom-right" />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
};
