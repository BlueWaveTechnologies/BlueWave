MATCH (n:import_line)
WHERE n.{establishment} in [{fei}]
and EXISTS(n.activity_number)
RETURN 
n.entry, n.doc, n.line,
n.activity_Number, n.activity_description, n.activity_date,
n.Expected_availability_date, n.sample_availability_date,
n.problem_area_flag, n.problem_area_description, n.pac,
n.pac_description, n.suspected_counterfeit_reason,
n.lab_classification_code, n.lab_classification, n.remarks, n.summary