"""Unit tests for meet HTML parsers."""

from swimrankings.parsers import parse_meet_list, parse_meet_details, parse_meet_results
from swimrankings.models import Meet


class TestParseMeetList:
    def test_normal(self):
        html = '<a href="?page=meetDetail&meetId=100">Summer Champs</a><a href="?page=meetDetail&meetId=200">Winter Open</a>'
        result = parse_meet_list(html)
        assert len(result) == 2
        assert result[0] == Meet(id="100", name="Summer Champs")

    def test_deduplication(self):
        html = '<a href="?meetId=100">Summer Champs</a><a href="?meetId=100">Summer Champs</a>'
        result = parse_meet_list(html)
        assert len(result) == 1

    def test_empty_html(self):
        assert parse_meet_list("") == []


class TestParseMeetResults:
    def test_empty_html(self):
        assert parse_meet_results("") == []

    def test_no_result_rows(self):
        html = "<html><body>No results table</body></html>"
        assert parse_meet_results(html) == []


class TestParseMeetDetails:
    def test_empty_html(self):
        result = parse_meet_details("")
        assert result == {"date": "", "city": "", "nation": "", "course": ""}

    def test_lcm_detection(self):
        html = '<div>Pool: Long Course</div>'
        result = parse_meet_details(html)
        assert result["course"] == "LCM"

    def test_scm_detection(self):
        html = '<div>Pool: Short Course 25m</div>'
        result = parse_meet_details(html)
        assert result["course"] == "SCM"

    def test_nation_from_flag(self):
        html = '<img class="flag" alt="GBR" />'
        result = parse_meet_details(html)
        assert result["nation"] == "GBR"
