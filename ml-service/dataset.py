"""Only actual exposures produce examples; labels mature for 24 hours."""
import argparse
from collections import defaultdict
import pandas as pd
from common import DATA, FEATURES, LABEL_WINDOW_HOURS, WEIGHTS, read_events, timestamp, iso
from embeddings import Embeddings
from features import HistoryState, features_for
from simulate import baseline_score

def build_examples(events, embeddings, source="simulated"):
    events = sorted((e for e in events if e["source"] == source), key=lambda e: timestamp(e["timestamp"]))
    if not events:
        raise ValueError("No events in selected source")
    end = timestamp(events[-1]["timestamp"])
    window = LABEL_WINDOW_HOURS * 3600
    outcomes = defaultdict(list)
    for event in events:
        if event["eventType"] in WEIGHTS and event.get("impressionId"):
            outcomes[event["impressionId"]].append(event)
    state, rows = HistoryState(), []
    for event in events:
        now = timestamp(event["timestamp"])
        if event["eventType"] == "IMPRESSION" and now + window <= end:
            candidate, source_product = event["productSnapshot"], event["sourceSnapshot"]
            if candidate["category"] != source_product["category"] or not candidate.get("availableQuantity", 0):
                continue
            label = max([0] + [WEIGHTS[o["eventType"]] for o in outcomes[event["impressionId"]]
                if now <= timestamp(o["timestamp"]) <= now + window and o["userId"] == event["userId"] and o["productId"] == event["productId"]])
            values = features_for(source_product, candidate, now, state.users[str(event["userId"])],
                state.stats([candidate["_id"]], now), embeddings)
            rows.append({**values, "label": label, "requestId": event["requestId"], "userId": event["userId"],
                "productId": candidate["_id"], "timestamp": now, "labelMaturedAt": now + window,
                "position": event["position"], "baselineScore": baseline_score(source_product, candidate), "source": source})
        state.observe(event)
    return pd.DataFrame(rows)

def chronological_split(frame):
    requests = frame.groupby("requestId")["timestamp"].min().sort_values()
    if len(requests) < 30:
        raise ValueError("At least 30 matured requests are required")
    validation_start = float(requests.iloc[int(len(requests) * 0.6)])
    test_start = float(requests.iloc[int(len(requests) * 0.8)])
    train = frame[frame.labelMaturedAt < validation_start].copy()
    validation = frame[(frame.timestamp >= validation_start) & (frame.labelMaturedAt < test_start)].copy()
    test = frame[frame.timestamp >= test_start].copy()
    # No label used for fitting/tuning extends into the following split.
    assert train.labelMaturedAt.max() < validation.timestamp.min()
    assert validation.labelMaturedAt.max() < test.timestamp.min()
    assert not (set(train.requestId) & set(validation.requestId) | set(train.requestId) & set(test.requestId) | set(validation.requestId) & set(test.requestId))
    split = {name: {"rows": len(part), "requests": part.requestId.nunique(),
        "start": iso(part.timestamp.min()), "end": iso(part.timestamp.max())}
        for name, part in [("train", train), ("validation", validation), ("test", test)]}
    split["embargo_hours"] = LABEL_WINDOW_HOURS
    split["validation_start"] = iso(validation_start)
    split["test_start"] = iso(test_start)
    split["discarded_boundary_rows"] = len(frame) - len(train) - len(validation) - len(test)
    return train, validation, test, split

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--events", default=str(DATA / "events.jsonl"))
    parser.add_argument("--source", choices=["simulated", "real"], default="simulated")
    args = parser.parse_args()
    events = list(read_events(args.events))
    embeddings = Embeddings(allow_encode=True)
    embeddings.ensure([e[key] for e in events for key in ["productSnapshot", "sourceSnapshot"] if key in e])
    frame = build_examples(events, embeddings, args.source)
    frame.to_csv(DATA / "examples.csv", index=False)
    print(f"Saved {len(frame)} matured exposed examples with {len(FEATURES)} features")
