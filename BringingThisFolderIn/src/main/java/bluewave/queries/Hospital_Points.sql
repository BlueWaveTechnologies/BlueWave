select
    id,
    lat,
    lon
from hospital_points
where
    lat is not null
    and lon is not null;


MATCH (n:hospital_points)
WHERE
    EXISTS (n.lat)
    and EXISTS (n.lon)
RETURN
    n.id as id,
    n.lat as lat,
    n.lon as lon;