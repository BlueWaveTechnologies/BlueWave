MATCH (n:import_entry)
WHERE n.country_of_origin IN[{country}]
RETURN
n.{establishment} as fei,
count(n.{establishment}) as num_entries,
COLLECT(n.product_code+"/"+n.Value+"/"+n.Quantity) as quantities
order by num_entries desc