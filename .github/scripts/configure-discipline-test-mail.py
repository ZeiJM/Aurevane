"""Keep local confirmation email enabled on an available test-runner web port."""

from pathlib import Path
import os
import socket
import tomllib


def configure_mail(config_path: Path) -> int:
    original = config_path.read_text()
    config = tomllib.loads(original)
    if "local_smtp" in config or "inbucket" in config:
        raise ValueError("Review the existing local mail configuration before overriding it.")
    for _ in range(16):
        with socket.socket() as listener:
            listener.bind(("0.0.0.0", 0))
            port = listener.getsockname()[1]
        # The other Supabase services have not started yet. Leave their default
        # ports available as well as avoiding services already on this runner.
        if not 54320 <= port <= 54330:
            break
    else:
        raise RuntimeError("Could not select a local mail web port.")
    config_path.write_text(original + f"\n[local_smtp]\nenabled = true\nport = {port}\n")
    return port


if __name__ == "__main__":
    port = configure_mail(Path("supabase/config.toml"))
    # The CLI's local_smtp port replaces the default mail-capture web port.
    # Later Actions steps must use that same endpoint for recovery email reads.
    if environment_path := os.environ.get("GITHUB_ENV"):
        with Path(environment_path).open("a") as environment:
            environment.write(f"INBUCKET_URL=http://127.0.0.1:{port}\n")
