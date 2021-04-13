select
    collection_week,
    state,
    (sum(inpatient_beds_used_7_day_sum)/sum(total_beds_7_day_sum))*100 as rate
from hospital_capacity
where
    inpatient_beds_used_7_day_sum is not null and total_beds_7_day_sum is not null
group by collection_week, state
order by rate desc;




MATCH (n:hospital_capacity)
WHERE
    EXISTS (n.inpatient_beds_used_7_day_sum) and EXISTS (n.total_beds_7_day_sum)
RETURN
    n.collection_week as collection_week,
    n.state as state,
    (sum(toFloat(n.inpatient_beds_used_7_day_sum))/sum(toFloat(n.total_beds_7_day_sum)))*100 as rate,
    count(n.collection_week+n.state) as group_by
order by rate desc;