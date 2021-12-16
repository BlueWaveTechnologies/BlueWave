MATCH (n:import_line)
WHERE n.{establishment}={fei}
WITH collect(distinct(n.unladed_port+"_"+n.shipment_method)) as ports 
CALL{
    WITH ports
    MATCH (n:import_line)
           WHERE n.{establishment}={fei}
           AND (n.unladed_port+"_"+n.shipment_method) in ports
        return 
        n.unladed_port as port,
        n.shipment_method as method, 
count(n.entry) as lines,
sum(toFloat(n.quantity)) as quantity,
sum(toFloat(n.value)) as value
}
return port, method, lines, quantity, value order by port, method