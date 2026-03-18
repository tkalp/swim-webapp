"""Unit tests for the dual-stream output system."""

import json
from io import StringIO

from swimrankings.output import render


class TestRenderTable:
    def test_table_written_to_stderr(self):
        data = [{"name": "Alice", "age": "30"}, {"name": "Bob", "age": "25"}]
        stderr = StringIO()
        stdout = StringIO()
        render(data, file_stderr=stderr, file_stdout=stdout)
        table_output = stderr.getvalue()
        assert "Alice" in table_output
        assert "Bob" in table_output
        assert "name" in table_output

    def test_json_written_to_stdout(self):
        data = [{"name": "Alice", "age": "30"}]
        stderr = StringIO()
        stdout = StringIO()
        render(data, file_stderr=stderr, file_stdout=stdout)
        parsed = json.loads(stdout.getvalue())
        assert parsed == [{"name": "Alice", "age": "30"}]

    def test_quiet_suppresses_stderr(self):
        data = [{"name": "Alice"}]
        stderr = StringIO()
        stdout = StringIO()
        render(data, quiet=True, file_stderr=stderr, file_stdout=stdout)
        assert stderr.getvalue() == ""
        assert json.loads(stdout.getvalue()) == [{"name": "Alice"}]

    def test_no_json_suppresses_stdout(self):
        data = [{"name": "Alice"}]
        stderr = StringIO()
        stdout = StringIO()
        render(data, no_json=True, file_stderr=stderr, file_stdout=stdout)
        assert "Alice" in stderr.getvalue()
        assert stdout.getvalue() == ""

    def test_output_to_file(self, tmp_path):
        data = [{"name": "Alice"}]
        stderr = StringIO()
        stdout = StringIO()
        outfile = str(tmp_path / "out.json")
        render(data, output=outfile, file_stderr=stderr, file_stdout=stdout)
        assert stdout.getvalue() == ""
        with open(outfile) as f:
            parsed = json.load(f)
        assert parsed == [{"name": "Alice"}]

    def test_custom_headers(self):
        data = [{"name": "Alice", "age": "30"}]
        stderr = StringIO()
        stdout = StringIO()
        render(data, headers=["name"], file_stderr=stderr, file_stdout=stdout)
        table = stderr.getvalue()
        assert "name" in table
        assert "age" not in table

    def test_dict_data_not_list(self):
        data = {"total": 5, "status": "ok"}
        stderr = StringIO()
        stdout = StringIO()
        render(data, file_stderr=stderr, file_stdout=stdout)
        parsed = json.loads(stdout.getvalue())
        assert parsed == {"total": 5, "status": "ok"}

    def test_empty_list(self):
        stderr = StringIO()
        stdout = StringIO()
        render([], file_stderr=stderr, file_stdout=stdout)
        assert json.loads(stdout.getvalue()) == []
