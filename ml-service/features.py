"""The SAME point-in-time features are used for training and HTTP scoring."""
import math
from collections import defaultdict, deque
from common import FEATURES, WEIGHTS, timestamp

DAY = 86400

def features_for(source, candidate, as_of, history, global_stats, embeddings):
    now = timestamp(as_of)
    # No impression/outcome at or after prediction time can become a feature.
    history = [e for e in history if e.get("eventType") in WEIGHTS and timestamp(e["timestamp"]) < now][-1000:]
    total, category, brand, logs = 0, 0, 0, []
    for event in history:
        product = event.get("productSnapshot")
        if not product:
            continue
        weight = WEIGHTS[event["eventType"]]
        total += weight
        category += weight * (product.get("category") == candidate["category"])
        brand += weight * (product.get("brand") == candidate["brand"])
        logs.extend([math.log1p(float(product["price"]))] * weight)
    log_price = math.log1p(float(candidate["price"]))
    fit = math.exp(-abs(log_price - sum(logs) / len(logs))) if logs else 0.5
    stats = global_stats.get(str(candidate["_id"]), {})
    age = (now - timestamp(candidate["createdAt"])) / DAY if candidate.get("createdAt") else 0
    if age < 0:
        raise ValueError("Product snapshot created after prediction time")
    values = [float(source["category"] == candidate["category"]), embeddings.cosine(source, candidate),
        abs(float(candidate["price"]) - float(source["price"])), float(candidate["price"]) / max(float(source["price"]), 1),
        float(candidate["rating"]) / 5, math.log1p(stats.get("recent", 0) + stats.get("previous", 0)),
        float(candidate.get("availableQuantity", 0) > 0), float(source["brand"] == candidate["brand"]),
        category / total if total else 0, brand / total if total else 0, fit, age,
        (stats.get("recent", 0) - stats.get("previous", 0)) / 7]
    if not all(math.isfinite(value) for value in values):
        raise ValueError("Non-finite feature")
    return dict(zip(FEATURES, values))

class HistoryState:
    def __init__(self):
        self.users = defaultdict(lambda: deque(maxlen=1000))
        self.products = defaultdict(deque)

    def observe(self, event):
        if event["eventType"] in WEIGHTS:
            self.users[str(event["userId"])].append(event)
            self.products[str(event["productId"])].append((timestamp(event["timestamp"]), WEIGHTS[event["eventType"]]))

    def stats(self, ids, as_of):
        now = timestamp(as_of)
        result = {}
        for pid in ids:
            queue = self.products[str(pid)]
            while queue and queue[0][0] < now - 14 * DAY:
                queue.popleft()
            result[str(pid)] = {
                "recent": sum(weight for time, weight in queue if now - 7 * DAY <= time < now),
                "previous": sum(weight for time, weight in queue if now - 14 * DAY <= time < now - 7 * DAY)}
        return result
