select distinct(collection_week) as collection_week
from hospital_capacity
order by collection_week desc;


MATCH (n:hospital_capacity)
RETURN
    distinct(n.collection_week) as collection_week
ORDER BY collection_week desc;