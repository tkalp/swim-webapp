from swimrankings.models import Stroke, Athlete, RaceResult, Meet, AthleteHistory, parse_time


class TestStrokeEnum:
    def test_stroke_values_exist(self):
        assert Stroke.FREESTYLE.value == "Freestyle"
        assert Stroke.BACKSTROKE.value == "Backstroke"
        assert Stroke.BREASTSTROKE.value == "Breaststroke"
        assert Stroke.BUTTERFLY.value == "Butterfly"
        assert Stroke.MEDLEY.value == "Medley"
        assert Stroke.UNKNOWN.value == "Unknown"

    def test_from_event_freestyle(self):
        assert Stroke.from_event("100m Freestyle") == Stroke.FREESTYLE
        assert Stroke.from_event("50m Freestyle Lap") == Stroke.FREESTYLE
        assert Stroke.from_event("200m Free") == Stroke.FREESTYLE

    def test_from_event_backstroke(self):
        assert Stroke.from_event("100m Backstroke") == Stroke.BACKSTROKE
        assert Stroke.from_event("50m Backstroke Lap") == Stroke.BACKSTROKE
        assert Stroke.from_event("200m Back") == Stroke.BACKSTROKE

    def test_from_event_breaststroke(self):
        assert Stroke.from_event("100m Breaststroke") == Stroke.BREASTSTROKE
        assert Stroke.from_event("50m Breaststroke Lap") == Stroke.BREASTSTROKE
        assert Stroke.from_event("200m Breast") == Stroke.BREASTSTROKE

    def test_from_event_butterfly(self):
        assert Stroke.from_event("100m Butterfly") == Stroke.BUTTERFLY
        assert Stroke.from_event("50m Butterfly Lap") == Stroke.BUTTERFLY
        assert Stroke.from_event("200m Fly") == Stroke.BUTTERFLY

    def test_from_event_medley(self):
        assert Stroke.from_event("200m Medley") == Stroke.MEDLEY
        assert Stroke.from_event("400m IM") == Stroke.MEDLEY

    def test_from_event_unknown(self):
        assert Stroke.from_event("some random event") == Stroke.UNKNOWN


class TestAthlete:
    def test_creation(self):
        a = Athlete(id="123", name="John Doe")
        assert a.id == "123"
        assert a.name == "John Doe"

    def test_to_dict(self):
        a = Athlete(id="123", name="John Doe")
        d = a.to_dict()
        assert d["id"] == "123"
        assert d["name"] == "John Doe"
        assert d["nation"] == ""


class TestRaceResult:
    def test_auto_stroke_derivation(self):
        r = RaceResult(event="100m Breaststroke", course="LCM", time="1:05.00")
        assert r.stroke == Stroke.BREASTSTROKE

    def test_explicit_stroke(self):
        r = RaceResult(event="100m Breaststroke", course="LCM", time="1:05.00", stroke=Stroke.FREESTYLE)
        assert r.stroke == Stroke.FREESTYLE

    def test_to_dict_serializes_stroke_as_string(self):
        r = RaceResult(event="100m Breaststroke", course="LCM", time="1:05.00")
        d = r.to_dict()
        assert d["stroke"] == "Breaststroke"
        assert isinstance(d["stroke"], str)


class TestMeet:
    def test_creation(self):
        m = Meet(id="456", name="Summer Champs")
        assert m.id == "456"
        assert m.name == "Summer Champs"

    def test_to_dict(self):
        m = Meet(id="456", name="Summer Champs")
        d = m.to_dict()
        assert d["id"] == "456"
        assert d["name"] == "Summer Champs"
        assert d["date"] == ""


class TestAthleteHistory:
    def test_total_results(self):
        results = [
            RaceResult(event="100m Freestyle", course="LCM", time="0:50.00"),
            RaceResult(event="200m Backstroke", course="SCM", time="2:10.00"),
        ]
        h = AthleteHistory(
            athlete_id="123",
            athlete_name="John Doe",
            events=["100m Freestyle", "200m Backstroke"],
            seasons=["2024", "2025"],
            results=results,
        )
        assert h.total_results == 2

    def test_to_dict(self):
        results = [RaceResult(event="50m Butterfly", course="LCM", time="0:25.00")]
        h = AthleteHistory(
            athlete_id="1",
            athlete_name="Jane",
            events=["50m Butterfly"],
            seasons=["2025"],
            results=results,
        )
        d = h.to_dict()
        assert d["athlete_id"] == "1"
        assert len(d["results"]) == 1
        assert d["results"][0]["stroke"] == "Butterfly"


class TestAthleteEnhanced:
    def test_creation_with_all_fields(self):
        a = Athlete(id="123", name="John", nation="GBR", year_of_birth="1994", gender="M", club="City of Derby")
        assert a.nation == "GBR"
        assert a.year_of_birth == "1994"
        assert a.gender == "M"
        assert a.club == "City of Derby"

    def test_defaults_are_empty_strings(self):
        a = Athlete(id="1", name="X")
        assert a.nation == ""
        assert a.year_of_birth == ""
        assert a.gender == ""
        assert a.club == ""

    def test_to_dict_includes_all_fields(self):
        a = Athlete(id="1", name="X", nation="USA", year_of_birth="2000", gender="F", club="Gators")
        d = a.to_dict()
        assert d == {"id": "1", "name": "X", "nation": "USA", "year_of_birth": "2000", "gender": "F", "club": "Gators"}

    def test_to_dict_backward_compat_minimal(self):
        a = Athlete(id="1", name="X")
        d = a.to_dict()
        assert d["id"] == "1"
        assert d["name"] == "X"
        assert d["nation"] == ""


class TestMeetEnhanced:
    def test_creation_with_all_fields(self):
        m = Meet(id="1", name="Worlds", date="21 Jul 2019", city="Gwangju (KOR)", nation="KOR", course="LCM")
        assert m.date == "21 Jul 2019"
        assert m.city == "Gwangju (KOR)"
        assert m.nation == "KOR"
        assert m.course == "LCM"

    def test_defaults_are_empty_strings(self):
        m = Meet(id="1", name="X")
        assert m.date == ""
        assert m.city == ""

    def test_to_dict_includes_all_fields(self):
        m = Meet(id="1", name="X", date="1 Jan 2025", city="Paris", nation="FRA", course="LCM")
        d = m.to_dict()
        assert d == {"id": "1", "name": "X", "date": "1 Jan 2025", "city": "Paris", "nation": "FRA", "course": "LCM"}


class TestParseTime:
    def test_seconds_only(self):
        assert parse_time("25.95") == 25.95

    def test_minutes_seconds(self):
        assert parse_time("1:06.29") == 66.29

    def test_minutes_seconds_leading_zero(self):
        assert parse_time("0:59.99") == 59.99

    def test_hours_minutes_seconds(self):
        assert parse_time("1:02:03.45") == 3723.45

    def test_whole_seconds(self):
        assert parse_time("30") == 30.0

    def test_invalid_returns_inf(self):
        import math
        assert math.isinf(parse_time("DNF"))
        assert math.isinf(parse_time(""))


class TestStrokeHardened:
    def test_im_does_not_match_swimming(self):
        assert Stroke.from_event("Swimming Event") == Stroke.UNKNOWN

    def test_im_does_not_match_timer(self):
        assert Stroke.from_event("Timer Results") == Stroke.UNKNOWN

    def test_im_matches_standalone(self):
        assert Stroke.from_event("400m IM") == Stroke.MEDLEY

    def test_back_does_not_match_setback(self):
        assert Stroke.from_event("Setback Race") == Stroke.UNKNOWN

    def test_free_does_not_match_carefree(self):
        assert Stroke.from_event("Carefree Event") == Stroke.UNKNOWN

    def test_fly_does_not_match_mayfly(self):
        assert Stroke.from_event("Mayfly Cup") == Stroke.UNKNOWN

    def test_standard_events_still_work(self):
        assert Stroke.from_event("100m Freestyle") == Stroke.FREESTYLE
        assert Stroke.from_event("200m Backstroke") == Stroke.BACKSTROKE
        assert Stroke.from_event("50m Breaststroke") == Stroke.BREASTSTROKE
        assert Stroke.from_event("100m Butterfly") == Stroke.BUTTERFLY
        assert Stroke.from_event("200m Medley") == Stroke.MEDLEY

    def test_short_names_still_work(self):
        assert Stroke.from_event("200m Free") == Stroke.FREESTYLE
        assert Stroke.from_event("100m Back") == Stroke.BACKSTROKE
        assert Stroke.from_event("50m Breast") == Stroke.BREASTSTROKE
        assert Stroke.from_event("200m Fly") == Stroke.BUTTERFLY


from swimrankings.models import MeetResult, Ranking, QualificationStandard, Comparison, ComparisonRow

class TestMeetResult:
    def test_creation(self):
        r = MeetResult(rank="1", athlete_name="PEATY, Adam", athlete_id="4636962",
                       nation="GBR", time="56.88", points="1000", event="100m Breaststroke", gender="M")
        assert r.rank == "1"
        assert r.athlete_id == "4636962"

    def test_to_dict(self):
        r = MeetResult(rank="1", athlete_name="X", athlete_id="1",
                       nation="GBR", time="56.88", points="1000", event="100m Breast", gender="M")
        d = r.to_dict()
        assert d["rank"] == "1"
        assert d["athlete_id"] == "1"
        assert d["time"] == "56.88"


class TestRanking:
    def test_creation(self):
        a = Athlete(id="1", name="X", nation="GBR")
        r = Ranking(rank="1", athlete=a, time="56.88", points="1000", meet="Worlds", date="21 Jul 2019")
        assert r.rank == "1"
        assert r.athlete.name == "X"

    def test_to_dict_flattens_athlete(self):
        a = Athlete(id="1", name="X", nation="GBR")
        r = Ranking(rank="1", athlete=a, time="56.88", points="1000", meet="Worlds", date="21 Jul 2019")
        d = r.to_dict()
        assert d["athlete_id"] == "1"
        assert d["athlete_name"] == "X"
        assert d["athlete_nation"] == "GBR"
        assert "athlete" not in d


class TestQualificationStandard:
    def test_creation(self):
        q = QualificationStandard(name="OQT2028", event="100m Breaststroke", course="LCM", gender="M", cut_time="59.04")
        assert q.cut_time == "59.04"

    def test_to_dict(self):
        q = QualificationStandard(name="OQT2028", event="100m Breaststroke", course="LCM", gender="M", cut_time="59.04")
        d = q.to_dict()
        assert d["cut_time"] == "59.04"
        assert d["name"] == "OQT2028"


class TestComparison:
    def test_creation(self):
        a = Athlete(id="1", name="A")
        b = Athlete(id="2", name="B")
        row = ComparisonRow(event="100m Free", course="LCM", time_a="50.00", time_b="51.00",
                            points_a="800", points_b="780", diff="-1.00")
        c = Comparison(athlete_a=a, athlete_b=b, events=[row])
        assert len(c.events) == 1
        assert c.events[0].diff == "-1.00"

    def test_to_dict(self):
        a = Athlete(id="1", name="A")
        b = Athlete(id="2", name="B")
        row = ComparisonRow(event="100m Free", course="LCM", time_a="50.00", time_b="51.00",
                            points_a="800", points_b="780", diff="-1.00")
        c = Comparison(athlete_a=a, athlete_b=b, events=[row])
        d = c.to_dict()
        assert d["athlete_a"]["id"] == "1"
        assert d["athlete_b"]["id"] == "2"
        assert d["events"][0]["diff"] == "-1.00"
