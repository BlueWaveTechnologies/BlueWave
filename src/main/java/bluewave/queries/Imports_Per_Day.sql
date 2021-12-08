MATCH (n:import_entry)
WHERE n.country_of_origin IN['TH']
RETURN
n.date as day,
count(n.date) as num_entries