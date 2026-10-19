# Gravitas - Elite Communication Coaching System

A modular, scalable AI-powered communication coaching platform with real-time voice interaction and personalized skill development.

## Architecture Overview

Gravitas is built with a clean separation of concerns following the principle: **Agent = Behavior, Scenario = Situation, Evaluator = Measurement, Session = State, Orchestrator = Routing, Memory = Progress**.

### System Architecture

```
User → Voice Gateway → Session Orchestrator → Intent/Mode Router → Scenario Engine → Specialist Agent → Evaluation Agent → Session Memory → Response
```

### Key Components

#### Backend (`/backend`)
- **Orchestrator**: Central coordinator managing session flow and agent routing
- **Specialist Agents**: Modular agents for different coaching modes (Interview, Negotiation, Storytelling, etc.)
- **Scenario Engine**: Data-driven scenario management with difficulty levels
- **Evaluation System**: Performance analysis across multiple dimensions
- **Memory Manager**: Redis-backed session state and user skill profiles
- **Event System**: Analytics and debugging through event tracking
- **API Layer**: FastAPI REST endpoints and WebSocket support
- **LiveKit Integration**: Real-time voice processing

#### Frontend (`/frontend`)
- **Premium UI**: Modern, aesthetic interface built with Next.js and Tailwind CSS
- **Mode Selection**: Interactive mode cards with smooth animations
- **Voice Interface**: Real-time voice controls and session management
- **Responsive Design**: Works seamlessly across devices

## Project Structure

```
gravitas/
├── backend/
│   ├── agents/              # Specialist agent implementations
│   │   ├── base_agent.py
│   │   ├── interview_agent.py
│   │   ├── negotiation_agent.py
│   │   ├── storytelling_agent.py
│   │   ├── critical_thinking_agent.py
│   │   ├── evaluator_agent.py
│   │   └── coach_agent.py
│   ├── api/                 # API endpoints and LiveKit server
│   │   ├── main.py
│   │   └── livekit_server.py
│   ├── core/                # Configuration and shared utilities
│   │   └── config.py
│   ├── events/              # Event system for analytics
│   │   └── event_system.py
│   ├── memory/              # Memory and user profile management
│   │   └── memory_manager.py
│   ├── models/              # Data models and enums
│   │   ├── enums.py
│   │   ├── scenario.py
│   │   ├── skill_profile.py
│   │   ├── event.py
│   │   └── session.py
│   ├── orchestrator/        # Session orchestration logic
│   │   └── orchestrator.py
│   ├── scenarios/           # Scenario engine and definitions
│   │   └── scenario_engine.py
│   ├── sessions/            # Session management
│   ├── users/               # User management
│   ├── evaluation/          # Evaluation logic
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/             # Next.js app directory
│   │   │   ├── page.tsx     # Home page with mode selection
│   │   │   ├── session/     # Session page
│   │   │   ├── layout.tsx
│   │   │   └── globals.css
│   │   ├── components/      # React components
│   │   │   ├── ModeCard.tsx
│   │   │   └── VoiceInterface.tsx
│   │   ├── types/           # TypeScript types
│   │   │   └── index.ts
│   │   ├── api/             # API client
│   │   ├── styles/          # Additional styles
│   │   └── utils/           # Utility functions
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   └── next.config.js
└── README.md
```

## Coaching Modes

1. **Storytelling** - Transform ideas into compelling narratives
2. **Critical Thinking** - Strengthen reasoning and argumentation
3. **Negotiation** - Master strategic negotiation tactics
4. **Interview** - Practice high-pressure interview scenarios
5. **Executive Presence** - Develop commanding leadership communication
6. **Devil's Advocate** - Challenge thinking with rigorous debate
7. **Persuasion Lab** - Learn multi-frame communication
8. **Real-World Scenario** - Simulate authentic professional situations
9. **Rapid Response** - Train quick thinking under pressure
10. **High Pressure** - Handle difficult conversations
11. **Answer Architect** - Structure perfect answers
12. **Professional Identity** - Craft coherent professional narratives

## Setup Instructions

### Prerequisites
- Python 3.9+
- Node.js 18+
- PostgreSQL database
- Redis server
- LiveKit server (or use LiveKit Cloud)

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Create a virtual environment:
```bash
python -m venv venv
 venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

5. Set up the database:
```bash
# Create PostgreSQL database
# Update DATABASE_URL in .env
```

6. Start the backend server:
```bash
python -m api.main
```

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.local.example .env.local
# Edit .env.local with your API URLs
```

4. Start the development server:
```bash
npm run dev
```

### LiveKit Voice Server

Start the LiveKit voice server separately:
```bash
cd backend
python -m api.livekit_server
```

## Environment Variables

### Backend (.env)
- `LIVEKIT_URL` - LiveKit server URL
- `LIVEKIT_API_KEY` - LiveKit API key
- `LIVEKIT_API_SECRET` - LiveKit API secret
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `OPENAI_API_KEY` - OpenAI API key (optional)
- `GOOGLE_API_KEY` - Google API key (optional)
- `SECRET_KEY` - Application secret key

### Frontend (.env.local)
- `NEXT_PUBLIC_API_URL` - Backend API URL
- `NEXT_PUBLIC_LIVEKIT_URL` - LiveKit server URL
- `NEXT_PUBLIC_LIVEKIT_TOKEN` - LiveKit access token

## Key Features

### Modular Agent Architecture
- Specialized agents for each coaching mode
- Clean separation between behavior and scenarios
- Easy to add new agents without affecting existing ones

### Data-Driven Scenarios
- Scenarios defined as structured data
- Difficulty levels (Beginner to Expert)
- Dynamic escalation rules
- Success criteria and constraints

### Skill Profiling
- Detailed skill metrics across dimensions
- Negotiation, storytelling, and critical thinking skills
- Progress tracking over time
- Weakness identification for targeted practice

### Real-Time Voice
- LiveKit integration for low-latency voice
- Noise cancellation and audio enhancement
- Real-time transcription
- Natural voice interaction

### Event System
- Comprehensive event tracking
- Session analytics
- Debugging support
- Replay capabilities

### Premium UI
- Modern, aesthetic design
- Smooth animations
- Responsive layout
- Dark mode optimized

## Development Workflow

1. User selects coaching mode
2. Orchestrator creates session and loads user profile
3. Scenario engine selects appropriate scenario
4. Specialist agent guides role-play
5. User responds via voice or text
6. Agent adapts based on user input
7. Scenario completes based on success criteria
8. Evaluator analyzes performance
9. Coach provides targeted feedback
10. Skill profile updated
11. Next scenario recommended based on weaknesses

## Scaling Considerations

### Current Architecture (Modular Monolith)
- Clean module boundaries
- Easy to extract services later
- Simple deployment
- Good for MVP and early scaling

### Future Scaling Path
- Extract evaluation to separate service (computationally expensive)
- Add message queue for async processing
- Implement caching for frequently accessed scenarios
- Add load balancing for API servers
- Consider microservices for specific high-traffic components

## Security Considerations

- Never commit secrets to repository
- Use environment variables for sensitive data
- Implement proper authentication
- Rate limiting on API endpoints
- Input validation and sanitization
- Secure WebSocket connections

## Performance Optimization

- Real-time path kept minimal (Audio → STT → LLM → TTS → User)
- Heavy processing (evaluation, analytics) done asynchronously
- Redis for fast session state access
- Database connection pooling
- Efficient scenario caching

## Testing

- Unit tests for individual agents
- Integration tests for orchestrator
- End-to-end tests for complete flows
- Performance tests for voice latency

## License

Proprietary - All rights reserved

## Support

For support and documentation, visit the project repository or contact the development team.
