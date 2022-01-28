MATCH (n:import_line)
RETURN
n.product_code as product_code,
count(n.product_code) as num_entries,
COLLECT(distinct(n.country_of_origin)) as countries
order by num_entries desc