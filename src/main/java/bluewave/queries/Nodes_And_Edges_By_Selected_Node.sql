MATCH (a)-[r]-(b)
WHERE id(a) = {id}
WITH collect (a {.*,id: id(a),labels: labels(a)}) + collect (b{.*,id: id(b),labels: labels(b)}) as nodes, collect({source: id(startNode(r)), target: id(endNode(r)), caption: type(r), value: 4}) AS edges
unwind nodes as nodesrow
with distinct nodesrow as uniquenodes, edges
with collect(uniquenodes) as nodesfinal, edges
RETURN {nodes: nodesfinal, links: edges}