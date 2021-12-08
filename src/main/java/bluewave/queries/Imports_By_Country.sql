MATCH (n:import_entry)
WHERE n.country_of_origin IN[{country}]
AND toFloat(n.predict_risk)>={threshold}
RETURN
n.{establishment} as fei,
count(n.{establishment}) as num_entries,
sum(toFloat(n.quantity)) as quantity,
sum(toFloat(n.value)) as value,
count(n.lab_classification_code) as num_exams,
sum((CASE WHEN n.activity_number='23' THEN 1 ELSE 0 END)) as num_field_exams,
sum((CASE WHEN (n.activity_number='23' AND n.lab_classification_code='3') THEN 1 ELSE 0 END)) as num_field_fails,
sum((CASE WHEN n.activity_number='27' THEN 1 ELSE 0 END)) as num_label_exams,
sum((CASE WHEN (n.activity_number='27' AND n.lab_classification_code='3') THEN 1 ELSE 0 END)) as num_label_fails,
sum((CASE WHEN toFloat(n.predict_risk)>=95 THEN 1 ELSE 0 END)) as num_hi_predict
order by num_entries desc