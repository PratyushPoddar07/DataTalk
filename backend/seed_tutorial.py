import os
import sqlite3
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
from urllib.parse import urlparse

# Load environment variables
load_dotenv(".env")

# Sample Data
STUDENTS_DATA = [
    {"RollNo": 1, "Name": "John", "Age": 20, "Grade": "A"},
    {"RollNo": 2, "Name": "Alice", "Age": 21, "Grade": "B"},
    {"RollNo": 3, "Name": "Bob", "Age": 19, "Grade": "A"}
]

COURSES_DATA = [
    {"CourseID": 101, "RollNo": 1, "CourseName": "Computer Science"},
    {"CourseID": 102, "RollNo": 2, "CourseName": "Data Science"},
    {"CourseID": 103, "RollNo": 4, "CourseName": "Mathematics"}
]

SQL_QUERIES = [
    "DROP TABLE IF EXISTS Students CASCADE;",
    "DROP TABLE IF EXISTS Courses CASCADE;",
    """
    CREATE TABLE IF NOT EXISTS Students (
        RollNo INT PRIMARY KEY,
        Name VARCHAR(255),
        Age INT,
        Grade VARCHAR(10)
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS Courses (
        CourseID INT PRIMARY KEY,
        RollNo INT,
        CourseName VARCHAR(255)
    );
    """
]

def run_sql_seed(db_url, name="SQL"):
    print(f"--- Seeding SQL Tutorial Data for {name} ---")
    try:
        engine = create_engine(db_url)
        with engine.connect() as conn:
            # 1. Create Tables
            for sql in SQL_QUERIES:
                try:
                    if "CASCADE" in sql.upper() and "sqlite" in db_url.lower():
                        sql = sql.replace(" CASCADE", "")
                    conn.execute(text(sql))
                except Exception as e:
                    if "does not exist" in str(e).lower() or "no such table" in str(e).lower():
                        continue
                    print(f"  Warning creating tables: {str(e)}")
            
            # 2. Insert Students
            for s in STUDENTS_DATA:
                try:
                    conn.execute(text("INSERT INTO Students (RollNo, Name, Age, Grade) VALUES (:r, :n, :a, :g) ON CONFLICT (RollNo) DO NOTHING"), 
                                {"r": s["RollNo"], "n": s["Name"], "a": s["Age"], "g": s["Grade"]})
                except Exception as e:
                    # Fallback for SQLite which might not support ON CONFLICT if very old, or use dummy insert
                    try:
                        conn.execute(text("INSERT OR IGNORE INTO Students (RollNo, Name, Age, Grade) VALUES (:r, :n, :a, :g)"), 
                                    {"r": s["RollNo"], "n": s["Name"], "a": s["Age"], "g": s["Grade"]})
                    except:
                        pass

            # 3. Insert Courses
            for c in COURSES_DATA:
                try:
                    conn.execute(text("INSERT INTO Courses (CourseID, RollNo, CourseName) VALUES (:c, :r, :n) ON CONFLICT (CourseID) DO NOTHING"),
                                {"c": c["CourseID"], "r": c["RollNo"], "n": c["CourseName"]})
                except Exception as e:
                    try:
                        conn.execute(text("INSERT OR IGNORE INTO Courses (CourseID, RollNo, CourseName) VALUES (:c, :r, :n)"),
                                    {"c": c["CourseID"], "r": c["RollNo"], "n": c["CourseName"]})
                    except:
                        pass
            
            conn.commit()
            print(f"  Success: Tutorial data seeded into {name}")
    except Exception as e:
        print(f"  Error seeding SQL {name}: {str(e)}")

def run_mongodb_seed(conn_string, name="MongoDB"):
    print(f"--- Seeding MongoDB Tutorial Data for {name} ---")
    try:
        from pymongo import MongoClient
        import certifi
        
        client = MongoClient(
            conn_string, 
            serverSelectionTimeoutMS=5000,
            tlsCAFile=certifi.where()
        )
        
        # Determine database name
        parsed = urlparse(conn_string)
        db_name = parsed.path.lstrip('/') or "querymind_tutorial"
        if '?' in db_name: db_name = db_name.split('?')[0]
        
        db = client.get_database(db_name)
        
        # Seed Students
        students_coll = db.get_collection("students")
        # students_coll.delete_many({}) # Option to clear
        for s in STUDENTS_DATA:
            students_coll.update_one({"RollNo": s["RollNo"]}, {"$set": s}, upsert=True)
            
        # Seed Courses
        courses_coll = db.get_collection("courses")
        for c in COURSES_DATA:
            courses_coll.update_one({"CourseID": c["CourseID"]}, {"$set": c}, upsert=True)
            
        print(f"  Success: Tutorial data seeded into MongoDB ({db_name})")
        client.close()
    except Exception as e:
        print(f"  Error seeding MongoDB {name}: {str(e)}")

def get_registered_connections():
    try:
        conn = sqlite3.connect('querymind.db')
        cursor = conn.cursor()
        cursor.execute('SELECT name, db_type, connection_string FROM database_connections WHERE is_active = 1')
        conns = cursor.fetchall()
        conn.close()
        return conns
    except Exception as e:
        print(f"Error reading querymind.db: {e}")
        return []

if __name__ == "__main__":
    app_connections = get_registered_connections()
    if app_connections:
        print(f"Found {len(app_connections)} active connections in app DB.")
        for name, db_type, conn_str in app_connections:
            if db_type in ["mongodb", "mongodb_atlas"] or conn_str.startswith(("mongodb://", "mongodb+srv://")):
                run_mongodb_seed(conn_str, name)
            else:
                run_sql_seed(conn_str, name)
    else:
        print("No active connections found to seed.")

    # Always seed local test_data.db for good measure solo testing
    run_sql_seed("sqlite:///test_data.db", "Local-Test-SQLite")
    
    print("\n--- TUTORIAL SEEDING COMPLETE ---")
