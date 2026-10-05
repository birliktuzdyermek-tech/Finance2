"""Reproducible character TF-IDF + logistic regression, no pickle loading."""
import csv
from pathlib import Path
from functools import lru_cache

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline

ROOT = Path(__file__).resolve().parents[1]
DATASET = ROOT / "ai/dataset/messages.csv"


def rows():
    with DATASET.open(encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def train(data):
    model = Pipeline([
        ("vectorizer", TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), sublinear_tf=True)),
        ("classifier", LogisticRegression(C=4, max_iter=1000, random_state=42)),
    ])
    model.fit([r["text"] for r in data], [int(r["label"]) for r in data])
    return model


@lru_cache(maxsize=1)
def load_model():
    return train([r for r in rows() if r["split"] == "train"])


def predict(text, model=None):
    return float((model or load_model()).predict_proba([text])[0, 1])
