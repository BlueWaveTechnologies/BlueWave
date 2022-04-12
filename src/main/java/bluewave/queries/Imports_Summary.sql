MATCH (n:import_line)
WHERE n.{establishment} IN[{fei}]
AND toFloat(n.predict_risk)>={threshold}
RETURN
n.{establishment} as fei,
count(n.{establishment}) as num_lines,
sum(toFloat(n.quantity)) as quantity,
sum(toFloat(n.value)) as value,

collect(distinct(n.manufacturer)) as manufacturer,
collect(distinct(n.shipper)) as shipper,
collect(distinct(n.importer)) as importer,
collect(distinct(n.consignee)) as consignee,
collect(distinct(n.dii)) as dii,

sum((CASE WHEN toFloat(n.predict_risk)>=95 THEN 1 ELSE 0 END)) as num_hi_predict
order by num_lines desc