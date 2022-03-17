MATCH (n:import_line)
WITH *, date(n.date) as d
WHERE d >= date('2020-01-01') and d < date('2022-01-01')
AND n.product_code IN[{product_code}]
RETURN
d as date,
count(n.date) as lines,
sum(toFloat(n.quantity)) as quantity,
sum(toFloat(n.value)) as value,
n.country_of_origin as country