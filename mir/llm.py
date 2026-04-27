"""Unified LLM interface for Market Intelligence Radar.

Supports: anthropic (Claude), openai (GPT-4o), gemini (Gemini Pro).
Selected via LLM_PROVIDER env var.
"""

import json
import logging
import re
import time
import requests
from mir.config import LLM_PROVIDER, LLM_API_KEY, LLM_MODEL

log = logging.getLogger("mir.llm")

# Default models per provider
_DEFAULT_MODELS = {
    "anthropic": "claude-sonnet-4-20250514",
    "openai": "gpt-4o",
    "gemini": "gemini-2.5-pro",
}


def _clean_json(text: str) -> str:
    """Strip markdown fences from LLM output."""
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\n?", "", text)
        text = re.sub(r"\n?```$", "", text)
    return text.strip()


def extract(prompt: str, content: str, model: str | None = None, retries: int = 2) -> dict | None:
    """Extract structured data from content using the configured LLM.

    Args:
        prompt: System/instruction prompt
        content: The content to analyze
        model: Optional model override
        retries: Number of retry attempts on transient failures

    Returns:
        Parsed JSON dict or None on failure
    """
    provider = LLM_PROVIDER.lower()
    api_key = LLM_API_KEY
    effective_model = model or LLM_MODEL or _DEFAULT_MODELS.get(provider, "")

    if not api_key:
        log.error(f"LLM_API_KEY not set for provider '{provider}'")
        return None

    if provider == "anthropic":
        return _extract_anthropic(prompt, content, api_key, effective_model, retries)
    elif provider == "openai":
        return _extract_openai(prompt, content, api_key, effective_model, retries)
    elif provider == "gemini":
        return _extract_gemini(prompt, content, api_key, effective_model, retries)
    else:
        log.error(f"Unknown LLM_PROVIDER: '{provider}'. Use: anthropic, openai, or gemini")
        return None


def _extract_anthropic(prompt: str, content: str, api_key: str, model: str, retries: int) -> dict | None:
    full_prompt = f"{prompt}\n\n{content}"
    for attempt in range(1, retries + 2):
        try:
            resp = requests.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": model,
                    "max_tokens": 8192,
                    "temperature": 0.1,
                    "messages": [{"role": "user", "content": full_prompt}],
                    "system": "You are a market intelligence analyst. Return ONLY valid JSON, no markdown fences or commentary.",
                },
                timeout=120,
            )
            if resp.status_code == 429 or resp.status_code >= 500:
                if attempt <= retries:
                    time.sleep(2 ** attempt)
                    continue
                return None
            if resp.status_code != 200:
                log.warning(f"Anthropic {resp.status_code}: {resp.text[:300]}")
                return None
            text = resp.json().get("content", [{}])[0].get("text", "")
            return json.loads(_clean_json(text))
        except json.JSONDecodeError:
            if attempt <= retries:
                time.sleep(2)
                continue
            return None
        except requests.exceptions.Timeout:
            if attempt <= retries:
                time.sleep(2 ** attempt)
                continue
            return None
        except Exception as e:
            log.error(f"Anthropic error: {e}")
            return None
    return None


def _extract_openai(prompt: str, content: str, api_key: str, model: str, retries: int) -> dict | None:
    for attempt in range(1, retries + 2):
        try:
            resp = requests.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "temperature": 0.1,
                    "max_tokens": 8192,
                    "messages": [
                        {"role": "system", "content": "You are a market intelligence analyst. Return ONLY valid JSON."},
                        {"role": "user", "content": f"{prompt}\n\n{content}"},
                    ],
                },
                timeout=120,
            )
            if resp.status_code == 429 or resp.status_code >= 500:
                if attempt <= retries:
                    time.sleep(2 ** attempt)
                    continue
                return None
            if resp.status_code != 200:
                log.warning(f"OpenAI {resp.status_code}: {resp.text[:300]}")
                return None
            text = resp.json()["choices"][0]["message"]["content"]
            return json.loads(_clean_json(text))
        except json.JSONDecodeError:
            if attempt <= retries:
                time.sleep(2)
                continue
            return None
        except Exception as e:
            log.error(f"OpenAI error: {e}")
            return None
    return None


def _extract_gemini(prompt: str, content: str, api_key: str, model: str, retries: int) -> dict | None:
    for attempt in range(1, retries + 2):
        try:
            resp = requests.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}",
                headers={"Content-Type": "application/json"},
                json={
                    "contents": [{"parts": [{"text": f"{prompt}\n\n{content}"}]}],
                    "generationConfig": {
                        "temperature": 0.1,
                        "maxOutputTokens": 8192,
                        "responseMimeType": "application/json",
                    },
                },
                timeout=120,
            )
            if resp.status_code == 429 or resp.status_code >= 500:
                if attempt <= retries:
                    time.sleep(2 ** attempt)
                    continue
                return None
            if resp.status_code != 200:
                log.warning(f"Gemini {resp.status_code}: {resp.text[:300]}")
                return None
            text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
            return json.loads(_clean_json(text))
        except json.JSONDecodeError:
            if attempt <= retries:
                time.sleep(2)
                continue
            return None
        except Exception as e:
            log.error(f"Gemini error: {e}")
            return None
    return None
