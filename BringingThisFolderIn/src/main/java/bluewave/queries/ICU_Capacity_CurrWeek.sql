--Bed Counts Per Hospital Ordered By Bed Utilization

--covid patients, available icu beds, icu occupancy
--icu_beds_used_7_day_avg/total_icu_beds_7_day_avg

select
    hospital_pk,
    hospital_name,
    hospital_capacity.state,
    lat,lon,
    icu_beds_used_7_day_avg as icu_beds_used,
    total_icu_beds_7_day_avg as total_icu_beds,
    total_adult_hospitalized_suspected_covid_7_day_sum as suspected_cases
from hospital_capacity join hospital_points on hospital_capacity.hospital_pk=hospital_points.id
where collection_week='{week}'
    and icu_beds_used_7_day_avg is not null
    and total_icu_beds_7_day_avg is not null;




MATCH (n:hospital_capacity), (o:hospital_points)
WHERE
    n.hospital_pk = o.id
    and n.collection_week='{week}'
    and EXISTS (n.icu_beds_used_7_day_avg)
    and EXISTS (n.total_icu_beds_7_day_avg)
RETURN
    n.hospital_pk as hospital_pk,
    n.hospital_name as hospital_name,
    n.state as state,
    o.lat as lat,
    o.lon as lon,
    n.icu_beds_used_7_day_avg as icu_beds_used,
    n.total_icu_beds_7_day_avg as total_icu_beds,
    n.total_adult_patients_hospitalized_confirmed_and_suspected_covid_7_day_sum as suspected_cases;