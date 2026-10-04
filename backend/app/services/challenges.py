"""ADAPT random challenge generator (section 5.3).

A template = statement template + parameter space + reference solver + automatic checker.
The variant seed derives from (secret salt, user, task, attempt number): reproducible, but
unique per student and not guessable. Every variant is solved by the reference solver before
it is issued, so an unsolvable variant can never reach a student.

Variant params are split into `public` (shown to the student) and `private` (reference answer /
checker data, never sent to the client).
"""
import hashlib
import ipaddress
import json
import random
from dataclasses import dataclass
from typing import Any, Dict, List, Tuple

from app.core.config import settings


@dataclass
class Variant:
    template: str
    seed: str
    statement: str
    public: Dict[str, Any]
    private: Dict[str, Any]
    kind: str  # "answer" (checked server-side) or "code" (run in sandbox)

    @property
    def checksum(self) -> str:
        return hashlib.sha256(json.dumps(self.public, sort_keys=True).encode()).hexdigest()[:32]


def derive_seed(user_id: Any, task_id: Any, attempt_no: int, nonce: int = 0) -> str:
    raw = f"{settings.CHALLENGE_SALT}|{user_id}|{task_id}|{attempt_no}|{nonce}"
    return hashlib.sha256(raw.encode()).hexdigest()[:24]


# ---------------------------------------------------------------------------
# Computer engineering: VLSM subnet / VLAN plan (+ "branch added, devices doubled")
# ---------------------------------------------------------------------------

DEPARTMENTS = ["Buxgalteriya", "IT", "Kadrlar", "Savdo", "Ombor", "Rahbariyat", "Laboratoriya", "Mehmonlar Wi-Fi"]


def _subnet_params(rng: random.Random, changed: bool) -> Dict[str, Any]:
    base = ipaddress.ip_network(f"10.{rng.randint(10, 250)}.0.0/16")
    names = rng.sample(DEPARTMENTS, rng.randint(4, 6))
    hosts = {n: rng.choice([12, 20, 28, 45, 60, 90, 120, 200, 250, 400]) for n in names}
    if changed:
        hosts = {n: h * 2 for n, h in hosts.items()}
        hosts["Yangi filial"] = rng.choice([30, 60, 100])
    return {"base": str(base), "hosts": hosts}


def _subnet_reference(public: Dict[str, Any]) -> Dict[str, str]:
    """Largest-first VLSM allocation; proves the variant is solvable."""
    base = ipaddress.ip_network(public["base"])
    cursor = int(base.network_address)
    plan = {}
    for name, h in sorted(public["hosts"].items(), key=lambda kv: -kv[1]):
        size = 1
        while size - 2 < h:
            size *= 2
        cursor = (cursor + size - 1) // size * size
        net = ipaddress.ip_network((cursor, 32 - size.bit_length() + 1))
        if not net.subnet_of(base):
            raise ValueError("variant does not fit the base network")
        plan[name] = str(net)
        cursor += size
    return plan


def check_subnet_plan(public: Dict[str, Any], answer: Dict[str, str]) -> Tuple[float, List[Dict[str, Any]]]:
    """Accepts any valid plan: each subnet inside base, large enough, aligned, non-overlapping."""
    base = ipaddress.ip_network(public["base"])
    details, nets = [], []
    for name, need in public["hosts"].items():
        raw = (answer or {}).get(name, "")
        ok, reason = False, ""
        try:
            net = ipaddress.ip_network(str(raw).strip(), strict=True)
            if not net.subnet_of(base):
                reason = "asosiy tarmoqdan tashqarida"
            elif net.num_addresses - 2 < need:
                reason = f"{need} ta qurilmaga yetmaydi"
            elif any(net.overlaps(other) for other in nets):
                reason = "boshqa subnet bilan kesishadi"
            else:
                ok = True
                nets.append(net)
        except ValueError:
            reason = "noto‘g‘ri CIDR yozuvi"
        details.append({"name": name, "passed": ok, "error": None if ok else reason})
    score = 100 * sum(d["passed"] for d in details) / len(details)
    return round(score, 1), details


def _subnet_statement(public: Dict[str, Any], changed: bool) -> str:
    lines = "\n".join(f"- {n}: {h} ta qurilma" for n, h in public["hosts"].items())
    head = (
        "Shart o‘zgardi: filial qo‘shildi va qurilmalar soni 2 baravar oshdi. Rejani qayta loyihalang.\n"
        if changed else ""
    )
    return (
        f"{head}{public['base']} tarmog‘ini bo‘limlar uchun VLSM usulida subnetlarga bo‘ling. "
        f"Har bir bo‘lim uchun CIDR (masalan 10.1.0.0/25) kiriting.\n{lines}"
    )


# ---------------------------------------------------------------------------
# Software engineering: parametric business rules, implemented as code and run in the sandbox
# ---------------------------------------------------------------------------

def _rules_params(rng: random.Random, changed: bool) -> Dict[str, Any]:
    t1 = rng.choice([100_000, 150_000, 200_000])
    t2 = t1 * rng.choice([2, 3])
    params = {
        "tier1_min": t1, "tier1_pct": rng.choice([3, 5, 7]),
        "tier2_min": t2, "tier2_pct": rng.choice([10, 12, 15]),
        "shipping_fee": rng.choice([15_000, 20_000, 25_000]),
        "free_shipping_min": t2,
        "vip_extra_pct": rng.choice([2, 3, 5]) if changed else 0,
    }
    return params


def _rules_total(p: Dict[str, Any], subtotal: int, vip: bool) -> int:
    pct = p["tier2_pct"] if subtotal >= p["tier2_min"] else p["tier1_pct"] if subtotal >= p["tier1_min"] else 0
    if vip:
        pct += p["vip_extra_pct"]
    discounted = subtotal - subtotal * pct // 100
    shipping = 0 if subtotal >= p["free_shipping_min"] else p["shipping_fee"]
    return discounted + shipping


def _rules_tests(p: Dict[str, Any], rng: random.Random) -> List[Dict[str, Any]]:
    probes = [p["tier1_min"] - 1, p["tier1_min"], p["tier2_min"] - 1, p["tier2_min"], p["tier2_min"] * 2, rng.randint(1_000, 90_000)]
    tests = []
    for i, sub in enumerate(probes):
        vip = bool(p["vip_extra_pct"]) and i % 2 == 1
        tests.append({
            "name": f"subtotal={sub}{' vip' if vip else ''}",
            "call": f"order_total({sub}, {vip})",
            "expected": repr(_rules_total(p, sub, vip)),
            "hidden": i >= 3,
        })
    return tests


def _rules_statement(p: Dict[str, Any], changed: bool) -> str:
    vip = (
        f"\nYangi biznes talab: VIP mijozlar qo‘shimcha {p['vip_extra_pct']}% chegirma oladi (tier chegirmasiga qo‘shiladi)."
        if changed else ""
    )
    return (
        "`order_total(subtotal: int, vip: bool) -> int` funksiyasini yozing (so‘mda, butun son):\n"
        f"- subtotal ≥ {p['tier1_min']:,} bo‘lsa {p['tier1_pct']}% chegirma;\n"
        f"- subtotal ≥ {p['tier2_min']:,} bo‘lsa {p['tier2_pct']}% chegirma (tier1 o‘rniga);\n"
        "- chegirma summasi butun songa pastga yaxlitlanadi (subtotal * pct // 100);\n"
        f"- subtotal ≥ {p['free_shipping_min']:,} bo‘lsa yetkazib berish bepul, aks holda {p['shipping_fee']:,} so‘m qo‘shiladi."
        f"{vip}"
    )


# ---------------------------------------------------------------------------
# AI: metrics on an imbalanced dataset (+ "metric constraint changed")
# ---------------------------------------------------------------------------

SCENARIOS = [
    ("Bemorlarda kasallikni erta aniqlash", "recall", "kasal bemorni o‘tkazib yuborish (FN) eng qimmat xato"),
    ("Bank firibgarligini bloklash", "precision", "halol mijozni noto‘g‘ri bloklash (FP) mijozni yo‘qotadi"),
    ("Spam filtri", "precision", "muhim xatni spamga tashlash (FP) qimmatroq"),
    ("Ishlab chiqarishdagi nuqsonli detal", "recall", "nuqsonli detalni o‘tkazib yuborish (FN) xavfli"),
]


def _metrics_params(rng: random.Random, changed: bool) -> Dict[str, Any]:
    positives = rng.randint(40, 160)
    negatives = positives * rng.choice([8, 12, 20])
    tp = rng.randint(int(positives * 0.5), int(positives * 0.9))
    fp = rng.randint(int(negatives * 0.01), int(negatives * 0.06))
    scenario = SCENARIOS[rng.randrange(len(SCENARIOS))]
    if changed:
        # Constraint changed: the costly error flips
        flipped = "precision" if scenario[1] == "recall" else "recall"
        scenario = (scenario[0] + " (yangi talab)", flipped, "biznes talab o‘zgardi: endi boshqa xato turi qimmatroq")
    return {"tp": tp, "fn": positives - tp, "fp": fp, "tn": negatives - fp, "scenario": scenario[0],
            "scenario_hint": scenario[2], "_metric": scenario[1]}


def _metrics_reference(p: Dict[str, Any]) -> Dict[str, Any]:
    precision = p["tp"] / (p["tp"] + p["fp"])
    recall = p["tp"] / (p["tp"] + p["fn"])
    f1 = 2 * precision * recall / (precision + recall)
    accuracy = (p["tp"] + p["tn"]) / (p["tp"] + p["tn"] + p["fp"] + p["fn"])
    return {"precision": round(precision, 3), "recall": round(recall, 3), "f1": round(f1, 3),
            "accuracy": round(accuracy, 3), "metric": p["_metric"]}


def check_metrics(private: Dict[str, Any], answer: Dict[str, Any]) -> Tuple[float, List[Dict[str, Any]]]:
    ref = private["reference"]
    details = []
    for key in ("precision", "recall", "f1"):
        try:
            ok = abs(float((answer or {}).get(key)) - ref[key]) <= 0.01
        except (TypeError, ValueError):
            ok = False
        details.append({"name": key, "passed": ok, "error": None if ok else "qiymat noto‘g‘ri"})
    chosen = str((answer or {}).get("metric", "")).strip().lower()
    details.append({"name": "asosiy metrika tanlovi", "passed": chosen == ref["metric"],
                    "error": None if chosen == ref["metric"] else "metrika tanlovi senariyga mos emas"})
    # Choosing the right metric is the adaptation; it weighs as much as the three numbers together
    score = 50 * sum(d["passed"] for d in details[:3]) / 3 + 50 * details[3]["passed"]
    return round(score, 1), details


def _metrics_statement(p: Dict[str, Any]) -> str:
    return (
        f"Senariy: {p['scenario']} ({p['scenario_hint']}).\n"
        f"Test to‘plamidagi chalkashlik matritsasi: TP={p['tp']}, FP={p['fp']}, FN={p['fn']}, TN={p['tn']}.\n"
        "precision, recall va f1 qiymatlarini (3 xona aniqlikda) hisoblang va bu senariy uchun asosiy metrikani "
        "tanlang: \"precision\" yoki \"recall\". Accuracy nega bu yerda chalg‘itishini viva’da tushuntirasiz."
    )


# ---------------------------------------------------------------------------

def _build(template: str, rng: random.Random, seed: str, changed: bool) -> Variant:
    if template == "subnet_plan":
        public = _subnet_params(rng, changed)
        reference = _subnet_reference(public)
        return Variant(template, seed, _subnet_statement(public, changed), public, {"reference": reference}, "answer")
    if template == "business_rules":
        params = _rules_params(rng, changed)
        tests = _rules_tests(params, rng)
        public = {k: v for k, v in params.items()}
        statement = _rules_statement(params, changed)
        return Variant(template, seed, statement, public, {"tests": tests}, "code")
    if template == "imbalanced_metrics":
        params = _metrics_params(rng, changed)
        reference = _metrics_reference(params)
        public = {k: v for k, v in params.items() if not k.startswith("_")}
        return Variant(template, seed, _metrics_statement(params), public, {"reference": reference}, "answer")
    raise ValueError(f"unknown challenge template: {template}")


TEMPLATES = ("subnet_plan", "business_rules", "imbalanced_metrics")


def generate(template: str, seed: str, changed: bool = False) -> Variant:
    return _build(template, random.Random(seed), seed, changed)


def check_answer(variant_template: str, public: Dict[str, Any], private: Dict[str, Any], answer: Dict[str, Any]):
    """Server-side checker for "answer" variants. Returns (score 0..100, per-criterion details)."""
    if variant_template == "subnet_plan":
        return check_subnet_plan(public, answer)
    if variant_template == "imbalanced_metrics":
        return check_metrics(private, answer)
    raise ValueError(f"{variant_template} is not an answer-checked template")
