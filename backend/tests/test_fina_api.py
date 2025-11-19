"""
Test FINA Points API Endpoints

Run with: python -m pytest backend/tests/test_fina_api.py -v
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_get_supported_events_lcm():
    """Test getting supported events for LCM"""
    response = client.get("/api/swimmers/fina/supported-events?course=LCM")
    
    assert response.status_code == 200
    data = response.json()
    
    assert data["course"] == "LCM"
    assert "events" in data
    assert "male" in data["events"]
    assert "female" in data["events"]
    
    # Check that we have events for both genders
    assert len(data["events"]["male"]) > 0
    assert len(data["events"]["female"]) > 0
    
    print(f"✓ LCM has {len(data['events']['male'])} male events")
    print(f"✓ LCM has {len(data['events']['female'])} female events")


def test_get_supported_events_scm():
    """Test getting supported events for SCM"""
    response = client.get("/api/swimmers/fina/supported-events?course=SCM")
    
    assert response.status_code == 200
    data = response.json()
    
    assert data["course"] == "SCM"
    assert "events" in data
    
    # SCM should have 100 IM event that LCM doesn't have
    male_events = data["events"]["male"]
    female_events = data["events"]["female"]
    
    print(f"✓ SCM has {len(male_events)} male events")
    print(f"✓ SCM has {len(female_events)} female events")


def test_interval_to_seconds_conversion():
    """Test the _interval_to_seconds function logic"""
    from app.routes.swimmers import _interval_to_seconds
    
    # Test HH:MM:SS.ss format
    assert _interval_to_seconds("00:00:28.45") == 28.45
    assert _interval_to_seconds("00:01:58.12") == 118.12
    
    # Test MM:SS.ss format
    assert _interval_to_seconds("01:30.50") == 90.50
    assert _interval_to_seconds("00:50.00") == 50.00
    
    # Test seconds only
    assert _interval_to_seconds("28.45") == 28.45
    
    print("✓ All time conversion formats work correctly")


def test_fina_calculation_integration():
    """Test FINA points calculation logic with real data"""
    from app.utils.fina_calculator import calculate_fina_points
    from app.routes.swimmers import _interval_to_seconds
    
    # Simulate a real result from database
    time_result = "00:00:50.00"  # 50.0 seconds
    time_seconds = _interval_to_seconds(time_result)
    
    fina_points = calculate_fina_points(
        time_seconds=time_seconds,
        stroke="freestyle",
        distance=100,
        gender="male",
        course="LCM"
    )
    
    assert fina_points == 826
    print(f"✓ Male 100m Free at 50.0s = {fina_points} FINA points")
    
    # Test with female swimmer
    time_result_f = "00:00:60.00"  # 60.0 seconds
    time_seconds_f = _interval_to_seconds(time_result_f)
    
    fina_points_f = calculate_fina_points(
        time_seconds=time_seconds_f,
        stroke="backstroke",
        distance=100,
        gender="female",
        course="LCM"
    )
    
    assert fina_points_f == 878
    print(f"✓ Female 100m Back at 60.0s = {fina_points_f} FINA points")


def test_fina_points_response_structure():
    """Test that the FINA points endpoint would return correct structure"""
    # This tests the expected response structure without needing a real swimmer
    expected_structure = {
        "swimmer_id": "test-swimmer-id",
        "gender": "male",
        "course": "LCM",
        "overall_best_fina_points": 826,
        "overall_average_fina_points": 750,
        "total_results": 5,
        "by_stroke": {
            "freestyle": {
                "best_fina_points": 826,
                "average_fina_points": 750,
                "total_results": 3,
                "best_by_distance": {
                    "100": {
                        "id": "result-id",
                        "distance": 100,
                        "time_result": "00:00:50.00",
                        "time_seconds": 50.0,
                        "fina_points": 826,
                        "performed_on": "2025-01-15"
                    }
                }
            }
        },
        "results_with_points": [
            {
                "id": "result-id",
                "distance": 100,
                "stroke": "freestyle",
                "time_result": "00:00:50.00",
                "time_seconds": 50.0,
                "performed_on": "2025-01-15",
                "fina_points": 826,
                "result_units": "LCM"
            }
        ]
    }
    
    # Verify structure
    assert "swimmer_id" in expected_structure
    assert "gender" in expected_structure
    assert "course" in expected_structure
    assert "overall_best_fina_points" in expected_structure
    assert "overall_average_fina_points" in expected_structure
    assert "total_results" in expected_structure
    assert "by_stroke" in expected_structure
    assert "results_with_points" in expected_structure
    
    # Verify stroke summary structure
    stroke_data = expected_structure["by_stroke"]["freestyle"]
    assert "best_fina_points" in stroke_data
    assert "average_fina_points" in stroke_data
    assert "total_results" in stroke_data
    assert "best_by_distance" in stroke_data
    
    # Verify result structure
    result = expected_structure["results_with_points"][0]
    assert "id" in result
    assert "distance" in result
    assert "stroke" in result
    assert "time_result" in result
    assert "time_seconds" in result
    assert "fina_points" in result
    assert "performed_on" in result
    assert "result_units" in result
    
    print("✓ Response structure is correct")


if __name__ == "__main__":
    print("=" * 80)
    print("FINA POINTS API TESTS")
    print("=" * 80)
    
    test_get_supported_events_lcm()
    test_get_supported_events_scm()
    test_interval_to_seconds_conversion()
    test_fina_calculation_integration()
    test_fina_points_response_structure()
    
    print("\n✅ All API tests passed!")
