
SELECT cases.*, tests FROM
(
    select Date,Cases_New as cases from covid_unified where id ='US' and type='Confirmed'
) cases
INNER JOIN
(
    select Date,Cases_New as tests from covid_unified where id ='US' and type='Tests'
) tests

on cases.date=tests.date
order by date