MATCH (n:import_line)
WHERE n.{establishment} in [{fei}]
WITH collect(distinct(n.product_code+"_"+n.product_name)) as products 
CALL{
    WITH products
    MATCH (n:import_line)
           WHERE n.{establishment} in [{fei}]
           AND (n.product_code+"_"+n.product_name) in products
    return 
        n.{establishment} as fei,
        n.product_code as product_code,
        n.product_name as product_name, 
        count(n.entry) as lines,
        sum(toFloat(n.quantity)) as quantity,
        sum(toFloat(n.value)) as value
}
return fei, product_code, product_name, lines, quantity, value order by lines desc