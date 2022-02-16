MATCH (n:import_line)
RETURN
n.product_code as product_code,
count(n.entry) as lines,
sum(toFloat(n.quantity)) as quantity,
sum(toFloat(n.value)) as value