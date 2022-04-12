MATCH (n:import_line)
WHERE n.country_of_origin IN[{country}]
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

/*
count(n.lab_classification_code) as num_exams,
sum((CASE WHEN n.activity_number='23' THEN 1 ELSE 0 END)) as num_field_exams,
sum((CASE WHEN (n.activity_number='23' AND n.lab_classification_code='3') THEN 1 ELSE 0 END)) as num_field_fails,
sum((CASE WHEN n.activity_number='27' THEN 1 ELSE 0 END)) as num_label_exams,
sum((CASE WHEN (n.activity_number='27' AND n.lab_classification_code='3') THEN 1 ELSE 0 END)) as num_label_fails,
count(n.sample_lab_classification) as num_samples,
sum((CASE WHEN (n.sample_lab_classification='3') THEN 1 ELSE 0 END)) as num_bad_samples,
*/

sum((CASE WHEN toFloat(n.predict_risk)>=95 THEN 1 ELSE 0 END)) as num_hi_predict
order by num_lines desc