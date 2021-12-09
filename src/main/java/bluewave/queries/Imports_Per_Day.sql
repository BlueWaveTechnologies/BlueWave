MATCH (n:import_entry)
WHERE n.country_of_origin IN[{country}]
AND toFloat(n.predict_risk)>={threshold}
RETURN
n.date as date,
count(n.date) as entries,
sum(toFloat(n.quantity)) as quantity,
sum(toFloat(n.value)) as value