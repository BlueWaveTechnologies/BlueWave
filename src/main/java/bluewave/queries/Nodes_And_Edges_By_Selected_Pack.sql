MATCH (a)-[r]-(b)
WHERE any(label IN labels(a) WHERE label = "{packLabel}")
WITH collect (a {.*,id: id(a),labels: labels(a)}) + collect (b{.*,id: id(b),labels: labels(b)}) as nodes, collect({source: id(startNode(r)), target: id(endNode(r)), caption: type(r), value: 4}) AS edges
unwind nodes as nodesrow
with distinct nodesrow as uniquenodes, edges
with collect(uniquenodes) as nodesfinal, edges
unwind edges as edgesrow
with distinct edgesrow as uniqueedges, nodesfinal
with collect(uniqueedges) as edgesfinal, nodesfinal
RETURN {nodes: nodesfinal, links: edgesfinal}