from __future__ import annotations

from nara_worker.telemetry.pricing import estimate_cost


def test_known_model_cost_is_computed():
    # 1M input + 1M output on the 70B model = $0.59 + $0.79
    cost = estimate_cost("llama-3.3-70b-versatile", 1_000_000, 1_000_000)
    assert round(cost, 4) == round(0.59 + 0.79, 4)


def test_provider_prefix_is_stripped():
    a = estimate_cost("groq/llama-3.1-8b-instant", 1_000_000, 0)
    b = estimate_cost("llama-3.1-8b-instant", 1_000_000, 0)
    assert a == b == 0.05


def test_embedding_has_no_output_cost():
    # 1M input tokens on the small embedding model = $0.02, output ignored
    assert round(estimate_cost("text-embedding-3-small", 1_000_000, 999), 4) == 0.02


def test_unknown_model_costs_zero():
    assert estimate_cost("some-future-model", 1_000_000, 1_000_000) == 0.0


def test_zero_tokens_zero_cost():
    assert estimate_cost("llama-3.1-8b-instant", 0, 0) == 0.0
