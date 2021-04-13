MATCH (n:covid_cases)
WHERE

       (n.ID STARTS WITH 'US' AND SIZE(n.ID)>4)
       AND n.Source='JHU'
       AND n.Date IN [{dates}]
       AND n.Type IN ['Deaths','Confirmed']

RETURN
    substring(n.ID, 2) as county,
    n.Date as date,
    n.Cases as total,
    n.Cases_New as new,
    n.Type as type;