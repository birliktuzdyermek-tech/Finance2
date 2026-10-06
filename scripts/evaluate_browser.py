"""Measure the current browser rules on the authored synthetic corpus.

This is a development check, not an independent or real-world validation.
"""

import csv
import argparse
import hashlib
import json
import shutil
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATASET = ROOT / "ai/dataset/messages.csv"
OUTPUT = ROOT / "ai/evaluation/browser-rules.json"
ENGINE = ROOT / "frontend/analyzer.js"

NODE_EVALUATE = r"""
const fs = require('node:fs');
const engine = require(process.argv[1]);
const rows = JSON.parse(fs.readFileSync(0, 'utf8'));
const verdicts = rows.map(row => engine.analyze(row.text, 'sms').verdict);
process.stdout.write(JSON.stringify(verdicts));
"""


def metrics(rows):
    tp = sum(row["label"] == 1 and row["predicted"] == 1 for row in rows)
    fp = sum(row["label"] == 0 and row["predicted"] == 1 for row in rows)
    tn = sum(row["label"] == 0 and row["predicted"] == 0 for row in rows)
    fn = sum(row["label"] == 1 and row["predicted"] == 0 for row in rows)
    precision = tp / (tp + fp) if tp + fp else None
    recall = tp / (tp + fn) if tp + fn else None
    fpr = fp / (fp + tn) if fp + tn else None
    return {
        "rows": len(rows),
        "groups": len({row["group"] for row in rows}),
        "tp": tp,
        "fp": fp,
        "tn": tn,
        "fn": fn,
        "precision": precision,
        "recall": recall,
        "false_positive_rate": fpr,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--external", type=Path, help="Collector-declared blind CSV using blind-template.csv")
    parser.add_argument("--output", type=Path, help="Report path; defaults to a private artifact for external data")
    args = parser.parse_args()
    dataset = args.external or DATASET
    output = args.output or (ROOT / "artifacts/browser-external-evaluation.json" if args.external else OUTPUT)
    if dataset.resolve() == output.resolve():
        raise ValueError("Input and output paths must differ")
    with dataset.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        required = {"id", "group", "language", "label", "text"}
        if args.external:
            required |= {"source", "consent"}
        if not required.issubset(reader.fieldnames or []):
            raise ValueError(f"CSV must contain {', '.join(sorted(required))}")
        rows = list(reader)
    if args.external:
        if not rows or any(
            row["consent"] != "yes" or not row["id"] or not row["group"]
            or not row["source"] or row["language"] not in {"ru", "kz", "en"}
            or row["label"] not in {"0", "1"} or not 3 <= len(row["text"].strip()) <= 10000
            for row in rows
        ) or {row["label"] for row in rows} != {"0", "1"}:
            raise ValueError("External CSV requires consent, both labels, groups, source, language, and valid text lengths")
        with DATASET.open(newline="", encoding="utf-8") as handle:
            known = {row["text"].strip().casefold() for row in csv.DictReader(handle)}
        texts = [row["text"].strip().casefold() for row in rows]
        if known.intersection(texts) or len(texts) != len(set(texts)):
            raise ValueError("Duplicate or development-corpus text in external CSV")
    else:
        rows = [row for row in rows if row["split"] == "test"]
    if not rows or len({row["id"] for row in rows}) != len(rows):
        raise ValueError("Missing test rows or duplicate IDs")
    node = shutil.which("node")
    if not node:
        raise RuntimeError("Node.js is required to execute the browser rules")
    result = subprocess.run(
        [node, "-e", NODE_EVALUATE, str(ENGINE)],
        input=json.dumps(rows, ensure_ascii=False),
        text=True,
        encoding="utf-8",
        capture_output=True,
        check=True,
    )
    verdicts = json.loads(result.stdout)
    if len(verdicts) != len(rows) or any(v not in {"low", "suspicious", "high"} for v in verdicts):
        raise ValueError("Browser analyzer returned invalid verdicts")
    for row, verdict in zip(rows, verdicts):
        row["label"] = int(row["label"])
        row["predicted"] = int(verdict != "low")
    report = {
        "scope": "current_browser_rules_only",
        "dataset": "collector_declared_independent" if args.external else "authored_synthetic_development",
        "dataset_sha256": hashlib.sha256(dataset.read_bytes()).hexdigest(),
        "split": "all_external_rows" if args.external else "test",
        "positive_decision": "score >= 35 (suspicious or high)",
        "overall": metrics(rows),
        "by_language": {
            language: metrics([row for row in rows if row["language"] == language])
            for language in sorted({row["language"] for row in rows})
        },
        "limitations": (
            ["Collector review must confirm consent, redaction, and blind collection; code cannot prove them."]
            if args.external else [
                "Authored synthetic templates, not real banking traffic.",
                "Variants within each template group are correlated.",
                "The corpus was used during development and is not a blind external test.",
            ]
        ) + ["These results do not measure the separate server ML or hybrid pipeline."],
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Browser rules evaluation saved: {output}")


if __name__ == "__main__":
    main()
