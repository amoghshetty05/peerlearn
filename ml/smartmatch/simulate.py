"""Simulated training data for Smart Match.

PeerLearn has no real usage history yet, so the models are trained on simulated
request-Tutor pairs. Each row is one help request offered to one Tutor; the label says
whether the session succeeded (the Tutor accepted and the Learner later rated it 4 or 5).

The success chance follows stated assumptions (below), plus random noise, so the data has
the kind of structure real data would have: some effects are linear, some are interactions
(an urgent request hurts more when the Tutor is not free at that time) and some are
thresholds (a Tutor stops answering well once very busy). A fixed seed makes it repeatable.
When real PeerLearn sessions exist, the same training script can be pointed at them instead.
"""
import numpy as np
import pandas as pd

from .features import FEATURES

SEED = 2026


def success_logit(df, rng=None):
    """Assumed effect of each feature on the chance of a successful session (log-odds)."""
    confidence = 1 - np.exp(-df.rating_count * 20 / 4)           # ratings mean more when there are many
    z = (-1.2
         + 2.0 * df.time_fit                                      # free at the asked time
         + 0.9 * df.proficiency                                   # stronger in the subject
         + 2.4 * confidence * (df.rating_avg - 0.7)               # well-rated Tutors, if the rating is trustworthy
         + 2.4 * (df.acceptance_rate - 0.6)                       # Tutors who usually say yes
         - 3.0 * np.clip(df.load - 0.5, 0, None)                  # very busy Tutors drop off sharply
         - 1.4 * df.urgency * (1 - df.time_fit)                   # urgent requests need a Tutor free at that time
         - 0.8 * (df.lead_time < 0.08) * (1 - df.acceptance_rate) # last-minute requests to hesitant Tutors
         + 0.5 * df.lead_time * df.acceptance_rate)
    if rng is not None:
        z = z + rng.normal(0, 0.6, len(df))                       # things the data does not capture
    return z


def generate(n=6000, seed=SEED):
    rng = np.random.default_rng(seed)
    rating_count = np.minimum(rng.geometric(0.18, n) - 1, 20)
    rating_avg = np.where(rating_count > 0, np.clip(rng.normal(4.1, 0.6, n), 1, 5) / 5, 0.0)
    df = pd.DataFrame({
        "proficiency": rng.choice([0.0, 0.5, 1.0], n, p=[0.3, 0.4, 0.3]),
        "time_fit": rng.choice([1.0, 0.5, 0.0], n, p=[0.45, 0.30, 0.25]),
        "rating_avg": rating_avg,
        "rating_count": rating_count / 20,
        "acceptance_rate": rng.beta(5, 2, n),
        "load": np.minimum(rng.poisson(2.5, n), 10) / 10,
        "urgency": rng.choice([0.0, 0.5, 1.0], n, p=[0.3, 0.5, 0.2]),
        "lead_time": rng.uniform(0, 1, n),
    })[FEATURES]
    p = 1 / (1 + np.exp(-success_logit(df, rng)))
    df["success"] = (rng.uniform(0, 1, n) < p).astype(int)
    return df.round(4)


if __name__ == "__main__":
    import sys
    out = sys.argv[1] if len(sys.argv) > 1 else "data/peerlearn_sessions_simulated.csv"
    d = generate()
    d.to_csv(out, index=False)
    print(f"wrote {len(d)} rows to {out}; success rate {d.success.mean():.1%}")
