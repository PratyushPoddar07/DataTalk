from anthropic import Anthropic
from openai import OpenAI
from typing import Dict, Any, List, Optional
import json
from app.core.config import settings
from app.schemas.schemas import SQLGenerationResponse, DataInsight
import re


class AIService:
    """AI service for natural language processing and SQL generation"""
    
    def __init__(self):
        self.use_openai = bool(settings.OPENAI_API_KEY and settings.OPENAI_API_KEY != "your_openai_api_key_here")
        self.use_anthropic = bool(settings.ANTHROPIC_API_KEY and settings.ANTHROPIC_API_KEY != "your_anthropic_api_key_here")
        
        if self.use_openai:
            self.openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)
            self.openai_model = "gpt-4o"
        
        if self.use_anthropic:
            self.anthropic_client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)
            self.anthropic_model = "claude-3-5-sonnet-20240620"
        
        # Default to OpenAI if available, else Anthropic
        self.preferred_provider = "openai" if self.use_openai else "anthropic"
    
    async def _call_ai(self, prompt: str, max_tokens: int = 2000) -> str:
        """Helper to call the preferred AI provider"""
        if self.preferred_provider == "openai":
            response = self.openai_client.chat.completions.create(
                model=self.openai_model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=max_tokens,
                response_format={"type": "json_object"} if "JSON" in prompt.upper() else None
            )
            return response.choices[0].message.content
        else:
            response = self.anthropic_client.messages.create(
                model=self.anthropic_model,
                max_tokens=max_tokens,
                messages=[{"role": "user", "content": prompt}]
            )
            return response.content[0].text

    async def generate_sql(
        self,
        natural_language: str,
        schema_info: Dict[str, Any],
        conversation_history: Optional[List[Dict[str, str]]] = None
    ) -> SQLGenerationResponse:
        """Generate SQL or MongoDB query from natural language query"""
        
        db_type = schema_info.get("database_type", "postgresql").lower()
        is_mongodb = "mongodb" in db_type.lower()
        
        # Build context from schema
        schema_context = self._build_schema_context(schema_info)
        
        # Build conversation context
        conversation_context = ""
        if conversation_history:
            conversation_context = "\n\nPrevious conversation:\n"
            for msg in conversation_history[-5:]:  # Last 5 messages
                conversation_context += f"{msg['role']}: {msg['content']}\n"
        
        if is_mongodb:
            query_type = "MongoDB operation (Aggregation, Insert, Update, Delete, or Drop)"
            syntax_rules = """
1. Use MongoDB aggregation pipeline syntax as a JSON array if reading data.
2. If the user wants to INSERT, UPDATE, DELETE, or DROP, use the following JSON wrapper format:
   - Aggregation: {"collection": "coll", "pipeline": [...]}
   - Insert: {"collection": "coll", "insert": {document}}
   - Update: {"collection": "coll", "update": {$set: {...}}, "filter": {...}}
   - Delete: {"collection": "coll", "delete": true, "filter": {...}}
   - Drop (collection/table): {"collection": "coll", "drop": true}
3. Optimize for performance.
"""
        else:
            query_type = "precise SQL query (SELECT, INSERT, UPDATE, DELETE, CREATE, etc.)"
            syntax_rules = """
1. Use proper SQL syntax for the database type.
2. Support full database control: SELECT, INSERT, UPDATE, DELETE, CREATE TABLE, ALTER, DROP, etc.
3. Include appropriate WHERE clauses, JOINs, and aggregations for analytical queries.
4. If the user provides raw data (like CSV, Markdown tables, or lists) and asks to add/insert it, you MUST generate a CREATE TABLE statement (if the table doesn't map to an existing one) followed by INSERT statements to insert all the provided data rows. Ensure multiple statements are properly separated by semicolons.
5. Optimize for performance.
6. Return ONLY valid SQL.
"""

        prompt = f"""You are an expert database administrator and query generator. 
Convert the natural language command/question into a {query_type}.

Database Type: {db_type}
Database Schema:
{schema_context}
{conversation_context}

User Input: {natural_language}

Rules:
{syntax_rules}
6. Return ONLY valid response, no explanations in the query itself.

Respond in JSON format:
{{
    "sql": "Actual query string or JSON operation object",
    "explanation": "Brief non-technical explanation of what this query/operation will do",
    "confidence": 0.95,
    "tables_used": ["collection_name_or_table"],
    "complexity_score": 5
}}
"""
        
        content = await self._call_ai(prompt, max_tokens=2000)
        
        # Extract JSON from response
        # First, try to find a JSON object { ... }
        object_match = re.search(r'\{.*\}', content, re.DOTALL)
        if object_match:
            try:
                result = json.loads(object_match.group())
            except json.JSONDecodeError:
                # If nested object parsing failed, try to get just the first matching pair
                result = self._fallback_parse_json(content)
        else:
            # Fallback parsing
            result = {
                "sql": content.strip().split(';')[0] + ';',
                "explanation": "Query generated",
                "confidence": 0.5,
                "tables_used": [],
                "complexity_score": 5
            }
        
        return SQLGenerationResponse(**result)
    
    async def generate_insights(
        self,
        query_results: List[Dict[str, Any]],
        original_question: str
    ) -> List[DataInsight]:
        """Generate AI-powered insights and plain-language summaries from query results"""
        
        if not query_results:
            return [DataInsight(
                type="summary",
                title="No results found",
                description="The query executed successfully but returned no data matching your criteria.",
                confidence=1.0
            )]
        
        # Prepare data summary
        data_summary = {
            "row_count": len(query_results),
            "columns": list(query_results[0].keys()) if query_results else [],
            "sample_data": query_results[:10] # Give more samples
        }
        
        prompt = f"""Analyze the following dataset and explain what it means in plain, non-technical English.

User's Original Goal: {original_question}

Data Summary:
{json.dumps(data_summary, indent=2, default=str)}

Provide insights in JSON format as an object with an "insights" key containing the array:
{{
    "insights": [
    {{
        "type": "summary|trend|anomaly|pattern",
        "title": "Clear Headline",
        "description": "Plain language explanation",
        "confidence": 0.0-1.0
    }}
]
}}

Focus on:
- Interpreting the numbers (e.g., "The average sales are higher than last month")
- Identifying key takeaways
- Explaining unusual findings
"""
        
        content = await self._call_ai(prompt, max_tokens=1500)
        
        # Extract JSON array or object
        object_match = re.search(r'\{.*\}', content, re.DOTALL)
        array_match = re.search(r'\[.*\]', content, re.DOTALL)
        
        try:
            if object_match:
                data = json.loads(object_match.group())
                insights_data = data.get("insights", data) if isinstance(data, dict) else data
            elif array_match:
                insights_data = json.loads(array_match.group())
            else:
                return []
                
            if isinstance(insights_data, list):
                return [DataInsight(**insight) for insight in insights_data]
            return []
        except Exception as e:
            print(f"Error parsing insights JSON: {e}")
            return []
            
    def _fallback_parse_json(self, content: str) -> Dict[str, Any]:
        """Simple fallback to find the first JSON-like block if re.DOTALL is too greedy"""
        try:
            # Attempt to find the first balance of braces
            stack = 0
            start = -1
            for i, char in enumerate(content):
                if char == '{':
                    if stack == 0: start = i
                    stack += 1
                elif char == '}':
                    stack -= 1
                    if stack == 0 and start != -1:
                        return json.loads(content[start:i+1])
        except:
            pass
        return {}
    
    async def explain_sql(self, sql: str, schema_info: Dict[str, Any]) -> str:
        """Explain SQL query in plain language"""
        
        prompt = f"""Explain this SQL query in simple, non-technical language:

SQL Query:
{sql}

Database Schema:
{self._build_schema_context(schema_info)}

Provide a clear explanation that a non-technical person can understand.
Focus on:
1. What data is being retrieved
2. Which tables are involved
3. Any filtering or grouping logic
4. The purpose of the query
"""
        
        content = await self._call_ai(prompt, max_tokens=800)
        return content
    
    async def suggest_visualizations(
        self,
        query_results: List[Dict[str, Any]],
        original_question: str
    ) -> List[str]:
        """Suggest appropriate visualization types for the data"""
        
        if not query_results:
            return []
        
        columns = list(query_results[0].keys()) if query_results else []
        
        prompt = f"""Based on the following data, suggest appropriate visualization types:

Original Question: {original_question}
Columns: {', '.join(columns)}
Row Count: {len(query_results)}

Suggest 2-3 visualization types from:
- bar_chart
- line_chart
- pie_chart
- scatter_plot
- 3d_scatter
- heatmap
- table
- area_chart

Return as JSON array: ["type1", "type2", "type3"]
"""
        
        content = await self._call_ai(prompt, max_tokens=300)
        json_match = re.search(r'\[.*\]', content, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())
        
        return ["table"]
    
    def _build_schema_context(self, schema_info: Dict[str, Any]) -> str:
        """Build a readable schema context for the AI including keys and relationships"""
        context = []
        
        tables = schema_info.get("tables", {})
        for table_name, table_data in tables.items():
            # Build columns list
            columns_str = ", ".join([
                f"{col['name']} ({col['type']}{' - PK' if col.get('primary_key') else ''})"
                for col in table_data.get("columns", [])
            ])
            
            table_desc = f"Table: {table_name}\nColumns: {columns_str}"
            
            # Add Primary Key summary if available and not explicitly tagged beside column name
            pk = table_data.get("primary_key", {})
            if pk and pk.get("constrained_columns"):
                table_desc += f"\nPrimary Key: {', '.join(pk['constrained_columns'])}"
            
            # Add Foreign keys
            fks = table_data.get("foreign_keys", [])
            if fks:
                table_desc += "\nForeign Keys:"
                for fk in fks:
                    table_desc += f"\n  - {', '.join(fk['constrained_columns'])} -> {fk['referred_table']}({', '.join(fk['referred_columns'])})"
            
            context.append(table_desc + "\n")
        
        return "\n".join(context)
    
    async def optimize_query(self, sql: str, schema_info: Dict[str, Any]) -> str:
        """Suggest query optimizations"""
        
        prompt = f"""Analyze this SQL query and suggest optimizations:

{sql}

Schema:
{self._build_schema_context(schema_info)}

Provide optimization suggestions for:
- Index usage
- JOIN optimization
- Query structure
- Performance improvements
"""
        
        content = await self._call_ai(prompt, max_tokens=1000)
        return content

    async def analyze_schema(self, schema_info: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze the entire database schema and provide architectural insights"""
        
        schema_context = self._build_schema_context(schema_info)
        db_type = schema_info.get("database_type", "postgresql")
        total_tables = schema_info.get("total_tables", 0)
        
        prompt = f"""You are a senior Database Architect. Analyze the following database schema and provide a comprehensive architectural review.

Database Type: {db_type}
Total Tables: {total_tables}

Schema Context:
{schema_context}

Respond in JSON format with the following structure:
{{
    "summary": "A 2-3 sentence overview of what this database is designed for.",
    "core_entities": ["List of the 3-5 most important tables"],
    "relationship_overview": "A brief explanation of how the main tables connect.",
    "normalization_tips": ["List of suggestions to improve data structure"],
    "best_practices": ["List of database-specific best practices applicable here"],
    "complexity_rating": 1-10
}}
"""
        
        content = await self._call_ai(prompt, max_tokens=1500)
        
        # Extract JSON
        object_match = re.search(r'\{.*\}', content, re.DOTALL)
        if object_match:
            try:
                return json.loads(object_match.group())
            except:
                pass
        
        return {
            "summary": "Database schema analysis complete.",
            "core_entities": list(schema_info.get("tables", {}).keys())[:3],
            "relationship_overview": "Table relationships identified based on foreign keys.",
            "normalization_tips": ["Ensure indexes are present on all foreign keys."],
            "best_practices": ["Maintain consistent naming conventions."],
            "complexity_rating": 5
        }


# Singleton instance
ai_service = AIService()
