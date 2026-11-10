/* Node ids in the flow builder. They must be unique within a flow: the canvas finds a node by id to open it, edit it and
   save it, so two nodes sharing an id means clicking one opens (and saving overwrites) the other.
   The counter restarts at 100 on every page load, while a saved flow keeps the ids it was given in earlier sessions, so
   "the next number" is not enough: pick one nobody in the flow is using. */
let counter = 100

export function nextNodeId(nodes) {
  const used = new Set(nodes.map(n => n.id))
  let id
  do { id = `n${++counter}` } while (used.has(id))
  return id
}

/** A flow saved before this fix may already hold two nodes with one id: the later ones get fresh ids so every node is reachable again. */
export function dedupeNodeIds(nodes) {
  const all = new Set(nodes.map(n => n.id))
  const seen = new Set()
  let changed = false
  const out = nodes.map(n => {
    if (!seen.has(n.id)) { seen.add(n.id); return n }
    let id
    do { id = `n${++counter}` } while (all.has(id))
    all.add(id); seen.add(id); changed = true
    return { ...n, id }
  })
  return changed ? out : nodes
}
