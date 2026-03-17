import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.services.ai_service import ai_service

async def test_schema_context():
    mock_schema = {
        "database_type": "postgresql",
        "tables": {
            "users": {
                "columns": [
                    {"name": "id", "type": "INTEGER", "primary_key": True},
                    {"name": "username", "type": "VARCHAR(50)"},
                    {"name": "email", "type": "VARCHAR(255)"}
                ],
                "primary_key": {"constrained_columns": ["id"]},
                "foreign_keys": []
            },
            "orders": {
                "columns": [
                    {"name": "id", "type": "INTEGER", "primary_key": True},
                    {"name": "user_id", "type": "INTEGER"},
                    {"name": "total", "type": "DECIMAL"}
                ],
                "primary_key": {"constrained_columns": ["id"]},
                "foreign_keys": [
                    {
                        "constrained_columns": ["user_id"],
                        "referred_table": "users",
                        "referred_columns": ["id"]
                    }
                ]
            }
        }
    }
    
    print("--- Postgres Context ---")
    context = ai_service._build_schema_context(mock_schema)
    print(context)
    
    # Test MongoDB
    mock_mongo = {
        "database_type": "mongodb",
        "tables": {
            "movies": {
                "columns": [
                    {"name": "_id", "type": "ObjectId", "primary_key": True},
                    {"name": "title", "type": "str"},
                    {"name": "year", "type": "int"}
                ]
            }
        }
    }
    print("--- MongoDB Context ---")
    print(ai_service._build_schema_context(mock_mongo))

if __name__ == "__main__":
    asyncio.run(test_schema_context())
