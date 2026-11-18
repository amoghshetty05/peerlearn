"""Trains and evaluates the six Smart Match models and saves them for the API.

usage:  python train.py            (from the ml/ folder)
Writes  data/peerlearn_sessions_simulated.csv, models/*.joblib|*.keras, models/metrics.json
"""
import json
import os
import time

import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score, roc_auc_score, roc_curve
from sklearn.model_selection import train_test_split

from smartmatch import models as M
from smartmatch.features import FEATURES, rule_score
from smartmatch.simulate import SEED, generate

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data", "peerlearn_sessions_simulated.csv")
OUT = os.path.join(HERE, "models")


def scores(y, p, threshold=0.5):
    yhat = (p >= threshold).astype(int)
    return {
        "accuracy": round(float(accuracy_score(y, yhat)), 4),
        "precision": round(float(precision_score(y, yhat, zero_division=0)), 4),
        "recall": round(float(recall_score(y, yhat, zero_division=0)), 4),
        "f1": round(float(f1_score(y, yhat, zero_division=0)), 4),
        "roc_auc": round(float(roc_auc_score(y, p)), 4),
    }


def main():
    os.makedirs(OUT, exist_ok=True)
    if not os.path.exists(DATA):
        os.makedirs(os.path.dirname(DATA), exist_ok=True)
        generate().to_csv(DATA, index=False)
    df = pd.read_csv(DATA)
    X, y = df[FEATURES].to_numpy(np.float32), df["success"].to_numpy()
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, stratify=y, random_state=SEED)
    print(f"data: {len(df)} rows, success rate {y.mean():.1%}; train {len(y_tr)}, test {len(y_te)}")

    results, curves = [], {}
    p_rule = rule_score(X_te)
    best_t = max(np.unique(p_rule), key=lambda t: f1_score(y_te, (p_rule >= t).astype(int)))
    base = scores(y_te, p_rule, threshold=float(best_t))
    results.append({"key": "rule_based", "name": "Rule-based score (FR-06, baseline)", "family": "Baseline",
                    "train_rows": 0, "train_seconds": 0.0, "predict_ms_per_5": 0.0, **base})
    fpr, tpr, _ = roc_curve(y_te, p_rule); curves["rule_based"] = [fpr.tolist(), tpr.tolist()]

    for cls in M.ALL:
        model = cls()
        n = getattr(model, "train_size", None)
        if n:  # quantum simulation is slow: train on a stratified sample of the training set
            X_fit, _, y_fit, _ = train_test_split(X_tr, y_tr, train_size=n, stratify=y_tr, random_state=SEED)
        else:
            X_fit, y_fit = X_tr, y_tr
        _, t_fit = M.timed(model.fit, X_fit, y_fit)
        p = model.predict_proba(X_te)
        t0 = time.perf_counter()
        for _ in range(5):
            model.predict_proba(X_te[:5])
        t_pred = (time.perf_counter() - t0) / 5 * 1000
        r = {"key": model.key, "name": model.name, "family": model.family, "description": model.description,
             "train_rows": int(len(y_fit)), "train_seconds": round(t_fit, 2), "predict_ms_per_5": round(t_pred, 1),
             **scores(y_te, p)}
        results.append(r)
        fpr, tpr, _ = roc_curve(y_te, p); curves[model.key] = [fpr.tolist(), tpr.tolist()]
        model.save(OUT)
        print(f"{model.name:32s} AUC {r['roc_auc']:.3f}  F1 {r['f1']:.3f}  acc {r['accuracy']:.3f}  "
              f"train {t_fit:7.1f}s  predict(5) {t_pred:6.1f} ms")

    learned = [r for r in results if r["key"] != "rule_based"]
    best = max(learned, key=lambda r: r["roc_auc"])
    meta = {
        "dataset": {"file": "data/peerlearn_sessions_simulated.csv", "rows": int(len(df)), "simulated": True,
                    "success_rate": round(float(y.mean()), 4), "train_rows": int(len(y_tr)), "test_rows": int(len(y_te)),
                    "seed": SEED},
        "features": FEATURES,
        "default_model": best["key"],
        "results": results,
        "roc_curves": curves,
    }
    with open(os.path.join(OUT, "metrics.json"), "w") as f:
        json.dump(meta, f, indent=1)
    print(f"default model for the API: {best['name']} (highest ROC-AUC)")


if __name__ == "__main__":
    main()
