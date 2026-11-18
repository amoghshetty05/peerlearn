"""Trains and evaluates the six Smart Match models, saves them for the API, and records every run
in MLflow so the models can be compared side by side.

usage (from the ml/ folder):
    python train.py
    mlflow ui --backend-store-uri sqlite:///mlflow.db      # then open http://localhost:5000

Writes  data/peerlearn_sessions_simulated.csv, models/*.joblib|*.keras, models/metrics.json, models/scores.json,
        and one MLflow parent run (experiment "peerlearn-smart-match") with a child run per model.
"""
import json
import os
import platform
import time

import mlflow
import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score, roc_auc_score, roc_curve
from sklearn.model_selection import train_test_split

from smartmatch import models as M
from smartmatch.features import FEATURES, rule_score
from smartmatch.params import P
from smartmatch.simulate import generate

SEED = P["train"]["seed"]

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data", "peerlearn_sessions_simulated.csv")
OUT = os.path.join(HERE, "models")
TRACKING_URI = os.environ.get("MLFLOW_TRACKING_URI", f"sqlite:///{os.path.join(HERE, 'mlflow.db')}")
EXPERIMENT = "peerlearn-smart-match"
METRICS = ("accuracy", "precision", "recall", "f1", "roc_auc")


def scores(y, p, threshold=0.5):
    yhat = (p >= threshold).astype(int)
    return {
        "accuracy": round(float(accuracy_score(y, yhat)), 4),
        "precision": round(float(precision_score(y, yhat, zero_division=0)), 4),
        "recall": round(float(recall_score(y, yhat, zero_division=0)), 4),
        "f1": round(float(f1_score(y, yhat, zero_division=0)), 4),
        "roc_auc": round(float(roc_auc_score(y, p)), 4),
    }


def log_run(result, params):
    """One MLflow child run per model: what it is, how it was set up, and how it scored."""
    with mlflow.start_run(run_name=result["name"], nested=True):
        mlflow.set_tags({"family": result["family"], "model_key": result["key"]})
        mlflow.log_params({"train_rows": result["train_rows"], **params})
        mlflow.log_metrics({k: result[k] for k in METRICS})
        mlflow.log_metrics({"train_seconds": result["train_seconds"], "predict_ms_per_5": result["predict_ms_per_5"]})


def main():
    os.makedirs(OUT, exist_ok=True)
    if not os.path.exists(DATA):
        os.makedirs(os.path.dirname(DATA), exist_ok=True)
        generate().to_csv(DATA, index=False)
    df = pd.read_csv(DATA)
    X, y = df[FEATURES].to_numpy(np.float32), df["success"].to_numpy()
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=P["train"]["test_size"], stratify=y, random_state=SEED)
    print(f"data: {len(df)} rows, success rate {y.mean():.1%}; train {len(y_tr)}, test {len(y_te)}")

    mlflow.set_tracking_uri(TRACKING_URI)
    mlflow.set_experiment(EXPERIMENT)
    results, curves = [], {}
    with mlflow.start_run(run_name=f"training {time.strftime('%Y-%m-%d %H:%M')}"):
        mlflow.set_tags({"dataset": "simulated", "python": platform.python_version()})
        mlflow.log_params({"rows": len(df), "train_rows": len(y_tr), "test_rows": len(y_te), "seed": SEED,
                           "success_rate": round(float(y.mean()), 4), "features": ",".join(FEATURES)})

        # Baseline: today's rule-based score (FR-06, FR-15), with its best cut-off for F1
        p_rule = rule_score(X_te)
        best_t = max(np.unique(p_rule), key=lambda t: f1_score(y_te, (p_rule >= t).astype(int)))
        base = {"key": "rule_based", "name": "Rule-based score (FR-06, baseline)", "family": "Baseline",
                "description": "The existing match score of FR-06 and FR-15, scaled to 0..1.",
                "train_rows": 0, "train_seconds": 0.0, "predict_ms_per_5": 0.0, **scores(y_te, p_rule, float(best_t))}
        results.append(base)
        log_run(base, {"threshold": float(best_t)})
        fpr, tpr, _ = roc_curve(y_te, p_rule); curves["rule_based"] = [fpr.tolist(), tpr.tolist()]

        angle_max = np.pi
        order = [M.LogisticRegressionModel, M.RandomForestModel, M.MLPModel, M.WideDeepModel, M.QSVCModel, M.VQCModel]
        for cls in order:
            model = cls(angle_max) if cls is M.VQCModel else cls()  # VQC reuses the bandwidth the QSVC picked
            n = getattr(model, "train_size", None)
            if n:  # quantum simulation is slow: train on a stratified sample of the training set
                X_fit, _, y_fit, _ = train_test_split(X_tr, y_tr, train_size=n, stratify=y_tr, random_state=SEED)
            else:
                X_fit, y_fit = X_tr, y_tr
            _, t_fit = M.timed(model.fit, X_fit, y_fit)
            if cls is M.QSVCModel:
                angle_max = model.angle_max
            p = model.predict_proba(X_te)
            t0 = time.perf_counter()
            for _ in range(5):
                model.predict_proba(X_te[:5])
            t_pred = (time.perf_counter() - t0) / 5 * 1000
            r = {"key": model.key, "name": model.name, "family": model.family, "description": model.description,
                 "train_rows": int(len(y_fit)), "train_seconds": round(t_fit, 2), "predict_ms_per_5": round(t_pred, 1),
                 **scores(y_te, p)}
            params = model.params()
            r["params"] = params
            if hasattr(model, "cv_results"):
                r["cv_results"] = model.cv_results
            results.append(r)
            log_run(r, params)
            fpr, tpr, _ = roc_curve(y_te, p); curves[model.key] = [fpr.tolist(), tpr.tolist()]
            model.save(OUT)
            print(f"{model.name:32s} AUC {r['roc_auc']:.3f}  F1 {r['f1']:.3f}  acc {r['accuracy']:.3f}  "
                  f"train {t_fit:7.1f}s  predict(5) {t_pred:6.1f} ms")

        learned = [r for r in results if r["key"] != "rule_based"]
        best = max(learned, key=lambda r: r["roc_auc"])
        mlflow.log_params({"default_model": best["key"]})
        mlflow.log_metrics({"best_roc_auc": best["roc_auc"], "baseline_roc_auc": base["roc_auc"]})

    ordered = [results[0]] + sorted(results[1:], key=lambda r: [c.key for c in M.ALL].index(r["key"]))
    meta = {
        "dataset": {"file": "data/peerlearn_sessions_simulated.csv", "rows": int(len(df)), "simulated": True,
                    "success_rate": round(float(y.mean()), 4), "train_rows": int(len(y_tr)), "test_rows": int(len(y_te)),
                    "seed": SEED},
        "features": FEATURES,
        "default_model": best["key"],
        "mlflow": {"tracking_uri": "sqlite:///mlflow.db", "experiment": EXPERIMENT},
        "results": ordered,
        "roc_curves": curves,
    }
    with open(os.path.join(OUT, "metrics.json"), "w") as f:
        json.dump(meta, f, indent=1)
    # Small score file for DVC:  dvc metrics show  /  dvc metrics diff
    with open(os.path.join(OUT, "scores.json"), "w") as f:
        json.dump({r["key"]: {k: r[k] for k in METRICS} for r in ordered}, f, indent=1)
    print(f"default model for the API: {best['name']} (highest ROC-AUC)")
    print(f"MLflow: experiment '{EXPERIMENT}' in {TRACKING_URI}")


if __name__ == "__main__":
    main()
