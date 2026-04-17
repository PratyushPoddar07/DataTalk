from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class DatabaseType(str, Enum):
    POSTGRESQL = "postgresql"
    MYSQL = "mysql"
    MONGODB = "mongodb"
    MONGODB_ATLAS = "mongodb_atlas"
    SQLITE = "sqlite"


class QueryStatus(str, Enum):
    SUCCESS = "success"
    ERROR = "error"
    TIMEOUT = "timeout"
    PROCESSING = "processing"


# User Schemas
class UserBase(BaseModel):
    email: EmailStr
    username: str


class UserCreate(UserBase):
    password: str


class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


# Database Connection Schemas
class DatabaseConnectionCreate(BaseModel):
    name: str
    db_type: DatabaseType
    connection_string: str


class DatabaseConnectionResponse(BaseModel):
    id: int
    name: str
    db_type: DatabaseType
    is_active: bool
    last_sync: Optional[datetime]
    created_at: datetime
    
    class Config:
        from_attributes = True


# Query Schemas
class QueryRequest(BaseModel):
    natural_language_query: str = Field(..., description="User's question in natural language")
    database_id: int = Field(..., description="Target database ID")
    conversation_id: Optional[int] = Field(None, description="Conversation context ID")
    include_insights: bool = Field(True, description="Generate AI insights")
    explain_sql: bool = Field(False, description="Include SQL explanation")


class QueryResponse(BaseModel):
    id: int
    natural_language_query: str
    generated_sql: str
    execution_time_ms: Optional[int]
    result_count: Optional[int]
    status: QueryStatus
    results: Optional[List[Dict[str, Any]]] = None
    insights: Optional[Dict[str, Any]] = None
    sql_explanation: Optional[str] = None
    visualization_suggestions: Optional[List[str]] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


# Schema Information
class ColumnInfo(BaseModel):
    name: str
    type: str
    nullable: bool
    primary_key: bool = False
    default: Optional[str] = None


class TableInfo(BaseModel):
    name: str
    columns: List[ColumnInfo]
    foreign_keys: List[Dict[str, Any]]
    indexes: List[Dict[str, Any]]
    sample_data: Optional[List[Dict[str, Any]]] = None


class SchemaInfo(BaseModel):
    tables: Dict[str, TableInfo]
    relationships: List[Dict[str, Any]]
    database_type: str
    total_tables: int


# AI Insights
class DataInsight(BaseModel):
    type: str  # trend, anomaly, pattern, summary
    title: str
    description: str
    confidence: float
    data_points: Optional[List[Any]] = None


class InsightsResponse(BaseModel):
    insights: List[DataInsight]
    summary: str
    recommendations: List[str]


# Conversation
class ConversationCreate(BaseModel):
    database_id: int
    title: Optional[str] = None


class ConversationResponse(BaseModel):
    id: int
    database_id: int
    title: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# Query Template
class QueryTemplateCreate(BaseModel):
    name: str
    description: Optional[str]
    natural_language_template: str
    sql_template: str
    parameters: Optional[Dict[str, Any]]


class QueryTemplateResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    natural_language_template: str
    usage_count: int
    created_at: datetime
    
    class Config:
        from_attributes = True


# SQL Generation
class SQLGenerationRequest(BaseModel):
    natural_language: str
    schema_context: Dict[str, Any]
    conversation_history: Optional[List[Dict[str, str]]] = None


class SQLGenerationResponse(BaseModel):
    sql: str
    explanation: str
    confidence: float
    tables_used: List[str]
    complexity_score: int


class SchemaAnalysisResponse(BaseModel):
    summary: str
    core_entities: List[str]
    relationship_overview: str
    normalization_tips: List[str]
    best_practices: List[str]
    complexity_rating: int # 1-10


# Visualization
class VisualizationSuggestion(BaseModel):
    chart_type: str  # bar, line, pie, scatter, 3d_scatter, heatmap
    title: str
    description: str
    x_axis: Optional[str]
    y_axis: Optional[str]
    data_mapping: Dict[str, str]


class VisualizationResponse(BaseModel):
    suggestions: List[VisualizationSuggestion]
    recommended: str
    data_prepared: Dict[str, Any]
