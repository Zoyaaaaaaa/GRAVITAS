from typing import Dict, Any, Optional
import json
import redis.asyncio as redis
from ..core.config import settings
from ..models.session import Session
from ..models.skill_profile import SkillProfile


class MemoryManager:
    """Manager for session memory and user profiles"""
    
    def __init__(self):
        self.redis_client = None
    
    async def connect(self):
        """Connect to Redis"""
        self.redis_client = redis.from_url(settings.redis_url)
    
    async def disconnect(self):
        """Disconnect from Redis"""
        if self.redis_client:
            await self.redis_client.close()
    
    async def save_session(self, session: Session):
        """Save session state to Redis"""
        if not self.redis_client:
            await self.connect()
        
        key = f"session:{session.id}"
        await self.redis_client.setex(
            key,
            3600,  # 1 hour TTL
            session.model_dump_json()
        )
    
    async def load_session(self, session_id: str) -> Optional[Session]:
        """Load session state from Redis"""
        if not self.redis_client:
            await self.connect()
        
        key = f"session:{session_id}"
        data = await self.redis_client.get(key)
        
        if data:
            return Session.model_validate_json(data)
        return None
    
    async def save_user_profile(self, user_id: str, profile: SkillProfile):
        """Save user skill profile"""
        if not self.redis_client:
            await self.connect()
        
        key = f"profile:{user_id}"
        await self.redis_client.set(
            key,
            profile.model_dump_json()
        )
    
    async def load_user_profile(self, user_id: str) -> Optional[SkillProfile]:
        """Load user skill profile"""
        if not self.redis_client:
            await self.connect()
        
        key = f"profile:{user_id}"
        data = await self.redis_client.get(key)
        
        if data:
            return SkillProfile.model_validate_json(data)
        return None
    
    async def update_skill_metrics(
        self,
        user_id: str,
        skill_updates: Dict[str, int]
    ) -> Optional[SkillProfile]:
        """Update specific skill metrics for a user"""
        profile = await self.load_user_profile(user_id)
        
        if not profile:
            # Create default profile
            from ..models.skill_profile import (
                SkillMetrics, NegotiationSkills, 
                StorytellingSkills, CriticalThinkingSkills
            )
            profile = SkillProfile(
                user_id=user_id,
                overall_metrics=SkillMetrics(),
                negotiation_skills=NegotiationSkills(),
                storytelling_skills=StorytellingSkills(),
                critical_thinking_skills=CriticalThinkingSkills()
            )
        
        # Update metrics
        for skill, value in skill_updates.items():
            if hasattr(profile.overall_metrics, skill):
                setattr(profile.overall_metrics, skill, value)
            elif hasattr(profile.negotiation_skills, skill):
                setattr(profile.negotiation_skills, skill, value)
            elif hasattr(profile.storytelling_skills, skill):
                setattr(profile.storytelling_skills, skill, value)
            elif hasattr(profile.critical_thinking_skills, skill):
                setattr(profile.critical_thinking_skills, skill, value)
        
        profile.total_sessions += 1
        await self.save_user_profile(user_id, profile)
        
        return profile
    
    async def get_user_weaknesses(self, user_id: str) -> list:
        """Get user's weakest skills for targeted practice"""
        profile = await self.load_user_profile(user_id)
        
        if not profile:
            return []
        
        weaknesses = []
        
        # Check overall metrics
        for skill, value in profile.overall_metrics.model_dump().items():
            if value < 6:
                weaknesses.append(("overall", skill, value))
        
        # Check negotiation skills
        for skill, value in profile.negotiation_skills.model_dump().items():
            if value < 6:
                weaknesses.append(("negotiation", skill, value))
        
        # Check storytelling skills
        for skill, value in profile.storytelling_skills.model_dump().items():
            if value < 6:
                weaknesses.append(("storytelling", skill, value))
        
        # Check critical thinking skills
        for skill, value in profile.critical_thinking_skills.model_dump().items():
            if value < 6:
                weaknesses.append(("critical_thinking", skill, value))
        
        # Sort by value (lowest first)
        weaknesses.sort(key=lambda x: x[2])
        
        return weaknesses[:5]  # Return top 5 weaknesses
    
    async def track_pattern(self, user_id: str, pattern: str, count: int = 1):
        """Track recurring patterns in user behavior"""
        if not self.redis_client:
            await self.connect()
        
        key = f"patterns:{user_id}:{pattern}"
        await self.redis_client.incrby(key, count)
        await self.redis_client.expire(key, 86400)  # 24 hours
    
    async def get_pattern_count(self, user_id: str, pattern: str) -> int:
        """Get count of a specific pattern"""
        if not self.redis_client:
            await self.connect()
        
        key = f"patterns:{user_id}:{pattern}"
        value = await self.redis_client.get(key)
        
        return int(value) if value else 0
