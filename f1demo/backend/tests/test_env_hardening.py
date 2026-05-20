import os
import subprocess
import sys
from pathlib import Path


def test_production_boot_requires_internal_secret(tmp_path):
    repo_root = Path(__file__).resolve().parents[2]
    env = os.environ.copy()
    env.pop("INTERNAL_SECRET", None)
    env["APP_ENV"] = "production"
    env["ALLOWED_ORIGINS"] = "https://example.com"
    code = (
        "import sys; "
        f"sys.path.insert(0, {repr(str(repo_root / 'backend'))}); "
        "import main"
    )
    proc = subprocess.run([sys.executable, "-c", code], cwd=repo_root, env=env, capture_output=True, text=True)
    assert proc.returncode != 0
    assert "INTERNAL_SECRET must be set in production" in (proc.stderr + proc.stdout)
