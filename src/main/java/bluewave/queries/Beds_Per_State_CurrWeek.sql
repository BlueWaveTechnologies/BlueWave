--Hospital Capacity By State (Plus Suspected COVID Cases)

--Note that column names DO NOT match source data. The following substitutions
--were made when loading the data into postgresql so the column names would fit:
--colName = colName.replace("-", "N").replace("+", "P");
--colName = colName.replace("patients_", "");
--colName = colName.replace("confirmed_and_suspected", "suspected");

select
    state,
    sum(total_adult_hospitalized_suspected_covid_7_day_sum) as suspected_cases,
    sum(inpatient_beds_used_7_day_sum) as beds_used,
    sum(total_beds_7_day_sum) as total_beds
from hospital_capacity
where collection_week='{week}'
    and total_adult_hospitalized_suspected_covid_7_day_sum is not null
    and inpatient_beds_used_7_day_sum is not null
    and total_beds_7_day_sum is not null
group by state;



MATCH (n:hospital_capacity)
WHERE
    n.collection_week='{week}'
    and EXISTS (n.total_adult_patients_hospitalized_confirmed_and_suspected_covid_7_day_sum)
    and EXISTS (n.inpatient_beds_used_7_day_sum)
    and EXISTS (n.total_beds_7_day_sum)
RETURN
    n.state as state,
    sum(toFloat(n.total_adult_patients_hospitalized_confirmed_and_suspected_covid_7_day_sum)) as suspected_cases,
    sum(toFloat(n.inpatient_beds_used_7_day_sum)) as beds_used,
    sum(toFloat(n.total_beds_7_day_sum)) as total_beds,
count(n.state) as group_by;