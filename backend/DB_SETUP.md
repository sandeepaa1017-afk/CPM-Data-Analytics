# PostgreSQL registration

Start the services from this directory:

```powershell
docker compose up --build -d
```

The API is available at `http://localhost:8000`; OpenAPI docs are at
`http://localhost:8000/docs`. PostgreSQL listens on `localhost:5432`.

## pgAdmin

1. Select **Add New Server**.
2. On **General**, set the name to `CPM Local`.
3. On **Connection**, enter:
   - Host: `localhost`
   - Port: `5432`
   - Maintenance database: `cpm_db`
   - Username: `cpm_user`
   - Password: the `CPM_DB_PASSWORD` value from `backend/.env`
4. Save the server.

## VS Code PostgreSQL extension

1. Install or open the Microsoft PostgreSQL extension.
2. Choose **Add Connection** and enter:
   - Host: `localhost`
   - Port: `5432`
   - Database: `cpm_db`
   - User: `cpm_user`
   - Password: the `CPM_DB_PASSWORD` value from `backend/.env`
3. Save the connection profile.

## Sample SQL checks

Incoming calls for one employee this week:

```sql
SELECT id, phone_normalized, status, duration_sec, call_datetime
FROM silver.calls
WHERE employee_id = 'EMP-101'
  AND call_type = 'incoming'
  AND call_datetime >= (
    date_trunc('week', now() AT TIME ZONE 'Asia/Kolkata')
    AT TIME ZONE 'Asia/Kolkata'
  )
ORDER BY call_datetime DESC;
```

Daily totals for the last seven days:

```sql
SELECT date, total, incoming, outgoing, missed, talk_seconds, answered_pct
FROM gold.daily_summary
WHERE date >= current_date - 6
ORDER BY date;
```

Row counts in each layer:

```sql
SELECT 'bronze.raw_calls' AS table_name, count(*) FROM bronze.raw_calls
UNION ALL
SELECT 'silver.calls', count(*) FROM silver.calls
UNION ALL
SELECT 'silver.employees', count(*) FROM silver.employees
UNION ALL
SELECT 'silver.devices', count(*) FROM silver.devices
UNION ALL
SELECT 'silver.customers', count(*) FROM silver.customers
UNION ALL
SELECT 'silver.users', count(*) FROM silver.users
UNION ALL
SELECT 'gold.daily_employee_stats', count(*) FROM gold.daily_employee_stats
UNION ALL
SELECT 'gold.daily_summary', count(*) FROM gold.daily_summary;
```

Daily employee totals:

```sql
SELECT s.date, e.id AS employee_id, e.name, s.total, s.answered_pct, s.talk_seconds
FROM gold.daily_employee_stats AS s
JOIN silver.employees AS e ON e.id = s.employee_id
ORDER BY s.date DESC, e.name;
```

Most-called phone numbers in Silver:

```sql
SELECT employee_id, phone_normalized, count(*) AS call_count
FROM silver.calls
GROUP BY employee_id, phone_normalized
ORDER BY call_count DESC, employee_id
LIMIT 20;
```
