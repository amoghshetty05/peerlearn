"""Tests for the Smart Match service (TC-29): every model loads, predicts valid chances,
behaves sensibly, and bad input is rejected."""
import json
import os

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app import LOADED, app
from smartmatch.features import FEATURES, rule_score
from smartmatch.models import ALL

client = TestClient(app)
GOOD = dict(proficiency=1, time_fit=1, rating_avg=0.96, rating_count=0.5, acceptance_rate=0.95, load=0.1, urgency=0.5, lead_time=0.5)
POOR = dict(proficiency=0, time_fit=0, rating_avg=0.4, rating_count=0.5, acceptance_rate=0.2, load=1.0, urgency=1.0, lead_time=0.0)


def test_health_lists_six_models():
    r = client.get("/health")
    assert r.status_code == 200 and r.json()["models"] == 6


def test_models_endpoint_has_two_of_each_family():
    body = client.get("/models").json()
    families = [m["family"] for m in body["models"]]
    assert families.count("Machine learning") == 2
    assert families.count("Deep learning") == 2
    assert families.count("Quantum") == 2
    assert body["default"] in LOADED


@pytest.mark.parametrize("key", [m.key for m in ALL])
def test_each_model_returns_probabilities_and_ranks_good_above_poor(key):
    r = client.post("/predict", json={"model": key, "rows": [GOOD, POOR]})
    assert r.status_code == 200
    p_good, p_poor = r.json()["probabilities"]
    assert 0 <= p_poor <= 1 and 0 <= p_good <= 1
    assert p_good > p_poor, f"{key} should prefer a free, well-rated, willing Tutor"


def test_default_model_used_when_none_given():
    r = client.post("/predict", json={"rows": [GOOD]})
    assert r.status_code == 200 and r.json()["model"] in LOADED


@pytest.mark.parametrize("payload", [
    {"rows": []},                                            # nothing to score
    {"rows": [dict(GOOD, load=1.5)]},                        # outside 0..1
    {"rows": [{k: v for k, v in GOOD.items() if k != "urgency"}]},  # missing feature
    {"rows": [GOOD] * 21},                                   # too many rows
])
def test_bad_input_is_rejected(payload):
    assert client.post("/predict", json=payload).status_code == 422


def test_unknown_model_is_rejected():
    assert client.post("/predict", json={"model": "gpt", "rows": [GOOD]}).status_code == 400


def test_rule_score_matches_fr06():
    # Advanced (20) + free at that time (30) + subject (50) = 100; 3+ ratings averaging 4.8 would add 9.6, capped at 100
    assert rule_score(np.array([[1, 1, 0.96, 0.5, 0.9, 0.1, 0.5, 0.5]]))[0] == 1.0
    # Beginner (7) + not free that day (0) + subject (50), no ratings = 57
    assert abs(rule_score(np.array([[0, 0, 0, 0, 0.5, 0.1, 0.5, 0.5]]))[0] - 0.57) < 1e-9


def test_every_learned_model_beats_chance_on_test_data():
    metrics = json.load(open(os.path.join(os.path.dirname(__file__), "..", "models", "metrics.json")))
    for r in metrics["results"]:
        assert r["roc_auc"] > 0.6, r["key"]
    assert metrics["features"] == FEATURES
