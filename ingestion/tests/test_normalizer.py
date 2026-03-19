"""Tests for the workout normalizer."""

from ingestion.models import RawWorkout
from ingestion.normalizer import normalize


class TestBasicWorkout:
    """Normal input produces NormalizedWorkout with correct document format."""

    def test_produces_normalized_workout(self) -> None:
        raw = RawWorkout(
            title="Morning Sprint Set",
            text="8x50 Free on :45",
            source="scraped",
        )
        result = normalize(raw)
        assert result is not None
        assert result.title == "Morning Sprint Set"
        assert result.text == "8x50 Free on :45"
        assert result.document == "Title: Morning Sprint Set\nWorkout:\n8x50 Free on :45"
        assert result.source == "scraped"


class TestStripsHtml:
    """HTML tags are removed, text content preserved."""

    def test_strips_basic_html(self) -> None:
        raw = RawWorkout(
            title="HTML Workout",
            text="<p>8x50 <b>Free</b></p>",
            source="scraped",
        )
        result = normalize(raw)
        assert result is not None
        assert result.text == "8x50 Free"

    def test_strips_nested_html(self) -> None:
        raw = RawWorkout(
            title="Nested",
            text="<div><p>4x100 <em>Back</em> @1:30</p></div>",
            source="scraped",
        )
        result = normalize(raw)
        assert result is not None
        assert "4x100 Back @1:30" in result.text

    def test_no_html_passes_through(self) -> None:
        raw = RawWorkout(
            title="Plain",
            text="10x100 Free on 1:20",
            source="curated",
        )
        result = normalize(raw)
        assert result is not None
        assert result.text == "10x100 Free on 1:20"


class TestStandardizesNotation:
    """Stroke names and set notation are standardized."""

    def test_freestyle_to_free(self) -> None:
        raw = RawWorkout(title="T", text="4 × 100 Freestyle @1:30", source="s")
        result = normalize(raw)
        assert result is not None
        assert "4x100 Free @1:30" in result.text

    def test_backstroke_to_back(self) -> None:
        raw = RawWorkout(title="T", text="8x50 backstroke", source="s")
        result = normalize(raw)
        assert result is not None
        assert "8x50 Back" in result.text

    def test_breaststroke_to_breast(self) -> None:
        raw = RawWorkout(title="T", text="4x200 Breaststroke", source="s")
        result = normalize(raw)
        assert result is not None
        assert "4x200 Breast" in result.text

    def test_butterfly_to_fly(self) -> None:
        raw = RawWorkout(title="T", text="8x50 butterfly", source="s")
        result = normalize(raw)
        assert result is not None
        assert "8x50 Fly" in result.text

    def test_individual_medley_to_im(self) -> None:
        raw = RawWorkout(title="T", text="4x100 Individual Medley", source="s")
        result = normalize(raw)
        assert result is not None
        assert "4x100 IM" in result.text

    def test_collapses_spaces_around_x(self) -> None:
        raw = RawWorkout(title="T", text="4 x 100 Free", source="s")
        result = normalize(raw)
        assert result is not None
        assert "4x100 Free" in result.text

    def test_collapses_spaces_around_multiplication_sign(self) -> None:
        raw = RawWorkout(title="T", text="8 × 50 Free", source="s")
        result = normalize(raw)
        assert result is not None
        assert "8x50 Free" in result.text


class TestPreservesSourceFields:
    """Source metadata fields pass through unchanged."""

    def test_all_source_fields_preserved(self) -> None:
        raw = RawWorkout(
            title="Distance Day",
            text="1x800 Free steady",
            source="curated",
            source_url="https://example.com/workout/42",
            source_name="SwimWorkouts.net",
            coach_notes="Good for endurance block",
        )
        result = normalize(raw)
        assert result is not None
        assert result.source == "curated"
        assert result.source_url == "https://example.com/workout/42"
        assert result.source_name == "SwimWorkouts.net"
        assert result.coach_notes == "Good for endurance block"


class TestEmptyTextReturnsNone:
    """Empty text after processing returns None."""

    def test_empty_string(self) -> None:
        raw = RawWorkout(title="Empty", text="", source="s")
        result = normalize(raw)
        assert result is None


class TestWhitespaceOnlyReturnsNone:
    """Whitespace-only text returns None."""

    def test_spaces_only(self) -> None:
        raw = RawWorkout(title="Blank", text="   ", source="s")
        result = normalize(raw)
        assert result is None

    def test_newlines_only(self) -> None:
        raw = RawWorkout(title="Blank", text="\n\n\n", source="s")
        result = normalize(raw)
        assert result is None

    def test_html_with_only_whitespace_inside(self) -> None:
        raw = RawWorkout(title="Blank", text="<p>   </p>", source="s")
        result = normalize(raw)
        assert result is None
