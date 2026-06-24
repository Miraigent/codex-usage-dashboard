#!/usr/bin/env python3
import json
import os
import pty
import re
import select
import subprocess
import sys
import time


def main() -> int:
    if len(sys.argv) != 4:
        print(json.dumps({"ok": False, "error": "usage: codex-device-code.py <account-id> <codex-command> <codex-home>"}))
        return 2

    account_id, codex_command, codex_home = sys.argv[1:4]
    env = os.environ.copy()
    env["CODEX_HOME"] = codex_home
    os.makedirs(codex_home, mode=0o700, exist_ok=True)

    subprocess.run([codex_command, "logout"], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=10)

    pid, master_fd = pty.fork()
    if pid == 0:
        os.environ.update(env)
        os.execv(codex_command, [codex_command, "login", "--device-auth"])

    output = ""
    deadline = time.time() + 15
    code_re = re.compile(r"(?<![A-Z0-9])[A-Z0-9]{4,5}-[A-Z0-9]{4,5}(?![A-Z0-9])")
    url = "https://auth.openai.com/codex/device"

    try:
        while time.time() < deadline:
            ready, _, _ = select.select([master_fd], [], [], 0.2)
            if not ready:
                try:
                    finished_pid, _ = os.waitpid(pid, os.WNOHANG)
                except ChildProcessError:
                    finished_pid = pid
                if finished_pid:
                    break
                continue
            try:
                chunk = os.read(master_fd, 4096).decode("utf-8", "replace")
            except OSError:
                break
            output += chunk
            match = code_re.search(output)
            if match:
                try:
                    os.kill(pid, 15)
                except ProcessLookupError:
                    pass
                print(json.dumps({
                    "ok": True,
                    "account": account_id,
                    "url": url,
                    "code": match.group(0),
                    "expiresInMinutes": 15,
                }))
                return 0
    finally:
        try:
            os.close(master_fd)
        except OSError:
            pass
        try:
            os.kill(pid, 15)
        except ProcessLookupError:
            pass

    print(json.dumps({"ok": False, "account": account_id, "error": "login code generation timed out"}))
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
