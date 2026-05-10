from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool, create_engine
from alembic import context
import os
import sys
from dotenv import load_dotenv

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from main import Base, DATABASE_URL

load_dotenv()

# Alembic Config object
config = context.config

# Set up logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Set target metadata
target_metadata = Base.metadata

# Convert async pooler URL to sync session pooler URL for migrations
# Your actual host: aws-0-ap-south-1.pooler.supabase.com
SYNC_URL = DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
SYNC_URL = SYNC_URL.replace(
    "aws-0-ap-south-1.pooler.supabase.com:6543",
    "db.dzyysavunvecwjtqgued.supabase.co:6543"
)

# Escape % for configparser
config.set_main_option("sqlalchemy.url", SYNC_URL.replace("%", "%%"))


def run_migrations_offline():
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    url = url.replace("%%", "%")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    """Run migrations in 'online' mode."""
    connectable = create_engine(SYNC_URL, poolclass=pool.NullPool)

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()