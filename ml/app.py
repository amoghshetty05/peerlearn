"""Smart Match model service (CMP-13, FR-16).

A small FastAPI service that loads the six trained models and predicts, for each Tutor in a
match list, the chance that the session will succeed (accepted and rated 4 or 5).
The Node.js API calls POST /predict; the ranking still works without this service.

Endpoints
  GET  /health    -> {"status": "ok", "models": 6}
  GET  /models    -> the six models with their test results, and which one is the default
  POST /predict   -> {"model": "...", "probabilities": [...]}  for up to 20 rows of features
"""
import json
import os

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from smartmatch import models as M
from smartmatch.features import FEATURES, to_matrix

MODEL_DIR = os.environ.get("MODEL_DIR", os.path.join(os.path.dirname(os.path.abspath(__file__)), "models"))

with open(os.path.join(MODEL_DIR, "metrics.json")) as f:
    METRICS = json.load(f)
LOADED = {cls.key: M.load(MODEL_DIR, cls.key) for cls in M.ALL}
DEFAULT = os.environ.get("DEFAULT_MODEL", METRICS["default_model"])
if DEFAULT not in LOADED:
    raise RuntimeError(f"DEFAULT_MODEL {DEFAULT!r} is not one of {sorted(LOADED)}")

app = FastAPI(title="PeerLearn Smart Match", version="1.0")


class Row(BaseModel):
    """The 8 features, each already scaled to 0..1 (see smartmatch/features.py)."""
    proficiency: float = Field(ge=0, le=1)
    time_fit: float = Field(ge=0, le=1)
    rating_avg: float = Field(ge=0, le=1)
    rating_count: float = Field(ge=0, le=1)
    acceptance_rate: float = Field(ge=0, le=1)
    load: float = Field(ge=0, le=1)
    urgency: float = Field(ge=0, le=1)
    lead_time: float = Field(ge=0, le=1)


class PredictRequest(BaseModel):
    rows: list[Row] = Field(min_length=1, max_length=20)
    model: str | None = None


@app.get("/health")
def health():
    return {"status": "ok", "models": len(LOADED), "default": DEFAULT}


@app.get("/models")
def list_models():
    results = {r["key"]: r for r in METRICS["results"]}
    return {
        "default": DEFAULT,
        "features": FEATURES,
        "dataset": METRICS["dataset"],
        "models": [{k: results[cls.key][k] for k in ("key", "name", "family", "description", "accuracy",
                                                     "precision", "recall", "f1", "roc_auc", "train_rows")}
                   for cls in M.ALL],
        "baseline": results["rule_based"],
    }


@app.post("/predict")
def predict(req: PredictRequest):
    key = req.model or DEFAULT
    if key not in LOADED:
        raise HTTPException(status_code=400, detail=f"Unknown model {key!r}. Use one of: {', '.join(LOADED)}.")
    X = to_matrix([r.model_dump() for r in req.rows])
    p = LOADED[key].predict_proba(X)
    return {"model": key, "modelName": LOADED[key].name, "probabilities": [round(float(v), 4) for v in p]}
