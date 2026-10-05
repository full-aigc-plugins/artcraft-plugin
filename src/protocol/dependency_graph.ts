/** 声明式派生关系；图检查先于任何子任务执行。 */
export interface DependencyNode { id: string; dependsOn: string[]; }

/** 返回确定性拓扑序；拒绝重复节点、重复边、缺失节点和循环。 */
export function orderGraph(nodes: DependencyNode[]): string[] {
  const byId = new Map<string, DependencyNode>();
  for (const node of nodes) {
    if (!node.id || byId.has(node.id) || !Array.isArray(node.dependsOn) || new Set(node.dependsOn).size !== node.dependsOn.length) throw new Error('dependency_invalid');
    byId.set(node.id, node);
  }
  const state = new Map<string, number>();
  const result: string[] = [];
  function visit(id: string): void {
    const node = byId.get(id);
    if (!node) throw new Error('dependency_missing: ' + id);
    if (state.get(id) === 1) throw new Error('dependency_cycle: ' + id);
    if (state.get(id) === 2) return;
    state.set(id, 1);
    for (const parent of node.dependsOn) visit(parent);
    state.set(id, 2);
    result.push(id);
  }
  for (const node of nodes) visit(node.id);
  return result;
}

/** 只失效改变节点及传递消费者；改变来源由版本/参数比较负责。 */
export function invalidated(nodes: DependencyNode[], changed: string[]): Set<string> {
  const order = orderGraph(nodes);
  const result = new Set(changed);
  if (changed.some(id => !order.includes(id))) throw new Error('dependency_missing');
  const byId = new Map(nodes.map(node => [node.id, node]));
  for (const id of order) if (byId.get(id)!.dependsOn.some(parent => result.has(parent))) result.add(id);
  return result;
}
