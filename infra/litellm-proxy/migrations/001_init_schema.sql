CREATE SCHEMA IF NOT EXISTS litellm_proxy;

-- El rol litellm_admin requiere permisos de uso sobre el esquema
DO
$$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'litellm_admin') THEN
    CREATE ROLE litellm_admin WITH LOGIN PASSWORD 'CHANGE_ME_IN_PROD';
  END IF;
END
$$;

GRANT USAGE, CREATE ON SCHEMA litellm_proxy TO litellm_admin;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA litellm_proxy TO litellm_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA litellm_proxy GRANT ALL PRIVILEGES ON TABLES TO litellm_admin;
