"""AI Orchestrator - Real provider integrations with failover."""

from __future__ import annotations

import httpx
from dataclasses import dataclass
from typing import Iterable, Optional


@dataclass
class ProviderResult:
    provider: str
    model: str
    output: str
    response_time: float


class ProviderError(Exception):
    pass


class BaseProvider:
    name = "base"
    api_key: Optional[str] = None
    model_name: Optional[str] = None
    
    def run(self, prompt: str) -> ProviderResult:
        raise NotImplementedError


class OpenRouterProvider(BaseProvider):
    name = "openrouter"
    api_url = "https://openrouter.ai/api/v1/chat/completions"
    
    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key
        self.model_name = model or "openai/gpt-4"
    
    def run(self, prompt: str) -> ProviderResult:
        if not self.api_key:
            raise ProviderError("OpenRouter API key not configured")
        
        import time
        start_time = time.time()
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "KRSNAA MIS",
        }
        
        payload = {
            "model": self.model_name,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 2000,
            "temperature": 0.7,
        }
        
        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.post(self.api_url, json=payload, headers=headers)
                response.raise_for_status()
                data = response.json()
                
                output = data["choices"][0]["message"]["content"]
                response_time = time.time() - start_time
                
                return ProviderResult(
                    provider=self.name,
                    model=self.model_name,
                    output=output,
                    response_time=response_time,
                )
        except httpx.TimeoutException:
            raise ProviderError("OpenRouter request timed out")
        except Exception as e:
            raise ProviderError(f"OpenRouter error: {str(e)}")


class ClaudeProvider(BaseProvider):
    name = "claude"
    api_url = "https://api.anthropic.com/v1/messages"
    
    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key
        self.model_name = model or "claude-3-sonnet-20240229"
    
    def run(self, prompt: str) -> ProviderResult:
        if not self.api_key:
            raise ProviderError("Claude API key not configured")
        
        import time
        start_time = time.time()
        
        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        
        payload = {
            "model": self.model_name,
            "max_tokens": 2000,
            "messages": [{"role": "user", "content": prompt}],
        }
        
        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.post(self.api_url, json=payload, headers=headers)
                response.raise_for_status()
                data = response.json()
                
                output = data["content"][0]["text"]
                response_time = time.time() - start_time
                
                return ProviderResult(
                    provider=self.name,
                    model=self.model_name,
                    output=output,
                    response_time=response_time,
                )
        except httpx.TimeoutException:
            raise ProviderError("Claude request timed out")
        except Exception as e:
            raise ProviderError(f"Claude error: {str(e)}")


class OllamaProvider(BaseProvider):
    name = "ollama"
    
    def __init__(self, base_url: str = "http://129.154.246.146:11434", model: Optional[str] = None):
        self.base_url = base_url
        self.model_name = model or "llama3"
    
    def run(self, prompt: str) -> ProviderResult:
        import time
        start_time = time.time()
        
        api_url = f"{self.base_url}/api/generate"
        
        payload = {
            "model": self.model_name,
            "prompt": prompt,
            "stream": False,
        }
        
        try:
            with httpx.Client(timeout=60.0) as client:
                response = client.post(api_url, json=payload)
                response.raise_for_status()
                data = response.json()
                
                output = data.get("response", "")
                response_time = time.time() - start_time
                
                return ProviderResult(
                    provider=self.name,
                    model=self.model_name,
                    output=output,
                    response_time=response_time,
                )
        except httpx.TimeoutException:
            raise ProviderError("Ollama request timed out")
        except Exception as e:
            raise ProviderError(f"Ollama error: {str(e)}")


class FailoverAIService:
    def __init__(
        self,
        providers: Iterable[BaseProvider] | None = None,
        openrouter_key: Optional[str] = None,
        claude_key: Optional[str] = None,
        openrouter_model: Optional[str] = None,
        claude_model: Optional[str] = None,
        ollama_url: Optional[str] = None,
        ollama_model: Optional[str] = None,
    ):
        # Build provider chain with failover priority
        self.providers = []
        
        # Priority 1: OpenRouter
        if openrouter_key:
            self.providers.append(OpenRouterProvider(
                api_key=openrouter_key,
                model=openrouter_model,
            ))
        
        # Priority 2: Claude
        if claude_key:
            self.providers.append(ClaudeProvider(
                api_key=claude_key,
                model=claude_model,
            ))
        
        # Priority 3: Ollama (always available, no API key needed)
        self.providers.append(OllamaProvider(
            base_url=ollama_url or "http://129.154.246.146:11434",
            model=ollama_model,
        ))
        
        if not self.providers:
            # Default to Ollama if nothing configured
            self.providers.append(OllamaProvider())
    
    def ask(self, query: str) -> ProviderResult:
        """Try providers in priority order until one succeeds."""
        errors = []
        
        for provider in self.providers:
            try:
                result = provider.run(query)
                return result
            except ProviderError as exc:
                errors.append(f"{provider.name}: {exc}")
                continue
            except Exception as exc:
                errors.append(f"{provider.name}: {exc}")
                continue
        
        raise ProviderError("All AI providers failed: " + "; ".join(errors))
