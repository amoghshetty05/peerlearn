"""The six Smart Match models: 2 machine learning, 2 deep learning, 2 quantum.

Every model is wrapped in the same small interface so training, evaluation and the API
treat them alike:  fit(X, y)  and  predict_proba(X) -> chance of success (0..1) per row.
"""
import os
import time

os.environ.setdefault("KERAS_BACKEND", "jax")

import joblib
import numpy as np
from sklearn.feature_selection import SelectKBest, f_classif
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import MinMaxScaler, StandardScaler

SEED = 2026
N_QUBITS = 4


class Model:
    key = name = family = ""
    description = ""

    def fit(self, X, y):
        raise NotImplementedError

    def predict_proba(self, X):
        raise NotImplementedError

    def params(self):
        return {}

    def save(self, folder):
        joblib.dump(self, os.path.join(folder, f"{self.key}.joblib"))


# ---------------------------------------------------------------- machine learning
class LogisticRegressionModel(Model):
    key, name, family = "logistic_regression", "Logistic Regression", "Machine learning"
    description = "Linear model on standardised features; fast and easy to explain."

    def fit(self, X, y):
        self.pipe = make_pipeline(StandardScaler(), LogisticRegression(max_iter=1000, random_state=SEED))
        self.pipe.fit(X, y)
        return self

    def params(self):
        return {"scaling": "standard", "penalty": "l2", "C": 1.0, "max_iter": 1000}

    def predict_proba(self, X):
        return self.pipe.predict_proba(X)[:, 1]


class RandomForestModel(Model):
    key, name, family = "random_forest", "Random Forest", "Machine learning"
    description = "120 decision trees voting together; captures thresholds and interactions."

    def fit(self, X, y):
        self.clf = RandomForestClassifier(n_estimators=120, max_depth=9, min_samples_leaf=8,
                                          random_state=SEED, n_jobs=-1)
        self.clf.fit(X, y)
        return self

    def params(self):
        return {"n_estimators": 120, "max_depth": 9, "min_samples_leaf": 8}

    def predict_proba(self, X):
        return self.clf.predict_proba(X)[:, 1]


# ---------------------------------------------------------------- deep learning (Keras 3)
class _KerasModel(Model):
    """Keras models are saved as .keras files; the wrapper itself is pickled without them."""
    epochs = 80

    def _inputs(self, X):
        return np.asarray(X, dtype=np.float32)

    def fit(self, X, y):
        import keras
        keras.utils.set_random_seed(SEED)
        self.net = self.build()
        self.net.compile(optimizer=keras.optimizers.Adam(1e-3), loss="binary_crossentropy",
                         metrics=[keras.metrics.AUC(name="auc")])
        stop = keras.callbacks.EarlyStopping(monitor="val_auc", mode="max", patience=10, restore_best_weights=True)
        self.history = self.net.fit(self._inputs(X), np.asarray(y, dtype=np.float32), epochs=self.epochs,
                                    batch_size=64, validation_split=0.15, callbacks=[stop], verbose=0).history
        return self

    def params(self):
        return {"framework": "Keras 3 (JAX backend)", "optimizer": "Adam", "learning_rate": 0.001, "batch_size": 64,
                "max_epochs": self.epochs, "epochs_run": len(self.history.get("loss", [])), "early_stopping": "val_auc, patience 10",
                "trainable_parameters": int(self.net.count_params()) if self.net is not None else None}

    def predict_proba(self, X):
        return np.asarray(self.net.predict(self._inputs(X), verbose=0)).reshape(-1)

    def save(self, folder):
        self.net.save(os.path.join(folder, f"{self.key}.keras"))
        net, self.net = self.net, None
        joblib.dump(self, os.path.join(folder, f"{self.key}.joblib"))
        self.net = net

    def load_network(self, folder):
        import keras
        self.net = keras.saving.load_model(os.path.join(folder, f"{self.key}.keras"))
        return self


class MLPModel(_KerasModel):
    key, name, family = "mlp", "Multilayer Perceptron", "Deep learning"
    description = "Feed-forward neural network: 8 inputs, hidden layers of 32 and 16 neurons with dropout."

    def build(self):
        import keras
        from keras import layers
        inp = keras.Input(shape=(8,), name="features")
        x = layers.Dense(32, activation="relu")(inp)
        x = layers.Dropout(0.2)(x)
        x = layers.Dense(16, activation="relu")(x)
        out = layers.Dense(1, activation="sigmoid")(x)
        return keras.Model(inp, out, name="mlp")


class WideDeepModel(_KerasModel):
    key, name, family = "wide_deep", "Wide & Deep Network", "Deep learning"
    description = ("Wide part: a linear layer over the features and 3 crossed features (memorises simple rules); "
                   "deep part: a 64-32-16 network (learns patterns). Their outputs are added.")

    @staticmethod
    def crossed(X):
        X = np.asarray(X, dtype=np.float32)
        return np.stack([X[:, 1] * X[:, 6],           # time fit x urgency
                         X[:, 5] * X[:, 4],           # workload x acceptance rate
                         X[:, 2] * X[:, 3]], axis=1)  # rating x number of ratings

    def _inputs(self, X):
        X = np.asarray(X, dtype=np.float32)
        return {"features": X, "crossed": self.crossed(X)}

    def build(self):
        import keras
        from keras import layers
        feats = keras.Input(shape=(8,), name="features")
        cross = keras.Input(shape=(3,), name="crossed")
        wide = layers.Dense(1, name="wide")(layers.Concatenate()([feats, cross]))
        d = layers.Dense(64, activation="relu")(feats)
        d = layers.Dropout(0.2)(d)
        d = layers.Dense(32, activation="relu")(d)
        d = layers.Dense(16, activation="relu")(d)
        deep = layers.Dense(1, name="deep")(d)
        out = layers.Activation("sigmoid")(layers.Add()([wide, deep]))
        return keras.Model([feats, cross], out, name="wide_and_deep")


# ---------------------------------------------------------------- quantum (Qiskit, simulated)
ANGLE_SCALES = [np.pi, np.pi / 2, np.pi / 4, np.pi / 8]   # candidate encoding bandwidths


def _quantum_preprocess(angle_max=np.pi):
    """8 features -> the 4 most informative ones (ANOVA F-test on the training data) -> angles in
    [0, angle_max], one per qubit. angle_max is the encoding 'bandwidth': smaller values keep similar
    students' quantum states similar, which stops the kernel from treating every pair as unrelated.
    (Principal components were tried first: with 8 nearly independent features, 4 components keep
    only half the information and the quantum models fell to ~0.55 AUC.)"""
    return make_pipeline(StandardScaler(), SelectKBest(f_classif, k=N_QUBITS),
                         MinMaxScaler(feature_range=(0, angle_max), clip=True))


class QSVCModel(Model):
    key, name, family = "qsvc", "Quantum Kernel SVM", "Quantum"
    description = ("Support vector machine whose kernel is the overlap of 4-qubit quantum states from a ZZ "
                   "feature map, computed on Qiskit's statevector simulator. The encoding bandwidth and the "
                   "number of feature-map repetitions are chosen by 5-fold cross-validation on the training rows.")
    train_size = 400

    def _make(self, angle_max, reps):
        from qiskit.circuit.library import ZZFeatureMap
        from qiskit_machine_learning.algorithms import QSVC
        from qiskit_machine_learning.kernels import FidelityStatevectorKernel
        kernel = FidelityStatevectorKernel(feature_map=ZZFeatureMap(N_QUBITS, reps=reps))
        return _quantum_preprocess(angle_max), QSVC(quantum_kernel=kernel, probability=True, C=1.0, random_state=SEED)

    def fit(self, X, y):
        from sklearn.metrics import roc_auc_score
        from sklearn.model_selection import StratifiedKFold
        X, y = np.asarray(X), np.asarray(y)
        folds = list(StratifiedKFold(5, shuffle=True, random_state=SEED).split(X, y))
        self.cv_results = []
        for angle_max in ANGLE_SCALES:
            for reps in (1, 2):
                aucs = []
                for tr, va in folds:
                    prep, qsvc = self._make(angle_max, reps)
                    prep.fit(X[tr], y[tr])
                    qsvc.fit(prep.transform(X[tr]), y[tr])
                    aucs.append(roc_auc_score(y[va], qsvc.predict_proba(prep.transform(X[va]))[:, 1]))
                self.cv_results.append({"angle_max": float(angle_max), "reps": reps, "cv_auc": float(np.mean(aucs))})
        best = max(self.cv_results, key=lambda r: r["cv_auc"])
        self.angle_max, self.reps = best["angle_max"], best["reps"]
        self.prep, self.qsvc = self._make(self.angle_max, self.reps)
        self.prep.fit(X, y)
        self.qsvc.fit(self.prep.transform(X), y)
        return self

    def params(self):
        return {"qubits": N_QUBITS, "feature_map": "ZZFeatureMap", "feature_map_reps": self.reps,
                "angle_max": round(self.angle_max, 4), "C": 1.0, "kernel": "fidelity (statevector)",
                "selection": "5-fold CV over 4 bandwidths x 2 reps"}

    def predict_proba(self, X):
        return self.qsvc.predict_proba(self.prep.transform(X))[:, 1]


class VQCModel(Model):
    key, name, family = "vqc", "Variational Quantum Classifier", "Quantum"
    description = ("4-qubit circuit: a ZZ feature map encodes the data and a RealAmplitudes circuit with 12 "
                   "trainable rotation angles classifies it; the angles are tuned by COBYLA to minimise "
                   "cross-entropy. Probabilities come from Qiskit's exact statevector simulator. The encoding "
                   "bandwidth is the one chosen by the kernel model's cross-validation (training a VQC takes "
                   "about 2 minutes, too slow to cross-validate each setting).")
    train_size = 400
    maxiter = 150

    def __init__(self, angle_max=np.pi):
        self.angle_max = angle_max

    @staticmethod
    def _circuits():
        from qiskit.circuit.library import RealAmplitudes, ZZFeatureMap
        fmap, ansatz = ZZFeatureMap(N_QUBITS, reps=1), RealAmplitudes(N_QUBITS, reps=2)
        return fmap, ansatz, fmap.compose(ansatz)

    def _p1(self, angles, weights):
        """Chance of class 1 = probability that the measured 4-bit string has odd parity
        (the standard two-class reading of a VQC), from the exact statevector."""
        from qiskit.quantum_info import Statevector
        fmap, ansatz, circuit = self._circuits()
        circuit = circuit.assign_parameters(dict(zip(ansatz.parameters, weights)))
        odd = np.array([bin(i).count("1") % 2 for i in range(2 ** N_QUBITS)], dtype=bool)
        return np.array([Statevector(circuit.assign_parameters(dict(zip(fmap.parameters, row)))).probabilities()[odd].sum()
                         for row in angles])

    def fit(self, X, y):
        from scipy.optimize import minimize
        self.prep = _quantum_preprocess(self.angle_max).fit(X, y)
        angles, y = self.prep.transform(X), np.asarray(y, dtype=float)
        n_weights = self._circuits()[1].num_parameters
        self.loss_curve = []

        def loss(w):
            p = np.clip(self._p1(angles, w), 1e-6, 1 - 1e-6)
            value = float(-np.mean(y * np.log(p) + (1 - y) * np.log(1 - p)))
            self.loss_curve.append(value)
            return value

        start = np.random.default_rng(SEED).uniform(-0.5, 0.5, n_weights)
        self.weights = minimize(loss, start, method="COBYLA", options={"maxiter": self.maxiter, "rhobeg": 0.5}).x
        return self

    def params(self):
        return {"qubits": N_QUBITS, "feature_map": "ZZFeatureMap", "feature_map_reps": 1,
                "ansatz": "RealAmplitudes", "ansatz_reps": 2, "trainable_angles": 12,
                "optimizer": "COBYLA", "maxiter": self.maxiter, "angle_max": round(self.angle_max, 4)}

    def predict_proba(self, X):
        return self._p1(self.prep.transform(X), self.weights)


ALL = [LogisticRegressionModel, RandomForestModel, MLPModel, WideDeepModel, QSVCModel, VQCModel]
BY_KEY = {m.key: m for m in ALL}


def load(folder, key):
    m = joblib.load(os.path.join(folder, f"{key}.joblib"))
    if isinstance(m, _KerasModel):
        m.load_network(folder)
    return m


def timed(fn, *a):
    t = time.perf_counter()
    r = fn(*a)
    return r, time.perf_counter() - t
