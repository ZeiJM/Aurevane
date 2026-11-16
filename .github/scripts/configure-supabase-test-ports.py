"""Select available host ports for one disposable Supabase browser-test stack."""

from pathlib import Path
import os
import re
import socket
import tomllib


PORT_FIELDS = (
    ("api", "port", "api"),
    ("db", "port", "db"),
    ("db", "shadow_port", "shadow"),
)


def _reserve_ports(count: int) -> tuple[list[socket.socket], list[int]]:
    listeners: list[socket.socket] = []
    ports: list[int] = []
    try:
        while len(ports) < count:
            listener = socket.socket()
            listener.bind(("0.0.0.0", 0))
            listener.listen()
            port = listener.getsockname()[1]
            if 54320 <= port <= 54330 or port in ports:
                listener.close()
                continue
            listeners.append(listener)
            ports.append(port)
        return listeners, ports
    except Exception:
        for listener in listeners:
            listener.close()
        raise


def configure_ports(config_path: Path) -> dict[str, int]:
    original = config_path.read_text()
    # Validate before reserving ports or changing any bytes.
    config = tomllib.loads(original)
    for section, key, _ in PORT_FIELDS:
        if not isinstance(config.get(section, {}).get(key), int):
            raise ValueError(f"Expected integer [{section}] {key} in {config_path}.")

    listeners, ports = _reserve_ports(len(PORT_FIELDS))
    configured = {name: port for (_, _, name), port in zip(PORT_FIELDS, ports, strict=True)}
    replacements = {
        (section, key): configured[name] for section, key, name in PORT_FIELDS
    }
    counts = {field: 0 for field in replacements}
    current_section = ""
    updated: list[str] = []
    try:
        for line in original.splitlines(keepends=True):
            if table := re.match(r"^\s*\[([^]]+)]\s*(?:#.*)?(?:\r?\n)?$", line):
                current_section = table.group(1)
            replacement = None
            for (section, key), port in replacements.items():
                if current_section != section:
                    continue
                match = re.match(
                    rf"^(\s*{re.escape(key)}\s*=\s*)\d+(\s*(?:#.*)?(?:\r?\n)?)$",
                    line,
                )
                if match:
                    replacement = f"{match.group(1)}{port}{match.group(2)}"
                    counts[(section, key)] += 1
                    break
            updated.append(replacement if replacement is not None else line)
        if any(count != 1 for count in counts.values()):
            raise ValueError(f"Expected one assignment for each disposable port: {counts}.")
        config_path.write_text("".join(updated))
        return configured
    finally:
        for listener in listeners:
            listener.close()


if __name__ == "__main__":
    selected = configure_ports(Path("supabase/config.toml"))
    if environment_path := os.environ.get("GITHUB_ENV"):
        with Path(environment_path).open("a") as environment:
            environment.write(
                f"SUPABASE_TEST_API_URL=http://127.0.0.1:{selected['api']}\n"
            )
