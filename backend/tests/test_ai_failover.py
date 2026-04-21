from app.services.ai_orchestrator import FailoverAIService


def test_failover_returns_provider_output():
    service = FailoverAIService()
    response = service.ask("find duplicate tests")
    assert response.provider in {"openrouter", "claude", "ollama"}
    assert response.output
