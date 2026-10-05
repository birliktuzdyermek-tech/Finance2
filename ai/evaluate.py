import hashlib
import json
from collections import Counter
from datetime import datetime, timezone
from time import perf_counter

import numpy as np
from sklearn.metrics import precision_score, recall_score, f1_score, roc_auc_score, confusion_matrix

from ai.model import DATASET, ROOT, rows, train
from backend.analyzer import analyze


def metrics(labels, scores, threshold):
    predicted = np.array(scores) >= threshold
    tn, fp, fn, tp = confusion_matrix(labels, predicted, labels=[0, 1]).ravel()
    return {"precision": round(float(precision_score(labels, predicted, zero_division=0)), 4),
            "recall": round(float(recall_score(labels, predicted, zero_division=0)), 4),
            "f1": round(float(f1_score(labels, predicted, zero_division=0)), 4),
            "roc_auc": round(float(roc_auc_score(labels, scores)), 4),
            "false_positive_rate": round(float(fp / max(1, fp + tn)), 4),
            "confusion_matrix": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
            "decision_threshold": threshold}


def main():
    data = rows()
    training = [r for r in data if r["split"] == "train"]
    test = [r for r in data if r["split"] == "test"]
    assert not ({r["group"] for r in training} & {r["group"] for r in test})
    assert not ({r["text"] for r in training} & {r["text"] for r in test})
    model = train(training)
    labels = [int(r["label"]) for r in test]
    ml_scores = model.predict_proba([r["text"] for r in test])[:, 1]
    results, elapsed = [], []
    for row in test:
        start = perf_counter()
        result = analyze(row["text"], model=model)
        elapsed.append((perf_counter() - start) * 1000)
        results.append(result)
    output = {
        "status": "evaluated", "created_at": datetime.now(timezone.utc).isoformat(),
        "dataset": "authored_synthetic", "dataset_sha256": hashlib.sha256(DATASET.read_bytes()).hexdigest(),
        "seed": 42, "split": "fixed_template_group_holdout",
        "train_rows": len(training), "test_rows": len(test),
        "train_groups": len({r["group"] for r in training}), "test_groups": len({r["group"] for r in test}),
        "test_languages": dict(Counter(r["language"] for r in test)),
        "ml": metrics(labels, ml_scores, .5),
        "rules": metrics(labels, [r["rules_score"] / 100 for r in results], .35),
        "hybrid": metrics(labels, [r["score"] / 100 for r in results], .35),
        "latency_ms": {"median": round(float(np.median(elapsed)), 3), "p95": round(float(np.percentile(elapsed, 95)), 3), "scope": "warm in-process inference, excludes HTTP/database"},
        "limitations": "Small synthetic benchmark. Variants within test groups are correlated. Scores do not estimate real-world performance or calibrated fraud probability. No threshold tuning on test. Test has been used during prototype development; obtain a new external blind test before claiming generalization.",
    }
    directory = ROOT / "ai/evaluation"
    directory.mkdir(exist_ok=True)
    (directory / "metrics.json").write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    errors = [{"id": row["id"], "language": row["language"], "expected": int(row["label"]), "score": result["score"]}
              for row, result in zip(test, results) if (result["score"] >= 35) != bool(int(row["label"]))]
    (directory / "errors.json").write_text(json.dumps(errors, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(output, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
