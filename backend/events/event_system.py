from typing import Dict, Any, List
from datetime import datetime
import asyncio
from ..models.event import Event
from ..models.enums import EventType


class EventSystem:
    """System for tracking and processing events"""
    
    def __init__(self):
        self.event_queue: asyncio.Queue = asyncio.Queue()
        self.event_handlers: Dict[EventType, List[callable]] = {}
        self.event_history: List[Event] = []
        self._running = False
    
    def register_handler(self, event_type: EventType, handler: callable):
        """Register a handler for a specific event type"""
        if event_type not in self.event_handlers:
            self.event_handlers[event_type] = []
        self.event_handlers[event_type].append(handler)
    
    async def emit(self, event: Event):
        """Emit an event"""
        await self.event_queue.put(event)
        self.event_history.append(event)
    
    async def process_events(self):
        """Process events from the queue"""
        self._running = True
        
        while self._running:
            try:
                event = await asyncio.wait_for(self.event_queue.get(), timeout=1.0)
                await self._handle_event(event)
            except asyncio.TimeoutError:
                continue
    
    async def _handle_event(self, event: Event):
        """Handle a single event"""
        handlers = self.event_handlers.get(event.event_type, [])
        
        for handler in handlers:
            try:
                await handler(event)
            except Exception as e:
                print(f"Error handling event {event.event_type}: {e}")
    
    def stop(self):
        """Stop the event processor"""
        self._running = False
    
    def get_events_by_session(self, session_id: str) -> List[Event]:
        """Get all events for a specific session"""
        return [e for e in self.event_history if e.session_id == session_id]
    
    def get_events_by_user(self, user_id: str) -> List[Event]:
        """Get all events for a specific user"""
        return [e for e in self.event_history if e.user_id == user_id]
    
    def get_events_by_type(self, event_type: EventType) -> List[Event]:
        """Get all events of a specific type"""
        return [e for e in self.event_history if e.event_type == event_type]


# Global event system instance
event_system = EventSystem()
