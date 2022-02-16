MATCH (n:import_line)
RETURN
n.manufacturer as manufacturer,
count(n.manufacturer) as lines,
sum(toFloat(n.quantity)) as quantity,
sum(toFloat(n.value)) as value,
n.consignee as consignee,
n.unladed_port as unladed_port