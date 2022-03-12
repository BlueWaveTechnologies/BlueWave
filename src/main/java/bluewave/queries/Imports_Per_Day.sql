MATCH (n:import_line)
WHERE n.country_of_origin IN[{country}]
AND n.product_code IN[{product_code}]
AND toFloat(n.predict_risk)>={threshold}
RETURN
n.date as date,
count(n.date) as lines,
sum(toFloat(n.quantity)) as quantity,
sum(toFloat(n.value)) as value