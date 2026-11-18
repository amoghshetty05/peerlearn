"""Pipeline parameters from ml/params.yaml (tracked by DVC)."""
import os

import yaml

PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "params.yaml")

with open(PATH) as f:
    P = yaml.safe_load(f)
