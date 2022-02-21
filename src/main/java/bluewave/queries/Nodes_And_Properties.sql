MATCH(n)
WITH LABELS(n) AS labels , KEYS(n) AS keys
UNWIND labels AS label
UNWIND keys AS key
RETURN DISTINCT label as name, COLLECT(DISTINCT key) AS properties
ORDER BY label