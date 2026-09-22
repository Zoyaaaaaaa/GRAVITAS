from sqlalchemy import create_engine, Column, String, Integer, Text, DateTime, JSON, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
from ..core.config import settings

Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True)
    email = Column(String, unique=True, nullable=False)
    name = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    metadata = Column(JSON, default={})


class ScenarioRecord(Base):
    __tablename__ = "scenarios"
    
    id = Column(String, primary_key=True)
    type = Column(String, nullable=False)
    mode = Column(String, nullable=False)
    difficulty = Column(String, nullable=False)
    objective = Column(Text, nullable=False)
    data = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class SessionRecord(Base):
    __tablename__ = "sessions"
    
    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False)
    mode = Column(String)
    state = Column(String, nullable=False)
    current_scenario_id = Column(String)
    transcript = Column(JSON, default=[])
    evaluation_results = Column(JSON)
    coaching_feedback = Column(Text)
    skill_updates = Column(JSON)
    next_scenario_recommendation = Column(String)
    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime)
    metadata = Column(JSON, default={})


class SkillProfileRecord(Base):
    __tablename__ = "skill_profiles"
    
    user_id = Column(String, primary_key=True)
    overall_metrics = Column(JSON, default={})
    negotiation_skills = Column(JSON, default={})
    storytelling_skills = Column(JSON, default={})
    critical_thinking_skills = Column(JSON, default={})
    total_sessions = Column(Integer, default=0)
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class EventRecord(Base):
    __tablename__ = "events"
    
    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False)
    session_id = Column(String, nullable=False)
    event_type = Column(String, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    data = Column(JSON, default={})
    metadata = Column(JSON, default={})


# Database engine
engine = create_engine(settings.database_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """Get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize database tables"""
    Base.metadata.create_all(bind=engine)
