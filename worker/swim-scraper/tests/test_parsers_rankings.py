"""Unit tests for rankings HTML parser."""

from swimrankings.parsers import parse_rankings_page


class TestParseRankingsPage:
    def test_empty_html(self):
        assert parse_rankings_page("") == []

    def test_no_ranking_rows(self):
        html = "<html><body>No rankings here</body></html>"
        assert parse_rankings_page(html) == []
