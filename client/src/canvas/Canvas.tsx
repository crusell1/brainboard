import ReactFlow from "reactflow";
import "reactflow/dist/style.css";

export default function Canvas() {
  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <ReactFlow nodes={[]} edges={[]} />
    </div>
  );
}
