"""The 8 input features of the Smart Match models (FR-16) and how they are built.

Every feature is scaled to the range 0 to 1, so all six models see the same numbers.
The Node.js API builds the same values from the database (backend/src/services/smartMatch.js).
"""
import numpy as np

FEATURES = [
    "proficiency",      # Tutor's level in the subject: Beginner 0, Intermediate 0.5, Advanced 1
    "time_fit",         # Tutor free at the preferred time 1, free that day 0.5, otherwise 0
    "rating_avg",       # Tutor's average rating / 5 (0 when there are no ratings yet)
    "rating_count",     # Number of ratings, capped at 20, / 20
    "acceptance_rate",  # Share of answered requests the Tutor accepted, (accepted + 1) / (answered + 2)
    "load",             # Tutor's accepted sessions in the next 7 days, capped at 10, / 10
    "urgency",          # Learner's urgency: Low 0, Normal 0.5, High 1
    "lead_time",        # Days until the preferred time, capped at 14, / 14
]

FEATURE_LABELS = {
    "proficiency": "Tutor level",
    "time_fit": "Time fit",
    "rating_avg": "Average rating",
    "rating_count": "Number of ratings",
    "acceptance_rate": "Acceptance rate",
    "load": "Tutor workload",
    "urgency": "Urgency",
    "lead_time": "Days ahead",
}


def to_matrix(rows):
    """rows: list of dicts with the 8 feature names -> float32 array of shape (n, 8)."""
    return np.array([[float(r[f]) for f in FEATURES] for r in rows], dtype=np.float32)


def rule_score(X):
    """The existing rule-based match score of FR-06 and FR-15, rebuilt from the features and
    scaled to 0..1. It is the baseline every model has to beat."""
    X = np.asarray(X)
    prof = np.select([X[:, 0] >= 0.99, X[:, 0] >= 0.49], [20, 13], 7)
    time = np.select([X[:, 1] >= 0.99, X[:, 1] >= 0.49], [30, 15], 0)
    count = np.round(X[:, 3] * 20)
    bonus = np.where(count >= 3, np.round(X[:, 2] * 10, 1), 0)
    return np.minimum(100, 50 + time + prof + bonus) / 100.0
