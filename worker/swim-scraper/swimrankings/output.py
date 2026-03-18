"""Dual-stream output: table to stderr, JSON to stdout.

Every CLI command calls render() to produce both human-readable
and machine-parseable output simultaneously.
"""

import json
import sys


def _format_table(data, headers: list[str] | None = None) -> str:
    """Format a list of dicts as an aligned text table."""
    if not data:
        return ""

    if isinstance(data, dict):
        lines = []
        max_key = max(len(str(k)) for k in data) if data else 0
        for k, v in data.items():
            lines.append(f"  {str(k):<{max_key}}  {v}")
        return "\n".join(lines)

    if headers is None:
        headers = list(data[0].keys())

    widths = {h: len(h) for h in headers}
    for row in data:
        for h in headers:
            val = str(row.get(h, ""))
            widths[h] = max(widths[h], len(val))

    header_line = "  ".join(f"{h:<{widths[h]}}" for h in headers)
    separator = "  ".join("-" * widths[h] for h in headers)

    lines = [header_line, separator]
    for row in data:
        line = "  ".join(f"{str(row.get(h, '')):<{widths[h]}}" for h in headers)
        lines.append(line)

    return "\n".join(lines)


def render(
    data: list[dict] | dict,
    headers: list[str] | None = None,
    quiet: bool = False,
    no_json: bool = False,
    output: str | None = None,
    file_stderr=None,
    file_stdout=None,
):
    """Write table to stderr and JSON to stdout.

    Args:
        data: Structured data to output.
        headers: Column headers for the table. If None, derived from dict keys.
        quiet: If True, suppress the stderr table.
        no_json: If True, suppress the stdout JSON.
        output: If set, write JSON to this file path instead of stdout.
        file_stderr: Override stderr stream (for testing).
        file_stdout: Override stdout stream (for testing).
    """
    err = file_stderr if file_stderr is not None else sys.stderr
    out = file_stdout if file_stdout is not None else sys.stdout

    if not quiet:
        table = _format_table(data, headers)
        if table:
            print(table, file=err)

    if not no_json:
        json_str = json.dumps(data, indent=2, ensure_ascii=False)
        if output:
            with open(output, "w", encoding="utf-8") as f:
                f.write(json_str)
        else:
            print(json_str, file=out)
