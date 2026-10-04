"""ADAPT generator: reproducible, unique per student, always solvable (section 5.3)."""
import ipaddress

import pytest

from app.services import challenges
from app.services.challenges import check_answer, derive_seed, generate


@pytest.mark.parametrize("template", challenges.TEMPLATES)
def test_same_seed_gives_same_variant(template):
    seed = derive_seed("user-1", "task-1", 1)
    assert generate(template, seed).public == generate(template, seed).public


@pytest.mark.parametrize("template", challenges.TEMPLATES)
def test_students_get_different_variants(template):
    checksums = {generate(template, derive_seed(f"user-{i}", "task-1", 1)).checksum for i in range(20)}
    assert len(checksums) >= 18


def test_subnet_reference_plan_passes_checker():
    for i in range(30):
        for changed in (False, True):
            v = generate("subnet_plan", derive_seed(f"u{i}", "t", 1), changed)
            score, details = check_answer(v.template, v.public, v.private, v.private["reference"])
            assert score == 100, details


def test_subnet_checker_rejects_bad_plans():
    v = generate("subnet_plan", derive_seed("u", "t", 1))
    names = list(v.public["hosts"])
    base = ipaddress.ip_network(v.public["base"])
    # Same tiny subnet for everyone: too small and overlapping
    tiny = str(next(base.subnets(new_prefix=30)))
    score, details = check_answer(v.template, v.public, v.private, {n: tiny for n in names})
    assert score < 100
    assert any(not d["passed"] for d in details)
    # Garbage input never crashes
    score, _ = check_answer(v.template, v.public, v.private, {names[0]: "not-a-cidr"})
    assert score < 100


def test_changed_condition_doubles_hosts_and_adds_branch():
    seed = derive_seed("u", "t", 1)
    base_v, changed_v = generate("subnet_plan", seed), generate("subnet_plan", seed, changed=True)
    assert "Yangi filial" in changed_v.public["hosts"]
    for name, hosts in base_v.public["hosts"].items():
        assert changed_v.public["hosts"][name] == hosts * 2


def test_metrics_reference_scores_full_and_wrong_metric_loses_half():
    v = generate("imbalanced_metrics", derive_seed("u", "t", 1))
    ref = v.private["reference"]
    assert check_answer(v.template, v.public, v.private, ref)[0] == 100
    wrong_metric = dict(ref, metric="precision" if ref["metric"] == "recall" else "recall")
    assert check_answer(v.template, v.public, v.private, wrong_metric)[0] == 50
    # The reference metric must never leak into what the student sees
    assert "_metric" not in v.public and "metric" not in v.public


def test_business_rules_tests_match_reference_solver():
    v = generate("business_rules", derive_seed("u", "t", 1), changed=True)
    p = v.public
    for t in v.private["tests"]:
        sub, vip = eval(t["call"], {"order_total": lambda s, v: (s, v)})  # parse the probe args
        assert eval(t["expected"]) == challenges._rules_total(p, sub, vip)
    # Hidden tests exist so the visible ones can't simply be hard-coded
    assert any(t["hidden"] for t in v.private["tests"])
