--Bed Counts Per Hospital Compared to Previous Week
select a.*, b.beds_used as prev_beds_used, b.total_beds as prev_total_beds, b.suspected_cases as prev_suspected_cases from (
select
    hospital_pk,
    hospital_name,
    hospital_capacity.state,
    lat,lon,
    inpatient_beds_used_7_day_sum as beds_used,
    total_beds_7_day_sum as total_beds,
    total_adult_hospitalized_suspected_covid_7_day_sum as suspected_cases
from hospital_capacity join hospital_points on hospital_capacity.hospital_pk=hospital_points.id
where collection_week='{week}'
    and inpatient_beds_used_7_day_sum is not null
    and total_beds_7_day_sum is not null
) as a
join (
select
    hospital_pk,
    inpatient_beds_used_7_day_sum as beds_used,
    total_beds_7_day_sum as total_beds,
    total_adult_hospitalized_suspected_covid_7_day_sum as suspected_cases
from hospital_capacity join hospital_points on hospital_capacity.hospital_pk=hospital_points.id
where collection_week='{prev_week}'
    and inpatient_beds_used_7_day_sum is not null
    and total_beds_7_day_sum is not null
) as b on a.hospital_pk=b.hospital_pk;






MATCH (n:hospital_capacity), (o:hospital_points)
WHERE
    n.hospital_pk = o.id
    and n.collection_week='{week}'
    and EXISTS (n.inpatient_beds_used_7_day_sum)
    and EXISTS (n.total_beds_7_day_sum)
WITH COLLECT([
    n.hospital_pk,
    n.hospital_name,
    n.state,
    o.lat,
    o.lon,
    n.inpatient_beds_used_7_day_sum,
    n.total_beds_7_day_sum,
    n.total_adult_patients_hospitalized_confirmed_and_suspected_covid_7_day_sum
]) as a
UNWIND a AS col

CALL {
    WITH col
    MATCH (n:hospital_capacity) WHERE n.hospital_pk = col[0] and n.collection_week='{prev_week}'
    RETURN
        col[0] as hospital_pk,
        col[1] as hospital_name,
        col[2] as state,
        col[3] as lat,
        col[4] as lon,
        col[5] as beds_used,
        col[6] as total_beds,
        col[7] as suspected_cases,
        n.inpatient_beds_used_7_day_sum as prev_beds_used,
        n.total_beds_7_day_sum as prev_total_beds,
        n.total_adult_patients_hospitalized_confirmed_and_suspected_covid_7_day_sum as prev_suspected_cases
}
RETURN
    hospital_pk, hospital_name, state, lat, lon, beds_used, total_beds, suspected_cases, prev_beds_used, prev_total_beds, prev_suspected_cases;
