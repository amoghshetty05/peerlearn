# Smart Match model service (FR-16, CMP-13)

Predicts, for each Tutor in a match list, the chance that the session succeeds: the Tutor accepts
and the Learner rates it 4 or 5. Six models are trained and compared; the API uses the one with the
highest ROC-AUC on the test data (set `DEFAULT_MODEL` to choose another).

| Family | Model | File |
|---|---|---|
| Machine learning | Logistic Regression | `smartmatch/models.py` `LogisticRegressionModel` |
| Machine learning | Random Forest | `RandomForestModel` |
| Deep learning (Keras 3, JAX) | Multilayer Perceptron | `MLPModel` |
| Deep learning (Keras 3, JAX) | Wide & Deep Network | `WideDeepModel` |
| Quantum (Qiskit, simulated) | Quantum Kernel SVM, 4 qubits (bandwidth chosen by 5-fold CV) | `QSVCModel` |
| Quantum (Qiskit, simulated) | Variational Quantum Classifier, 4 qubits | `VQCModel` |

**Data.** PeerLearn has no real usage history yet, so `smartmatch/simulate.py` generates 6,000
simulated request-Tutor pairs from stated assumptions (fixed seed 2026), saved in
`data/peerlearn_sessions_simulated.csv`. Results describe how the models compare on this data, not
real-world accuracy. The same script can be retrained on real sessions later.

**Features** (all scaled to 0..1, built identically by `backend/src/services/smartMatch.js`):
Tutor level, time fit, average rating, number of ratings, acceptance rate, workload in the next
7 days, urgency, days until the preferred time.

```bash
cd ml
pip install -r requirements-dev.txt
dvc repro                               # run the whole pipeline (simulate -> train) with DVC, or step by step:
python -m smartmatch.simulate          # regenerate the data (optional, already committed)
python train.py                         # train and evaluate all six, writes models/, metrics.json and an MLflow run
python compare.py                       # compare the six from MLflow (add --check to verify all six are there)
mlflow ui --backend-store-uri sqlite:///mlflow.db   # MLflow UI on http://localhost:5000
python -m pytest -v                     # service tests (TC-29)
KERAS_BACKEND=jax uvicorn app:app --port 8000
curl localhost:8000/models              # the six models and their test results
```

`POST /predict` takes up to 20 rows of the 8 features (optionally `"model": "<key>"`) and returns one
probability per row. If the service is down, the API shows matches without predictions.
