with vars as (
select distinct(id) from covid_unified where char_length(id)=2
)


SELECT cases.*, tests FROM
(
    select ID,Date,Cases_New as cases from covid_unified where id in (select id from vars) and type='Confirmed'
) cases
INNER JOIN
(
    select Date,Cases_New as tests from covid_unified where id in (select id from vars) and type='Tests'
) tests

on cases.date=tests.date
order by date, id