from sqlalchemy import create_engine, MetaData, inspect, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator, Dict, List, Any
from app.core.config import settings
import logging
import os

logger = logging.getLogger(__name__)

# SQLAlchemy setup - use SQLite fallback if PostgreSQL isn't available
_db_url = settings.DATABASE_URL
try:
    _test_engine = create_engine(_db_url, pool_pre_ping=True)
    with _test_engine.connect() as _c:
        _c.execute(text("SELECT 1"))
    engine = _test_engine
    logger.info(f"Connected to primary database: {_db_url.split('@')[-1] if '@' in _db_url else _db_url}")
except Exception as e:
    # Fallback to SQLite
    _sqlite_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "querymind.db")
    _db_url = f"sqlite:///{_sqlite_path}"
    engine = create_engine(_db_url, connect_args={"check_same_thread": False})
    logger.warning(f"PostgreSQL unavailable ({e}). Using SQLite at: {_sqlite_path}")

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Redis setup (optional)
try:
    import redis
    redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
    redis_client.ping()
    logger.info("Connected to Redis")
except Exception as e:
    redis_client = None
    logger.warning(f"Redis unavailable ({e}). Caching disabled.")

# MongoDB global setup (optional - for app-level features, NOT user databases)
try:
    from pymongo import MongoClient
    mongo_client = MongoClient(settings.MONGODB_URL, serverSelectionTimeoutMS=3000)
    mongo_client.admin.command('ping')
    mongo_db = mongo_client.get_database("querymind")
    logger.info("Connected to global MongoDB")
except Exception as e:
    mongo_client = None
    mongo_db = None
    logger.warning(f"Global MongoDB unavailable ({e}). MongoDB features require per-connection setup.")


def get_db() -> Generator[Session, None, None]:
    """Get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class DatabaseInspector:
    """Inspect database schema and metadata"""
    
    def __init__(self, db_url: str = None):
        self.db_url = db_url or settings.DATABASE_URL
        self.is_mongodb = self.db_url.startswith(("mongodb://", "mongodb+srv://"))
        
        if self.is_mongodb:
            from pymongo import MongoClient
            try:
                self.mongo_client = MongoClient(self.db_url, serverSelectionTimeoutMS=5000)
                # Try to get database name from URL, otherwise use default
                from urllib.parse import urlparse
                parsed = urlparse(self.db_url)
                self.mongo_db_name = parsed.path.lstrip('/') or "sample_mflix"
                self.mongo_db = self.mongo_client.get_database(self.mongo_db_name)
                logger.info(f"Connected to MongoDB: {self.mongo_db_name}")
                self.engine = None
                self.inspector = None
            except Exception as e:
                logger.error(f"Failed to connect to MongoDB in Inspector: {e}")
                raise e
        else:
            try:
                self.engine = create_engine(self.db_url)
                self.inspector = inspect(self.engine)
                logger.info(f"Initialized Inspector for: {self.engine.dialect.name}")
            except Exception as e:
                logger.error(f"Failed to initialize SQL Engine in Inspector: {e}")
                raise e
    
    def get_schema_info(self) -> Dict[str, Any]:
        """Get complete database schema information"""
        tables = {}
        
        if self.is_mongodb:
            for coll_name in self.mongo_db.list_collection_names():
                # For MongoDB, we sample a doc to get "columns"
                doc = self.mongo_db[coll_name].find_one()
                columns = []
                if doc:
                    for key, value in doc.items():
                        columns.append({
                            "name": key,
                            "type": type(value).__name__,
                            "nullable": True,
                            "default": None,
                            "primary_key": key == "_id"
                        })
                
                tables[coll_name] = {
                    "columns": columns,
                    "foreign_keys": [],
                    "indexes": [],
                    "primary_key": {"constrained_columns": ["_id"]}
                }
            
            # Use the actual string "mongodb" or "mongodb_atlas" as sent from the request
            return {
                "tables": tables,
                "database_type": "mongodb", # Default to mongodb for schema purposes
                "total_tables": len(tables)
            }
        
        for table_name in self.inspector.get_table_names():
            columns = []
            for column in self.inspector.get_columns(table_name):
                columns.append({
                    "name": column["name"],
                    "type": str(column["type"]),
                    "nullable": column["nullable"],
                    "default": column.get("default"),
                    "primary_key": column.get("primary_key", False)
                })
            
            # Get foreign keys
            foreign_keys = []
            for fk in self.inspector.get_foreign_keys(table_name):
                foreign_keys.append({
                    "constrained_columns": fk["constrained_columns"],
                    "referred_table": fk["referred_table"],
                    "referred_columns": fk["referred_columns"]
                })
            
            # Get indexes
            indexes = []
            for idx in self.inspector.get_indexes(table_name):
                indexes.append({
                    "name": idx["name"],
                    "columns": idx["column_names"],
                    "unique": idx["unique"]
                })
            
            tables[table_name] = {
                "columns": columns,
                "foreign_keys": foreign_keys,
                "indexes": indexes,
                "primary_key": self.inspector.get_pk_constraint(table_name)
            }
        
        return {
            "tables": tables,
            "database_type": self.engine.dialect.name,
            "total_tables": len(tables)
        }
    
    def get_table_relationships(self) -> List[Dict[str, Any]]:
        """Get relationships between tables"""
        if self.is_mongodb:
            return []
            
        relationships = []
        
        for table_name in self.inspector.get_table_names():
            for fk in self.inspector.get_foreign_keys(table_name):
                relationships.append({
                    "from_table": table_name,
                    "from_columns": fk["constrained_columns"],
                    "to_table": fk["referred_table"],
                    "to_columns": fk["referred_columns"]
                })
        
        return relationships
    
    def get_sample_data(self, table_name: str, limit: int = 5) -> List[Dict]:
        """Get sample data from a table"""
        if self.is_mongodb:
            docs = list(self.mongo_db[table_name].find().limit(limit))
            # Convert ObjectId to string for JSON serialization
            for doc in docs:
                if "_id" in doc:
                    doc["_id"] = str(doc["_id"])
            return docs
            
        with self.engine.connect() as conn:
            result = conn.execute(text(f"SELECT * FROM {table_name} LIMIT {limit}"))
            columns = result.keys()
            return [dict(zip(columns, row)) for row in result]


def init_db():
    """Initialize database tables"""
    Base.metadata.create_all(bind=engine)


def close_db_connections():
    """Close all database connections"""
    engine.dispose()
    if mongo_client:
        mongo_client.close()
    if redis_client:
        redis_client.close()
