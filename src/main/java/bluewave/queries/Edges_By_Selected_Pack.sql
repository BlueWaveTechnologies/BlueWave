MATCH (a)-[r]-(b)
WHERE any(label IN labels(a) WHERE label = "{packLabel}")
unwind labels(startNode(r)) as sources
unwind labels(endNode(r)) as targets
WITH collect(distinct(sources)) as sourceLabels, collect(distinct(targets)) as targetLabels
return {source: sourceLabels, target: targetLabels}