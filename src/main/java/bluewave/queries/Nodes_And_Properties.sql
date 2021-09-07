MATCH(n)
WITH LABELS(n) AS labels , KEYS(n) AS keys
UNWIND labels AS label
UNWIND keys AS key
RETURN DISTINCT label, COLLECT(DISTINCT key) AS props
ORDER BY label