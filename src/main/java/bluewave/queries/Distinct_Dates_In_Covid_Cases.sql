--Returns a list of dates. Works best with the following indexes:
--CREATE INDEX idx_covid_cases_source IF NOT EXISTS FOR (n:covid_cases) ON (n.Source);
--CREATE INDEX idx_covid_cases_id IF NOT EXISTS FOR (n:covid_cases) ON (n.ID);
--CREATE INDEX idx_covid_cases_date IF NOT EXISTS FOR (n:covid_cases) ON (n.Date);

MATCH (n:covid_cases)

WHERE
       (n.ID STARTS WITH 'US' AND SIZE(n.ID)>4)
       AND n.Source='JHU'

RETURN
    distinct(n.Date) as date
ORDER BY date desc;