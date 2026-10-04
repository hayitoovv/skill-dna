"""Isolated code execution for DO/ADAPT tasks (section 5.5).

Student code never runs inside the API process. Each run gets a fresh container with no
network, a read-only root filesystem, a small tmpfs, dropped capabilities, an unprivileged
user and CPU/memory/pid/time limits.

Inside the container a trusted harness receives the code and the test calls on stdin (nothing
is written to a shared volume). The harness writes the student code to tmpfs and runs it in a
*separate* child process that only ever sees the call expressions; expected values stay in the
harness, so student code cannot read or forge them. The container prints one JSON report.
"""
import asyncio
import json
import logging
import shutil
import subprocess
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

# Trusted harness; runs as PID 1's child inside the container.
_HARNESS = r'''
import ast, json, os, subprocess, sys
job = json.loads(sys.stdin.read())
W = job.get("workdir", "/tmp/w")
os.makedirs(W, exist_ok=True)
with open(os.path.join(W, "solution.py"), "w") as f:
    f.write(job["code"])
child_src = (
    "import os, sys, json\n"
    "W = sys.argv[1]\n"
    "sys.path.insert(0, W)\n"
    "ns = {}\n"
    "try:\n"
    "    exec(compile(open(os.path.join(W, 'solution.py')).read(), 'solution.py', 'exec'), ns)\n"
    "except BaseException as e:\n"
    "    print(json.dumps({'load_error': type(e).__name__ + ': ' + str(e)[:300]}), flush=True); sys.exit(0)\n"
    "for line in sys.stdin:\n"
    "    call = json.loads(line)\n"
    "    try:\n"
    "        out = {'ok': True, 'value': repr(eval(call, ns))}\n"
    "    except BaseException as e:\n"
    "        out = {'ok': False, 'error': type(e).__name__ + ': ' + str(e)[:300]}\n"
    "    print(json.dumps(out), flush=True)\n"
)
with open(os.path.join(W, "child.py"), "w") as f:
    f.write(child_src)
calls = "".join(json.dumps(t["call"]) + "\n" for t in job["tests"])
try:
    proc = subprocess.run([sys.executable, "-I", os.path.join(W, "child.py"), W], input=calls, capture_output=True,
                          text=True, timeout=job["timeout"])
    lines = [l for l in proc.stdout.splitlines() if l.strip()]
    timed_out = False
except subprocess.TimeoutExpired as e:
    lines = [l for l in (e.stdout or "").splitlines() if l.strip()] if isinstance(e.stdout, str) else []
    timed_out = True
report = {"results": [], "load_error": None, "timed_out": timed_out}
parsed = []
for l in lines:
    try:
        parsed.append(json.loads(l))
    except ValueError:
        pass  # student prints are ignored
if parsed and "load_error" in parsed[0]:
    report["load_error"] = parsed[0]["load_error"]
    parsed = []
# Keep only the protocol lines (dicts with "ok"); student output cannot contain the expected values
answers = [p for p in parsed if isinstance(p, dict) and "ok" in p]
for i, t in enumerate(job["tests"]):
    a = answers[i] if i < len(answers) else None
    passed, got, err = False, None, None
    if a is None:
        err = "timeout" if timed_out else "no result"
    elif not a["ok"]:
        err = a["error"]
    else:
        got = a["value"]
        try:
            passed = ast.literal_eval(got) == ast.literal_eval(t["expected"])
        except (ValueError, SyntaxError):
            passed = got == t["expected"]
    report["results"].append({"name": t["name"], "passed": passed, "got": None if t.get("hidden") else got, "error": err})
print("@@REPORT@@" + json.dumps(report))
'''


@dataclass
class SandboxReport:
    status: str  # "ok" | "unavailable" | "error"
    passed: int = 0
    total: int = 0
    results: List[Dict[str, Any]] = field(default_factory=list)
    load_error: Optional[str] = None
    timed_out: bool = False
    message: str = ""

    @property
    def score(self) -> float:
        return round(100 * self.passed / self.total, 1) if self.total else 0.0

    def as_dict(self) -> Dict[str, Any]:
        return {
            "status": self.status,
            "passed": self.passed,
            "total": self.total,
            "results": self.results,
            "load_error": self.load_error,
            "timed_out": self.timed_out,
            "message": self.message,
        }


def docker_available() -> bool:
    if not settings.SANDBOX_ENABLED or not shutil.which(settings.SANDBOX_DOCKER_BIN):
        return False
    try:
        probe = subprocess.run([settings.SANDBOX_DOCKER_BIN, "info", "--format", "{{.ServerVersion}}"],
                               capture_output=True, text=True, timeout=5)
        return probe.returncode == 0
    except (OSError, subprocess.TimeoutExpired):
        return False


def _docker_cmd(name: str) -> List[str]:
    return [
        settings.SANDBOX_DOCKER_BIN, "run", "--rm", "-i",
        "--name", name,
        "--network", "none",
        "--read-only",
        "--tmpfs", "/tmp:rw,noexec,nosuid,size=16m",
        "--memory", f"{settings.SANDBOX_MEMORY_MB}m",
        "--memory-swap", f"{settings.SANDBOX_MEMORY_MB}m",
        "--cpus", "0.5",
        "--pids-limit", "64",
        "--cap-drop", "ALL",
        "--security-opt", "no-new-privileges",
        "--user", "65534:65534",
        settings.SANDBOX_PYTHON_IMAGE,
        "python", "-I", "-c", _HARNESS,
    ]


def _run_blocking(code: str, tests: List[Dict[str, Any]]) -> SandboxReport:
    name = f"skilldna-sbx-{uuid.uuid4().hex[:12]}"
    job = json.dumps({"code": code, "tests": tests, "timeout": settings.SANDBOX_TIMEOUT_SECONDS})
    try:
        proc = subprocess.run(_docker_cmd(name), input=job, capture_output=True, text=True,
                              timeout=settings.SANDBOX_TIMEOUT_SECONDS + 20)
    except subprocess.TimeoutExpired:
        subprocess.run([settings.SANDBOX_DOCKER_BIN, "kill", name], capture_output=True)
        return SandboxReport(status="ok", total=len(tests), timed_out=True, message="Vaqt chegarasi oshdi",
                             results=[{"name": t["name"], "passed": False, "got": None, "error": "timeout"} for t in tests])
    except OSError as e:
        return SandboxReport(status="unavailable", message=str(e))

    marker = proc.stdout.rfind("@@REPORT@@")
    if marker < 0:
        logger.warning("Sandbox produced no report (rc=%s): %s", proc.returncode, proc.stderr[-500:])
        return SandboxReport(status="error", total=len(tests), message="Sandbox hisobot qaytarmadi")
    report = json.loads(proc.stdout[marker + len("@@REPORT@@"):].strip())
    results = report["results"]
    return SandboxReport(
        status="ok",
        passed=sum(1 for r in results if r["passed"]),
        total=len(results),
        results=results,
        load_error=report.get("load_error"),
        timed_out=report.get("timed_out", False),
    )


async def run_python(code: str, tests: List[Dict[str, Any]]) -> SandboxReport:
    """Runs `code` against `tests` ([{name, call, expected, hidden?}]) in an isolated container."""
    if not tests:
        return SandboxReport(status="error", message="Topshiriqda avtotestlar yo‘q")
    if not await asyncio.to_thread(docker_available):
        return SandboxReport(
            status="unavailable", total=len(tests),
            message="Kod sandbox’i hozir mavjud emas; yechim saqlandi va sandbox ishga tushgach baholanadi.",
        )
    return await asyncio.to_thread(_run_blocking, code, tests)
