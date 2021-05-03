MATCH (a)-[r]->(b), (a)<-[s]-(c)
WHERE any(label IN labels(a) WHERE label = "{packLabel}")
unwind labels(b) as labelsbrow
unwind labels(c) as labelscrow
WITH collect(distinct(labelscrow)) as cc, collect(distinct(labelsbrow)) as bb
RETURN {source: cc, target: bb}