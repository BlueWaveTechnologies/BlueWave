--Bed Counts Per Hospital Ordered By Bed Utilization
select
    hospital_name,
    hospital_capacity.state,
    lat,lon,
    inpatient_beds_used_7_day_sum as beds_used,
    total_beds_7_day_sum as total_beds,
    total_adult_hospitalized_suspected_covid_7_day_sum as suspected_cases,
    (inpatient_beds_used_7_day_sum/total_beds_7_day_sum)*100 as rate
from hospital_capacity join hospital_points on hospital_capacity.hospital_pk=hospital_points.id
where collection_week='{week}'
    and inpatient_beds_used_7_day_sum is not null
    and total_beds_7_day_sum is not null
order by rate desc;