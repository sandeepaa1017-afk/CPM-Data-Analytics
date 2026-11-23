\getenv cpm_db_name CPM_DB_NAME
\getenv cpm_db_user CPM_DB_USER
\getenv cpm_db_password CPM_DB_PASSWORD

SELECT format(
    'CREATE ROLE %I WITH LOGIN PASSWORD %L',
    :'cpm_db_user',
    :'cpm_db_password'
) \gexec

SELECT format(
    'CREATE DATABASE %I OWNER %I',
    :'cpm_db_name',
    :'cpm_db_user'
) \gexec

\connect :cpm_db_name

CREATE SCHEMA IF NOT EXISTS bronze AUTHORIZATION :"cpm_db_user";
CREATE SCHEMA IF NOT EXISTS silver AUTHORIZATION :"cpm_db_user";
CREATE SCHEMA IF NOT EXISTS gold AUTHORIZATION :"cpm_db_user";
