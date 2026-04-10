from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from app.db.database import get_db, DatabaseInspector
from app.models.models import Query, DatabaseConnection, User
from app.schemas.schemas import (
    QueryRequest, QueryResponse, QueryStatus,
    DatabaseConnectionCreate, DatabaseConnectionResponse,
    SchemaInfo, InsightsResponse
)
from app.services.ai_service import ai_service
from app.services.query_service import QueryExecutor, QueryValidator
import json
from datetime import datetime

router = APIRouter()


import logging

logger = logging.getLogger(__name__)
# Force a file handler for debugging
debug_handler = logging.FileHandler("backend_debug.log")
debug_handler.setLevel(logging.INFO)
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
debug_handler.setFormatter(formatter)
logger.addHandler(debug_handler)
logger.setLevel(logging.INFO)

# ... existing imports ...

@router.post("/query", response_model=QueryResponse)
async def execute_natural_language_query(
    request: QueryRequest,
    db: Session = Depends(get_db)
):
    """
    Execute a natural language query
    
    This endpoint:
    1. Converts natural language to SQL using AI
    2. Validates and executes the SQL
    3. Generates insights from results
    4. Returns formatted response
    """
    logger.info(f"DEBUG: execute_natural_language_query started for DB ID {request.database_id}")
    
    # Get database connection
    db_conn = db.query(DatabaseConnection).filter(
        DatabaseConnection.id == request.database_id,
        DatabaseConnection.is_active == True
    ).first()
    
    if not db_conn:
        logger.error(f"DEBUG: Database connection {request.database_id} not found")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Database connection not found"
        )
    
    # Get schema information
    logger.info(f"DEBUG: Getting schema info for {db_conn.name}")
    inspector = DatabaseInspector(db_conn.connection_string)
    schema_info = inspector.get_schema_info()
    
    # Get conversation context if provided
    conversation_history = None
    if request.conversation_id:
        # Fetch recent queries from this conversation
        recent_queries = db.query(Query).filter(
            Query.database_id == request.database_id
        ).order_by(Query.created_at.desc()).limit(5).all()
        
        conversation_history = [
            {
                "role": "user",
                "content": q.natural_language_query
            }
            for q in reversed(recent_queries)
        ]
    
    # Generate SQL using AI
    try:
        logger.info(f"DEBUG: Generating SQL for query: {request.natural_language_query}")
        sql_result = await ai_service.generate_sql(
            natural_language=request.natural_language_query,
            schema_info=schema_info,
            conversation_history=conversation_history
        )
        logger.info(f"DEBUG: Generated SQL: {sql_result.sql}")
    except Exception as e:
        logger.error(f"DEBUG: Failed to generate SQL: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate SQL: {str(e)}"
        )
    
    
    # Validate query complexity
    validation = QueryValidator.validate_complexity(sql_result.sql)
    if not validation["is_valid"]:
        logger.warning(f"DEBUG: Query too complex: {validation['issues']}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Query too complex: {', '.join(validation['issues'])}"
        )
    
    # Add safety limits
    safe_sql = QueryValidator.add_safety_limits(sql_result.sql)
    
    # Execute query
    logger.info(f"DEBUG: Executing SQL: {safe_sql}")
    executor = QueryExecutor(db_conn.connection_string)
    execution_result = await executor.execute_query(safe_sql, read_only=False)
    logger.info(f"DEBUG: Execution result status: {execution_result['status']}")
    
    if execution_result["status"] == QueryStatus.ERROR:
        logger.error(f"DEBUG: Execution failed: {execution_result.get('error')}")
    
    # Generate insights if requested
    insights = None
    visualization_suggestions = None
    
    if request.include_insights and execution_result["status"] == QueryStatus.SUCCESS:
        try:
            logger.info("DEBUG: Generating insights")
            insight_list = await ai_service.generate_insights(
                query_results=execution_result["results"],
                original_question=request.natural_language_query
            )
            insights = {
                "insights": [insight.dict() for insight in insight_list],
                "count": len(insight_list)
            }
            
            # Get visualization suggestions
            visualization_suggestions = await ai_service.suggest_visualizations(
                query_results=execution_result["results"],
                original_question=request.natural_language_query
            )
        except Exception as e:
            logger.error(f"Failed to generate insights: {e}")
    
    # Get SQL explanation if requested
    sql_explanation = None
    if request.explain_sql:
        try:
            logger.info("DEBUG: Explaining SQL")
            sql_explanation = await ai_service.explain_sql(
                sql=safe_sql,
                schema_info=schema_info
            )
        except Exception as e:
            logger.error(f"Failed to explain SQL: {e}")
    
    # Save query to database
    query_record = Query(
        user_id=1,  # TODO: Get from authenticated user
        database_id=request.database_id,
        natural_language_query=request.natural_language_query,
        generated_sql=safe_sql,
        execution_time_ms=execution_result["execution_time_ms"],
        result_count=execution_result.get("result_count", 0),
        status=execution_result["status"].value,
        error_message=execution_result.get("error"),
        insights=insights,
        context={"conversation_id": request.conversation_id} if request.conversation_id else None
    )
    
    db.add(query_record)
    db.commit()
    db.refresh(query_record)
    
    # Build response
    return QueryResponse(
        id=query_record.id,
        natural_language_query=request.natural_language_query,
        generated_sql=safe_sql,
        execution_time_ms=execution_result["execution_time_ms"],
        result_count=execution_result.get("result_count", 0),
        status=execution_result["status"],
        results=execution_result["results"] if execution_result["status"] == QueryStatus.SUCCESS else None,
        insights=insights,
        sql_explanation=sql_explanation,
        visualization_suggestions=visualization_suggestions,
        created_at=query_record.created_at
    )


@router.get("/databases/{database_id}/schema", response_model=Dict[str, Any])
async def get_database_schema(
    database_id: int,
    db: Session = Depends(get_db)
):
    """Get database schema information"""
    
    db_conn = db.query(DatabaseConnection).filter(
        DatabaseConnection.id == database_id
    ).first()
    
    if not db_conn:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Database connection not found"
        )
    
    inspector = DatabaseInspector(db_conn.connection_string)
    schema_info = inspector.get_schema_info()
    relationships = inspector.get_table_relationships()
    
    return {
        **schema_info,
        "relationships": relationships
    }


@router.get("/databases/{database_id}/tables/{table_name}/sample")
async def get_table_sample(
    database_id: int,
    table_name: str,
    limit: int = 5,
    db: Session = Depends(get_db)
):
    """Get sample data from a table"""
    
    db_conn = db.query(DatabaseConnection).filter(
        DatabaseConnection.id == database_id
    ).first()
    
    if not db_conn:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Database connection not found"
        )
    
    inspector = DatabaseInspector(db_conn.connection_string)
    
    try:
        sample_data = inspector.get_sample_data(table_name, limit)
        return {
            "table_name": table_name,
            "sample_data": sample_data,
            "row_count": len(sample_data)
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch sample data: {str(e)}"
        )


@router.delete("/databases/{database_id}/tables/{table_name}")
async def delete_database_table(
    database_id: int,
    table_name: str,
    db: Session = Depends(get_db)
):
    """Delete (Drop) a table or collection from the database"""
    
    db_conn = db.query(DatabaseConnection).filter(
        DatabaseConnection.id == database_id
    ).first()
    
    if not db_conn:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Database connection not found"
        )
    
    try:
        if db_conn.db_type.lower() in ["mongodb", "mongodb_atlas"]:
            from pymongo import MongoClient
            client = MongoClient(db_conn.connection_string)
            from urllib.parse import urlparse
            parsed = urlparse(db_conn.connection_string)
            mongo_db_name = parsed.path.lstrip('/') or "sample_mflix"
            mongo_db = client.get_database(mongo_db_name)
            mongo_db.drop_collection(table_name)
        else:
            from sqlalchemy import create_engine, text
            engine = create_engine(db_conn.connection_string)
            with engine.connect() as conn:
                conn.execute(text(f"DROP TABLE {table_name}"))
        
        # Optionally invalidate schema_cache
        db_conn.schema_cache = None
        db.commit()
        
        logger.info(f"Dropped table/collection {table_name} from DB {database_id}")
        return {"message": f"Table '{table_name}' deleted successfully"}
        
    except Exception as e:
        logger.error(f"Failed to delete table {table_name}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete table: {str(e)}"
        )


@router.get("/queries/history", response_model=List[QueryResponse])
async def get_query_history(
    database_id: int = None,
    limit: int = 20,
    db: Session = Depends(get_db)
):
    """Get query history"""
    
    query = db.query(Query)
    
    if database_id:
        query = query.filter(Query.database_id == database_id)
    
    queries = query.order_by(Query.created_at.desc()).limit(limit).all()
    
    return [
        QueryResponse(
            id=q.id,
            natural_language_query=q.natural_language_query,
            generated_sql=q.generated_sql,
            execution_time_ms=q.execution_time_ms,
            result_count=q.result_count,
            status=QueryStatus(q.status),
            insights=q.insights,
            created_at=q.created_at
        )
        for q in queries
    ]


@router.post("/databases", response_model=DatabaseConnectionResponse)
async def create_database_connection(
    connection: DatabaseConnectionCreate,
    db: Session = Depends(get_db)
):
    """Create a new database connection"""
    
    # Test connection
    logger.info(f"DEBUG: Attempting to connect to: {connection.connection_string}")
    try:
        executor = QueryExecutor(connection.connection_string)
        is_connected = await executor.test_connection()
        logger.info(f"DEBUG: Connection test result: {is_connected}")
        
        if not is_connected:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to connect to database"
            )
        
        executor.close()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid connection: {str(e)}"
        )
    
    # Create database connection record
    db_conn = DatabaseConnection(
        user_id=1,  # TODO: Get from authenticated user
        name=connection.name,
        db_type=connection.db_type.value,
        connection_string=connection.connection_string,
        is_active=True
    )
    
    db.add(db_conn)
    db.commit()
    db.refresh(db_conn)
    
    # Cache schema
    try:
        inspector = DatabaseInspector(connection.connection_string)
        schema_info = inspector.get_schema_info()
        
        db_conn.schema_cache = schema_info
        db_conn.last_sync = datetime.utcnow()
        db.commit()
    except Exception as e:
        # We still created the connection, but schema sync failed
        db_conn.last_sync = None
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Connection saved, but failed to sync schema: {str(e)}"
        )
    
    return db_conn


@router.get("/databases", response_model=List[DatabaseConnectionResponse])
async def list_databases(db: Session = Depends(get_db)):
    """List all database connections"""
    
    databases = db.query(DatabaseConnection).filter(
        DatabaseConnection.is_active == True
    ).all()
    
    return databases


@router.delete("/databases/{database_id}")
async def delete_database_connection(
    database_id: int,
    db: Session = Depends(get_db)
):
    """Delete a database connection and all associated data"""
    
    db_conn = db.query(DatabaseConnection).filter(
        DatabaseConnection.id == database_id
    ).first()
    
    if not db_conn:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Database connection not found"
        )
    
    try:
        # Delete associated queries first (foreign key constraint)
        db.query(Query).filter(Query.database_id == database_id).delete()
        
        # Delete the database connection
        db.delete(db_conn)
        db.commit()
        
        logger.info(f"Deleted database connection {database_id}: {db_conn.name}")
        
        return {"message": f"Database '{db_conn.name}' deleted successfully", "id": database_id}
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to delete database connection {database_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete database: {str(e)}"
        )

