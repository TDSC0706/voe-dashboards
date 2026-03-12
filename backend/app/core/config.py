from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # PostgreSQL
    database_url: str = "postgresql+asyncpg://voe:voe_secret_2024@db:5432/voedashboard"
    database_url_sync: str = "postgresql://voe:voe_secret_2024@db:5432/voedashboard"

    # OData
    odata_base_url: str = "https://mekaverso-voe-sandbox.mxapps.io/odata/publish_odata/v1"
    odata_username: str = "odata.user"
    odata_password: str = "Odata@123"

    # Flowup MySQL
    flowup_host: str = "flowupprod-replica.mysql.database.azure.com"
    flowup_port: int = 3306
    flowup_db: str = "flowup"
    flowup_user: str = "mekatronik"
    flowup_password: str = "T0DWFDCP6kyeK76"

    # Sync intervals (seconds)
    odata_sync_interval: int = 300
    flowup_sync_interval: int = 600

    # Auth
    secret_key: str = "voe-dashboard-secret-key-change-in-production"
    access_token_expire_minutes: int = 1440  # 24 hours

    class Config:
        env_file = ".env"


settings = Settings()
