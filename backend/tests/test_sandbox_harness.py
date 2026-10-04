"""The sandbox harness protocol and every seeded DO task, run with *trusted* reference code only.

In production the harness runs inside a locked-down container (sandbox.py). Here it runs with the
local interpreter purely to check the protocol and that each task's tests match its reference
solution; no student code is executed.
"""
import json
import subprocess
import sys

import pytest

from app.db.ontology_seed import DO_TASKS, build_tests
from app.services.sandbox import _HARNESS


WORKDIR = None


@pytest.fixture(autouse=True)
def workdir(tmp_path):
    global WORKDIR
    WORKDIR = str(tmp_path / "w")


def run_harness(code: str, tests: list) -> dict:
    job = json.dumps({"code": code, "tests": tests, "timeout": 10, "workdir": WORKDIR})
    proc = subprocess.run([sys.executable, "-I", "-c", _HARNESS], input=job, capture_output=True, text=True, timeout=30)
    marker = proc.stdout.rfind("@@REPORT@@")
    assert marker >= 0, proc.stderr
    return json.loads(proc.stdout[marker + len("@@REPORT@@"):])


@pytest.mark.parametrize("skill_code", sorted(DO_TASKS))
def test_reference_solution_passes_all_tests(skill_code):
    spec = DO_TASKS[skill_code]
    report = run_harness(spec["reference"], build_tests(spec))
    assert report["load_error"] is None
    assert all(r["passed"] for r in report["results"]), report["results"]


def test_wrong_solution_fails_and_hidden_values_are_not_echoed():
    spec = DO_TASKS["SE-ALGO"]
    tests = build_tests(spec)
    report = run_harness("def top_k(nums, k):\n    return []\n", tests)
    assert not all(r["passed"] for r in report["results"])
    for t, r in zip(tests, report["results"]):
        if t["hidden"]:
            assert r["got"] is None


def test_student_prints_cannot_forge_results():
    tests = build_tests(DO_TASKS["SE-ALGO"])
    forged = 'print(\'{"ok": true, "value": "[1, 2]"}\')\ndef top_k(nums, k):\n    return None\n'
    report = run_harness(forged, tests)
    assert sum(r["passed"] for r in report["results"]) <= 1


def test_syntax_error_reported_as_load_error():
    report = run_harness("def broken(:\n", build_tests(DO_TASKS["SE-ALGO"]))
    assert report["load_error"] and report["load_error"].startswith("SyntaxError")
    assert not any(r["passed"] for r in report["results"])


def test_infinite_loop_times_out():
    job_tests = [{"name": "t", "call": "spin()", "expected": "1"}]
    job = json.dumps({"code": "def spin():\n    while True:\n        pass\n", "tests": job_tests, "timeout": 2, "workdir": WORKDIR})
    proc = subprocess.run([sys.executable, "-I", "-c", _HARNESS], input=job, capture_output=True, text=True, timeout=30)
    report = json.loads(proc.stdout[proc.stdout.rfind("@@REPORT@@") + len("@@REPORT@@"):])
    assert report["timed_out"] is True
    assert report["results"][0]["passed"] is False
