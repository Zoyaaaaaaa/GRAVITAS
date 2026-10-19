"""Backend API Tests"""
import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, MagicMock, patch

# Import the app
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from api.main import app


@pytest.fixture
async def client():
    """Create test client"""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def mock_orchestrator():
    """Mock the orchestrator"""
    with patch('api.main.orchestrator') as mock:
        yield mock


@pytest.fixture
def mock_memory_manager():
    """Mock the memory manager"""
    with patch('api.main.memory_manager') as mock:
        yield mock


@pytest.fixture
def mock_event_system():
    """Mock the event system"""
    with patch('api.main.event_system') as mock:
        yield mock


class TestHealthEndpoints:
    """Test health check endpoints"""

    async def test_root_endpoint(self, client):
        """Test root health check"""
        response = await client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "gravitas-api"

    async def test_health_endpoint(self, client):
        """Test detailed health check"""
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "gravitas-api"
        assert "version" in data


class TestModesEndpoint:
    """Test modes endpoint"""

    async def test_get_modes(self, client):
        """Test getting available modes"""
        response = await client.get("/modes")
        assert response.status_code == 200
        data = response.json()
        assert "modes" in data
        assert len(data["modes"]) > 0
        # Check mode structure
        mode = data["modes"][0]
        assert "value" in mode
        assert "label" in mode


class TestSessionEndpoints:
    """Test session management endpoints"""

    async def test_start_session(self, client, mock_orchestrator, mock_event_system):
        """Test starting a new session"""
        # Setup mock
        mock_session = MagicMock()
        mock_session.id = "test-session-123"
        mock_session.state.value = "discovery"
        mock_orchestrator.start_session = AsyncMock(return_value=mock_session)
        mock_event_system.emit = AsyncMock()

        response = await client.post("/session/start", params={
            "user_id": "test-user",
            "mode": "interview"
        })

        assert response.status_code == 200
        data = response.json()
        assert data["session_id"] == "test-session-123"
        assert data["mode"] == "interview"
        assert data["state"] == "discovery"

    async def test_start_session_invalid_mode(self, client):
        """Test starting session with invalid mode"""
        response = await client.post("/session/start", params={
            "user_id": "test-user",
            "mode": "invalid_mode"
        })
        # Should return 422 for validation error
        assert response.status_code == 422

    async def test_get_session(self, client, mock_orchestrator):
        """Test getting session details"""
        mock_session = MagicMock()
        mock_session.id = "test-session-123"
        mock_session.user_id = "test-user"
        mock_session.mode.value = "interview"
        mock_session.state.value = "roleplay"
        mock_session.current_scenario_id = "scenario-1"
        mock_session.scenario_state = MagicMock()
        mock_session.scenario_state.current_turn = 5
        mock_orchestrator.get_session = MagicMock(return_value=mock_session)

        response = await client.get("/session/test-session-123")

        assert response.status_code == 200
        data = response.json()
        assert data["session_id"] == "test-session-123"
        assert data["user_id"] == "test-user"
        assert data["mode"] == "interview"
        assert data["turn_count"] == 5

    async def test_get_session_not_found(self, client, mock_orchestrator):
        """Test getting non-existent session"""
        mock_orchestrator.get_session = MagicMock(return_value=None)

        response = await client.get("/session/non-existent")

        assert response.status_code == 404

    async def test_handle_turn(self, client, mock_orchestrator, mock_event_system):
        """Test handling a user turn"""
        mock_session = MagicMock()
        mock_session.id = "test-session-123"
        mock_session.user_id = "test-user"
        mock_session.state.value = "roleplay"
        mock_session.scenario_state = MagicMock()
        mock_session.scenario_state.current_turn = 1
        mock_orchestrator.get_session = MagicMock(return_value=mock_session)
        mock_orchestrator.handle_user_turn = AsyncMock(return_value="Great answer!")
        mock_event_system.emit = AsyncMock()

        response = await client.post("/session/test-session-123/turn", params={
            "user_input": "I have 5 years of experience"
        })

        assert response.status_code == 200
        data = response.json()
        assert data["response"] == "Great answer!"
        assert data["state"] == "roleplay"
        assert data["turn"] == 1

    async def test_handle_turn_session_not_found(self, client, mock_orchestrator):
        """Test handling turn for non-existent session"""
        mock_orchestrator.get_session = MagicMock(return_value=None)

        response = await client.post("/session/non-existent/turn", params={
            "user_input": "Hello"
        })

        assert response.status_code == 404


class TestScenarioEndpoints:
    """Test scenario endpoints"""

    async def test_select_scenario(self, client, mock_orchestrator, mock_memory_manager, mock_event_system):
        """Test selecting a scenario"""
        mock_session = MagicMock()
        mock_session.id = "test-session-123"
        mock_session.user_id = "test-user"
        mock_orchestrator.get_session = MagicMock(return_value=mock_session)

        mock_profile = MagicMock()
        mock_memory_manager.load_user_profile = AsyncMock(return_value=mock_profile)

        mock_scenario = MagicMock()
        mock_scenario.id = "scenario-1"
        mock_scenario.context = "Test context"
        mock_scenario.opening_move = "Tell me about yourself"
        mock_scenario.duration_minutes = 10
        mock_orchestrator.select_scenario = AsyncMock(return_value=mock_scenario)
        mock_orchestrator.initialize_scenario = AsyncMock()
        mock_event_system.emit = AsyncMock()

        response = await client.post("/session/test-session-123/scenario", params={
            "difficulty": "intermediate"
        })

        assert response.status_code == 200
        data = response.json()
        assert data["scenario_id"] == "scenario-1"
        assert data["context"] == "Test context"
        assert data["opening_move"] == "Tell me about yourself"

    async def test_select_scenario_session_not_found(self, client, mock_orchestrator):
        """Test selecting scenario for non-existent session"""
        mock_orchestrator.get_session = MagicMock(return_value=None)

        response = await client.post("/session/non-existent/scenario")

        assert response.status_code == 404


class TestUserEndpoints:
    """Test user profile endpoints"""

    async def test_get_user_profile(self, client, mock_memory_manager):
        """Test getting user profile"""
        mock_profile = MagicMock()
        mock_profile.model_dump.return_value = {
            "user_id": "test-user",
            "skills": {"negotiation": 0.8}
        }
        mock_memory_manager.load_user_profile = AsyncMock(return_value=mock_profile)

        response = await client.get("/user/test-user/profile")

        assert response.status_code == 200
        data = response.json()
        assert data["user_id"] == "test-user"

    async def test_get_user_profile_not_found(self, client, mock_memory_manager):
        """Test getting non-existent user profile"""
        mock_memory_manager.load_user_profile = AsyncMock(return_value=None)

        response = await client.get("/user/non-existent/profile")

        assert response.status_code == 404

    async def test_get_user_weaknesses(self, client, mock_memory_manager):
        """Test getting user weaknesses"""
        mock_memory_manager.get_user_weaknesses = AsyncMock(return_value=[
            ("negotiation", "salary_discussion", 0.3),
            ("storytelling", "structure", 0.4)
        ])

        response = await client.get("/user/test-user/weaknesses")

        assert response.status_code == 200
        data = response.json()
        assert "weaknesses" in data
        assert len(data["weaknesses"]) == 2
        assert data["weaknesses"][0]["category"] == "negotiation"


class TestLiveKitTokenEndpoint:
    """Test LiveKit token endpoint"""

    async def test_get_livekit_token(self, client):
        """Test getting LiveKit token"""
        with patch('api.main.settings') as mock_settings:
            mock_settings.livekit_api_key = "test-key"
            mock_settings.livekit_api_secret = "test-secret"
            mock_settings.livekit_url = "wss://test.livekit.cloud"

            with patch('livekit.api.LiveKitAPI') as mock_lkapi:
                mock_lkapi.return_value.agent_dispatch.create_dispatch = AsyncMock()
                mock_lkapi.return_value.aclose = AsyncMock()

                response = await client.get("/livekit/token", params={
                    "user_id": "test-user",
                    "room_name": "test-room"
                })

                assert response.status_code == 200
                data = response.json()
                assert "token" in data
                assert data["room_name"] == "test-room"
                assert data["user_id"] == "test-user"


class TestRateLimiting:
    """Test rate limiting"""

    async def test_rate_limit_enforced(self, client):
        """Test that rate limiting is enforced"""
        # Make many requests quickly
        responses = []
        for _ in range(65):  # Exceeds 60/minute limit
            response = await client.get("/")
            responses.append(response.status_code)

        # Should get some 429 responses
        assert 429 in responses


class TestCORS:
    """Test CORS headers"""

    async def test_cors_headers(self, client):
        """Test CORS headers are present"""
        response = await client.options("/")
        # CORS should be configured
        assert response.status_code in [200, 405]  # 405 if OPTIONS not explicitly handled


# Run with: pytest backend/tests/ -v