"""Unit tests for swimrankings.parsers — pure HTML parsing functions."""

from swimrankings.parsers import (
    parse_athlete_search_results,
    parse_event_list,
    parse_season_list,
    parse_event_history,
    parse_meet_list,
    parse_athlete_name,
)
from swimrankings.models import Athlete, Meet, RaceResult, Stroke


# ---------------------------------------------------------------------------
# parse_athlete_search_results
# ---------------------------------------------------------------------------

class TestParseAthleteSearchResults:
    def test_normal(self):
        html = """
        <table>
          <tr><td><a href="index.php?page=athleteDetail&athleteId=12345">John Smith</a></td></tr>
          <tr><td><a href="index.php?page=athleteDetail&athleteId=67890">Jane Doe</a></td></tr>
        </table>
        """
        result = parse_athlete_search_results(html)
        assert len(result) == 2
        assert result[0] == Athlete(id="12345", name="John Smith")
        assert result[1] == Athlete(id="67890", name="Jane Doe")

    def test_deduplication(self):
        html = """
        <a href="?athleteId=111">Alice</a>
        <a href="?athleteId=111">Alice</a>
        <a href="?athleteId=222">Bob</a>
        """
        result = parse_athlete_search_results(html)
        assert len(result) == 2
        assert result[0].id == "111"
        assert result[1].id == "222"

    def test_empty_html(self):
        assert parse_athlete_search_results("") == []

    def test_no_matches(self):
        html = "<html><body>No athletes here</body></html>"
        assert parse_athlete_search_results(html) == []


# ---------------------------------------------------------------------------
# parse_event_list
# ---------------------------------------------------------------------------

class TestParseEventList:
    def test_normal(self):
        html = """
        <select name="rankingStyleId">
          <option value="0">Select...</option>
          <option value="15">100 Freestyle</option>
          <option value="22">200 Backstroke</option>
        </select>
        """
        result = parse_event_list(html)
        assert len(result) == 2
        assert result[0] == {"style_id": "15", "name": "100 Freestyle"}
        assert result[1] == {"style_id": "22", "name": "200 Backstroke"}

    def test_skips_placeholder_zero(self):
        html = """
        <select name="rankingStyleId">
          <option value="0">-- Pick one --</option>
          <option value="5">50 Butterfly</option>
        </select>
        """
        result = parse_event_list(html)
        assert len(result) == 1
        assert result[0]["style_id"] == "5"

    def test_no_dropdown(self):
        html = "<html><body>No dropdown</body></html>"
        assert parse_event_list(html) == []

    def test_empty_html(self):
        assert parse_event_list("") == []


# ---------------------------------------------------------------------------
# parse_season_list
# ---------------------------------------------------------------------------

class TestParseSeasonList:
    def test_normal_sorted_descending(self):
        html = """
        <select name="resultSeason">
          <option value="2021">2021</option>
          <option value="2023">2023</option>
          <option value="2022">2022</option>
        </select>
        """
        result = parse_season_list(html)
        assert result == ["2023", "2022", "2021"]

    def test_no_dropdown(self):
        assert parse_season_list("<html></html>") == []

    def test_empty_html(self):
        assert parse_season_list("") == []


# ---------------------------------------------------------------------------
# parse_event_history
# ---------------------------------------------------------------------------

class TestParseEventHistory:
    HISTORY_HTML = """
    <h3>Long Course (50m)</h3>
    <table>
      <tr class="athleteRanking1">
        <td class="time">24.50</td>
        <td class="code">750</td>
        <td class="date">12/01/2023</td>
        <td class="city"><a title="World Champs 2023">Budapest</a></td>
      </tr>
      <tr class="athleteRanking2">
        <td class="time">24.80</td>
        <td class="code">720</td>
        <td class="date">06/15/2023</td>
        <td class="city">Rome</td>
      </tr>
    </table>
    <h3>Short Course (25m)</h3>
    <table>
      <tr class="athleteRanking1">
        <td class="time">23.90</td>
        <td class="code">800</td>
        <td class="date">11/20/2023</td>
        <td class="city"><a title="SC Worlds 2023">Melbourne</a></td>
      </tr>
    </table>
    """

    def test_both_lcm_and_scm(self):
        results = parse_event_history(self.HISTORY_HTML, "50 Freestyle")
        lcm = [r for r in results if r.course == "LCM"]
        scm = [r for r in results if r.course == "SCM"]
        assert len(lcm) == 2
        assert len(scm) == 1

    def test_lcm_fields(self):
        results = parse_event_history(self.HISTORY_HTML, "50 Freestyle")
        first = results[0]
        assert first.event == "50 Freestyle"
        assert first.course == "LCM"
        assert first.time == "24.50"
        assert first.points == "750"
        assert first.date == "12/01/2023"
        assert first.city == "Budapest"
        assert first.meet == "World Champs 2023"

    def test_scm_fields(self):
        results = parse_event_history(self.HISTORY_HTML, "50 Freestyle")
        scm = [r for r in results if r.course == "SCM"][0]
        assert scm.course == "SCM"
        assert scm.time == "23.90"
        assert scm.meet == "SC Worlds 2023"

    def test_stroke_auto_detected(self):
        results = parse_event_history(self.HISTORY_HTML, "50 Freestyle")
        assert all(r.stroke == Stroke.FREESTYLE for r in results)

    def test_city_without_meet_title(self):
        results = parse_event_history(self.HISTORY_HTML, "50 Freestyle")
        # Second LCM row has no title attribute
        second_lcm = [r for r in results if r.course == "LCM"][1]
        assert second_lcm.city == "Rome"
        assert second_lcm.meet == ""

    def test_no_sections(self):
        html = "<html><body>No course sections</body></html>"
        assert parse_event_history(html, "100 Backstroke") == []

    def test_empty_html(self):
        assert parse_event_history("", "100 Fly") == []

    def test_only_lcm(self):
        html = """
        <h3>Long Course (50m)</h3>
        <table>
          <tr class="athleteRanking1">
            <td class="time">1:02.30</td>
            <td class="code">600</td>
            <td class="date">03/01/2024</td>
            <td class="city">Paris</td>
          </tr>
        </table>
        """
        results = parse_event_history(html, "100 Breaststroke")
        assert len(results) == 1
        assert results[0].course == "LCM"
        assert results[0].stroke == Stroke.BREASTSTROKE


# ---------------------------------------------------------------------------
# parse_meet_list
# ---------------------------------------------------------------------------

class TestParseMeetList:
    def test_normal(self):
        html = """
        <a href="?page=meetDetail&meetId=100">Summer Champs</a>
        <a href="?page=meetDetail&meetId=200">Winter Open</a>
        """
        result = parse_meet_list(html)
        assert len(result) == 2
        assert result[0] == Meet(id="100", name="Summer Champs")
        assert result[1] == Meet(id="200", name="Winter Open")

    def test_deduplication(self):
        html = """
        <a href="?meetId=100">Summer Champs</a>
        <a href="?meetId=100">Summer Champs</a>
        <a href="?meetId=200">Winter Open</a>
        """
        result = parse_meet_list(html)
        assert len(result) == 2

    def test_empty_html(self):
        assert parse_meet_list("") == []

    def test_no_matches(self):
        html = "<html><body>Nothing</body></html>"
        assert parse_meet_list(html) == []


# ---------------------------------------------------------------------------
# parse_athlete_name
# ---------------------------------------------------------------------------

class TestParseAthleteName:
    def test_normal(self):
        html = '<div id="name">Michael Phelps</div>'
        assert parse_athlete_name(html) == "Michael Phelps"

    def test_with_whitespace(self):
        html = '<div id="name">  Katie Ledecky  </div>'
        assert parse_athlete_name(html) == "Katie Ledecky"

    def test_missing(self):
        html = "<html><body>No name div</body></html>"
        assert parse_athlete_name(html) == ""

    def test_empty_html(self):
        assert parse_athlete_name("") == ""

from swimrankings.parsers import parse_athlete_details, resolve_style_id
from swimrankings.exceptions import EventNotFoundError
import pytest


class TestParseAthleteDetails:
    def test_nation_from_flag(self):
        html = '<img class="flag" alt="GBR" src="flags/gbr.png" />'
        result = parse_athlete_details(html)
        assert result["nation"] == "GBR"

    def test_nation_from_link(self):
        html = '<a href="?nationId=44">GBR</a>'
        result = parse_athlete_details(html)
        assert result["nation"] == "GBR"

    def test_gender_male(self):
        html = '<div>Gender: Male</div>'
        result = parse_athlete_details(html)
        assert result["gender"] == "M"

    def test_gender_female(self):
        html = '<div>Women</div>'
        result = parse_athlete_details(html)
        assert result["gender"] == "F"

    def test_club_from_link(self):
        html = '<a href="?clubId=123">City of Derby SC</a>'
        result = parse_athlete_details(html)
        assert result["club"] == "City of Derby SC"

    def test_year_of_birth(self):
        html = '<div>Born: 1994</div>'
        result = parse_athlete_details(html)
        assert result["year_of_birth"] == "1994"

    def test_empty_html(self):
        result = parse_athlete_details("")
        assert result == {"nation": "", "year_of_birth": "", "gender": "", "club": ""}


class TestResolveStyleId:
    EVENTS = [
        {"style_id": "15", "name": "100m Freestyle"},
        {"style_id": "22", "name": "200m Backstroke"},
        {"style_id": "30", "name": "100m Breaststroke"},
        {"style_id": "31", "name": "200m Breaststroke"},
    ]

    def test_exact_match(self):
        result = resolve_style_id(self.EVENTS, "100m Freestyle")
        assert result["style_id"] == "15"

    def test_substring_match(self):
        result = resolve_style_id(self.EVENTS, "Breast")
        assert result["style_id"] == "30"

    def test_case_insensitive(self):
        result = resolve_style_id(self.EVENTS, "100m freestyle")
        assert result["style_id"] == "15"

    def test_no_match_raises(self):
        with pytest.raises(EventNotFoundError) as exc_info:
            resolve_style_id(self.EVENTS, "Butterfly")
        assert "Butterfly" in str(exc_info.value)

    def test_empty_events_raises(self):
        with pytest.raises(EventNotFoundError):
            resolve_style_id([], "anything")
