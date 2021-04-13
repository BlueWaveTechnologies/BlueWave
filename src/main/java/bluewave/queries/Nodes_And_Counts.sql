MATCH (n) RETURN
distinct labels(n) as labels,
count(labels(n)) as count,
sum(size((n) <--())) as relations;
