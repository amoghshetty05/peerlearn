"""Reads the latest training run back from MLflow and prints the six models side by side.

usage (from the ml/ folder):
    python compare.py            # comparison table, sorted by ROC-AUC
    python compare.py --check    # fail if the latest run does not hold 2 models of each family
"""
import os
import sys

import mlflow
from mlflow.tracking import MlflowClient

HERE = os.path.dirname(os.path.abspath(__file__))
TRACKING_URI = os.environ.get("MLFLOW_TRACKING_URI", f"sqlite:///{os.path.join(HERE, 'mlflow.db')}")


def latest_children():
    mlflow.set_tracking_uri(TRACKING_URI)
    client = MlflowClient()
    exp = client.get_experiment_by_name("peerlearn-smart-match")
    if exp is None:
        sys.exit("No MLflow experiment found: run  python train.py  first.")
    runs = client.search_runs([exp.experiment_id], "", order_by=["attributes.start_time DESC"], max_results=200)
    parents = [r for r in runs if "mlflow.parentRunId" not in r.data.tags]
    if not parents:
        sys.exit("No training run found.")
    top = parents[0]
    kids = client.search_runs([exp.experiment_id], f"tags.mlflow.parentRunId = '{top.info.run_id}'", max_results=50)
    return top, kids


def main():
    top, kids = latest_children()
    rows = sorted(kids, key=lambda r: -r.data.metrics.get("roc_auc", 0))
    print(f"MLflow run: {top.info.run_name}  ({top.info.run_id})\n")
    print(f"{'Model':36s} {'Family':17s} {'Accuracy':>8s} {'F1':>6s} {'ROC-AUC':>8s} {'Train s':>8s}")
    for r in rows:
        m = r.data.metrics
        print(f"{r.info.run_name:36s} {r.data.tags.get('family', ''):17s} {m['accuracy']:8.3f} {m['f1']:6.3f} "
              f"{m['roc_auc']:8.3f} {m['train_seconds']:8.1f}")
    if "--check" in sys.argv:
        fams = [r.data.tags.get("family") for r in kids]
        for fam in ("Machine learning", "Deep learning", "Quantum"):
            assert fams.count(fam) == 2, f"expected 2 {fam} models in MLflow, found {fams.count(fam)}"
        assert fams.count("Baseline") == 1
        print("\nMLflow check passed: 2 machine learning, 2 deep learning, 2 quantum models and the baseline.")


if __name__ == "__main__":
    main()
