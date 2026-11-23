from app.config import normalize_database_url


def test_normalize_managed_postgres_url_for_psycopg():
    url = normalize_database_url(
        "postgresql://user:password@db.example.com:5432/cpm_db"
    )

    assert url.drivername == "postgresql+psycopg"
    assert url.host == "db.example.com"


def test_production_database_url_requires_tls():
    url = normalize_database_url(
        "postgres://user:password@db.example.com/cpm_db",
        require_ssl=True,
    )

    assert url.drivername == "postgresql+psycopg"
    assert url.query["sslmode"] == "require"
