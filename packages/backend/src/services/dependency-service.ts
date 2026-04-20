// WIP stub: full implementation pending. The tickets schema does not yet
// have a `dependencies` column, so these are no-ops that keep the routes
// in src/routes/tickets.ts compiling and running until the feature lands.

export async function validateDependencies(_projectId: string, _dependencies: string[]): Promise<void> {
  return;
}

export async function validateNoCircularDependencies(_ticketId: string, _dependencies: string[]): Promise<void> {
  return;
}

export async function cascadeStatusUpdate(
  _ticketId: string,
  _projectId: string,
  _toStatus: string,
  _fromStatus: string,
): Promise<void> {
  return;
}

export interface DependencyChainNode {
  ticketId: string;
  title: string;
  status: string;
  depth: number;
  dependencies: DependencyChainNode[];
}

export async function getDependencyChain(_ticketId: string, _maxDepth: number = 5): Promise<DependencyChainNode[]> {
  return [];
}
