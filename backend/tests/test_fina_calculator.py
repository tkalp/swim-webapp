"""
Test FINA Points Calculator

Comprehensive test suite to verify FINA points calculations are accurate
according to World Aquatics formula: Points = 1000 × (Base Time / Actual Time)³

Run with: python backend/tests/test_fina_calculator.py
"""

from app.utils.fina_calculator import (
    calculate_fina_points, 
    get_time_for_fina_points, 
    normalize_stroke_name,
    get_supported_events
)


def test_1_world_record_performance():
    """
    Test 1: World record performance should receive ~1000 points
    
    Base times are derived from world records, so swimming the base time
    should result in exactly 1000 points.
    """
    print("\nTest 1: World Record Performance")
    
    # Male 50m freestyle LCM base time = 20.91s (world record)
    points = calculate_fina_points(20.91, "freestyle", 50, "male", "LCM")
    assert points == 1000, f"Expected 1000 points for WR time, got {points}"
    print(f"  ✓ Male 50m Free WR (20.91s) = {points} points")
    
    # Female 100m backstroke LCM base time = 57.13s (2025 base time)
    points = calculate_fina_points(57.13, "backstroke", 100, "female", "LCM")
    assert points == 1000, f"Expected 1000 points for WR time, got {points}"
    print(f"  ✓ Female 100m Back WR (57.13s) = {points} points")
    
    # Male 200m IM LCM base time = 114.00s (2025 base time)
    points = calculate_fina_points(114.00, "individual medley", 200, "male", "LCM")
    assert points == 1000, f"Expected 1000 points for WR time, got {points}"
    print(f"  ✓ Male 200m IM WR (114.00s) = {points} points")


def test_2_olympic_qualifying_times():
    """
    Test 2: Verify points for typical Olympic qualifying standard times
    
    Olympic qualifying times typically range from 800-900 FINA points.
    """
    print("\nTest 2: Olympic Qualifying Times")
    
    # Male 100m freestyle - typical Olympic qualifying ~48.5s (new base: 46.40s)
    points = calculate_fina_points(48.5, "freestyle", 100, "male", "LCM")
    assert 870 <= points <= 920, f"Expected ~895 points for Olympic qualifier, got {points}"
    print(f"  ✓ Male 100m Free Olympic qualifier (48.5s) = {points} points")
    
    # Female 200m butterfly - typical Olympic qualifying ~2:08.0 (new base: 121.81s)
    points = calculate_fina_points(128.0, "butterfly", 200, "female", "LCM")
    assert 840 <= points <= 890, f"Expected ~865 points for Olympic qualifier, got {points}"
    print(f"  ✓ Female 200m Fly Olympic qualifier (2:08.0) = {points} points")


def test_3_national_level_performance():
    """
    Test 3: Verify points for national-level competitive times
    
    National level times typically range from 650-800 FINA points.
    """
    print("\nTest 3: National Level Performance")
    
    # Male 50m freestyle - strong national level ~22.5s
    points = calculate_fina_points(22.5, "freestyle", 50, "male", "LCM")
    assert 750 <= points <= 850, f"Expected ~800 points for national level, got {points}"
    print(f"  ✓ Male 50m Free national level (22.5s) = {points} points")
    
    # Female 100m breaststroke - national level ~1:09.0
    points = calculate_fina_points(69.0, "breaststroke", 100, "female", "LCM")
    assert 750 <= points <= 850, f"Expected ~800 points for national level, got {points}"
    print(f"  ✓ Female 100m Breast national level (1:09.0) = {points} points")


def test_4_age_group_competitive():
    """
    Test 4: Verify points for competitive age group swimmers
    
    Competitive age group times typically range from 450-650 FINA points.
    """
    print("\nTest 4: Age Group Competitive")
    
    # Male 100m freestyle - competitive age group ~55.0s
    points = calculate_fina_points(55.0, "freestyle", 100, "male", "LCM")
    assert 550 <= points <= 650, f"Expected ~600 points for age group, got {points}"
    print(f"  ✓ Male 100m Free age group (55.0s) = {points} points")
    
    # Female 50m backstroke - competitive age group ~32.0s
    points = calculate_fina_points(32.0, "backstroke", 50, "female", "LCM")
    assert 500 <= points <= 600, f"Expected ~550 points for age group, got {points}"
    print(f"  ✓ Female 50m Back age group (32.0s) = {points} points")


def test_5_recreational_swimmer():
    """
    Test 5: Verify points for recreational/beginner swimmers
    
    Recreational times typically range from 200-450 FINA points.
    """
    print("\nTest 5: Recreational Swimmer")
    
    # Male 50m freestyle - recreational ~30.0s
    points = calculate_fina_points(30.0, "freestyle", 50, "male", "LCM")
    assert 300 <= points <= 450, f"Expected ~375 points for recreational, got {points}"
    print(f"  ✓ Male 50m Free recreational (30.0s) = {points} points")
    
    # Female 100m freestyle - recreational ~1:15.0
    points = calculate_fina_points(75.0, "freestyle", 100, "female", "LCM")
    assert 250 <= points <= 400, f"Expected ~335 points for recreational, got {points}"
    print(f"  ✓ Female 100m Free recreational (1:15.0) = {points} points")


def test_6_scm_vs_lcm_comparison():
    """
    Test 6: Verify SCM vs LCM point differences
    
    For slower times, SCM gives FEWER points than LCM because SCM WRs are faster.
    For the same time, being further from a faster WR means lower points.
    """
    print("\nTest 6: SCM vs LCM Comparison")
    
    # Test with a slower time where LCM gives more points
    # 50.0s is 3.33s slower than LCM WR (46.67) vs 5.61s slower than SCM WR (44.39)
    lcm_points = calculate_fina_points(50.0, "freestyle", 100, "male", "LCM")
    scm_points = calculate_fina_points(50.0, "freestyle", 100, "male", "SCM")
    
    assert lcm_points > scm_points, f"LCM points ({lcm_points}) should be higher than SCM ({scm_points}) for this time"
    print(f"  ✓ Male 100m Free at 50.0s:")
    print(f"    LCM = {lcm_points} points (WR is 46.67s)")
    print(f"    SCM = {scm_points} points (WR is 44.39s)")
    print(f"    LCM gives more points because 50.0s is closer to LCM WR")
    
    # Test with a fast time near WR where SCM gives more points
    # For elite times close to WR, SCM can give more points
    lcm_elite = calculate_fina_points(58.0, "backstroke", 100, "female", "LCM")  # Close to 57.45 WR
    scm_elite = calculate_fina_points(55.0, "backstroke", 100, "female", "SCM")  # Close to 54.27 WR
    
    print(f"  ✓ Elite times comparison:")
    print(f"    Female 100m Back LCM 58.0s = {lcm_elite} points")
    print(f"    Female 100m Back SCM 55.0s = {scm_elite} points")


def test_7_stroke_name_variations():
    """
    Test 7: Verify stroke name normalization works correctly
    
    Different stroke name formats should all calculate correctly.
    """
    print("\nTest 7: Stroke Name Variations")
    
    # Test different variations of "individual medley"
    time = 125.0
    im_points = calculate_fina_points(time, "individual medley", 200, "male", "LCM")
    medley_points = calculate_fina_points(time, "medley", 200, "male", "LCM")
    im_abbrev_points = calculate_fina_points(time, "IM", 200, "male", "LCM")
    
    assert im_points == medley_points == im_abbrev_points, "All IM variations should give same points"
    print(f"  ✓ 'individual medley', 'medley', 'IM' all = {im_points} points")
    
    # Test freestyle variations
    free_points = calculate_fina_points(50.0, "freestyle", 100, "male", "LCM")
    free_abbrev_points = calculate_fina_points(50.0, "free", 100, "male", "LCM")
    
    assert free_points == free_abbrev_points, "Freestyle variations should give same points"
    print(f"  ✓ 'freestyle' and 'free' both = {free_points} points")
    
    # Test butterfly variations
    fly_points = calculate_fina_points(55.0, "butterfly", 100, "female", "LCM")
    fly_abbrev_points = calculate_fina_points(55.0, "fly", 100, "female", "LCM")
    
    assert fly_points == fly_abbrev_points, "Butterfly variations should give same points"
    print(f"  ✓ 'butterfly' and 'fly' both = {fly_points} points")


def test_8_long_distance_events():
    """
    Test 8: Verify calculations for long distance events (800m, 1500m)
    
    Test the longer freestyle events with appropriate times.
    """
    print("\nTest 8: Long Distance Events")
    
    # Male 1500m freestyle - competitive time ~15:00.0
    points = calculate_fina_points(900.0, "freestyle", 1500, "male", "LCM")
    assert 850 <= points <= 950, f"Expected ~900 points for competitive 1500m, got {points}"
    print(f"  ✓ Male 1500m Free competitive (15:00.0) = {points} points")
    
    # Female 800m freestyle - competitive time ~8:45.0
    points = calculate_fina_points(525.0, "freestyle", 800, "female", "LCM")
    assert 750 <= points <= 850, f"Expected ~820 points for competitive 800m, got {points}"
    print(f"  ✓ Female 800m Free competitive (8:45.0) = {points} points")
    
    # Male 800m freestyle - age group time ~9:00.0
    points = calculate_fina_points(540.0, "freestyle", 800, "male", "LCM")
    assert 550 <= points <= 650, f"Expected ~590 points for age group 800m, got {points}"
    print(f"  ✓ Male 800m Free age group (9:00.0) = {points} points")


def test_9_reverse_calculation():
    """
    Test 9: Verify reverse calculation (time needed for target points)
    
    Calculate what time is needed to achieve specific point targets.
    """
    print("\nTest 9: Reverse Calculation")
    
    # What time needed for 800 points in male 100m freestyle?
    target_points = 800
    required_time = get_time_for_fina_points(target_points, "freestyle", 100, "male", "LCM")
    
    # Verify by calculating points for that time
    actual_points = calculate_fina_points(required_time, "freestyle", 100, "male", "LCM")
    assert abs(actual_points - target_points) <= 1, f"Expected {target_points}, got {actual_points}"
    print(f"  ✓ For {target_points} points in M 100 Free: need {required_time:.2f}s (gives {actual_points} points)")
    
    # What time needed for 700 points in female 200m butterfly?
    target_points = 700
    required_time = get_time_for_fina_points(target_points, "butterfly", 200, "female", "LCM")
    actual_points = calculate_fina_points(required_time, "butterfly", 200, "female", "LCM")
    assert abs(actual_points - target_points) <= 1, f"Expected {target_points}, got {actual_points}"
    print(f"  ✓ For {target_points} points in F 200 Fly: need {required_time:.2f}s (gives {actual_points} points)")
    
    # What time needed for 900 points in male 200m IM?
    target_points = 900
    required_time = get_time_for_fina_points(target_points, "IM", 200, "male", "LCM")
    actual_points = calculate_fina_points(required_time, "IM", 200, "male", "LCM")
    assert abs(actual_points - target_points) <= 1, f"Expected {target_points}, got {actual_points}"
    print(f"  ✓ For {target_points} points in M 200 IM: need {required_time:.2f}s (gives {actual_points} points)")


def test_10_boundary_conditions():
    """
    Test 10: Verify boundary conditions and edge cases
    
    Test minimum points (100), maximum points (1100), invalid inputs, etc.
    """
    print("\nTest 10: Boundary Conditions")
    
    # Very slow time should cap at 100 points
    points = calculate_fina_points(300.0, "freestyle", 50, "male", "LCM")
    assert points == 100, f"Very slow time should cap at 100 points, got {points}"
    print(f"  ✓ Very slow time (300s for 50m) caps at {points} points")
    
    # Impossibly fast time should cap at 1100 points
    points = calculate_fina_points(10.0, "freestyle", 50, "male", "LCM")
    assert points == 1100, f"Impossibly fast time should cap at 1100 points, got {points}"
    print(f"  ✓ Impossibly fast time (10s for 50m) caps at {points} points")
    
    # Invalid gender should return None
    points = calculate_fina_points(50.0, "freestyle", 100, "unknown", "LCM")
    assert points is None, f"Invalid gender should return None, got {points}"
    print(f"  ✓ Invalid gender returns None")
    
    # Invalid course should return None
    points = calculate_fina_points(50.0, "freestyle", 100, "male", "INVALID")
    assert points is None, f"Invalid course should return None, got {points}"
    print(f"  ✓ Invalid course returns None")
    
    # Invalid distance should return None (75m doesn't exist)
    points = calculate_fina_points(40.0, "freestyle", 75, "male", "LCM")
    assert points is None, f"Invalid distance should return None, got {points}"
    print(f"  ✓ Invalid distance (75m) returns None")
    
    # Negative time should return None
    points = calculate_fina_points(-50.0, "freestyle", 100, "male", "LCM")
    assert points is None, f"Negative time should return None, got {points}"
    print(f"  ✓ Negative time returns None")
    
    # Zero time should return None
    points = calculate_fina_points(0.0, "freestyle", 100, "male", "LCM")
    assert points is None, f"Zero time should return None, got {points}"
    print(f"  ✓ Zero time returns None")


def run_all_tests():
    """Run all test functions"""
    print("=" * 80)
    print("FINA POINTS CALCULATOR - COMPREHENSIVE TEST SUITE")
    print("=" * 80)
    print("\nFormula: Points = 1000 × (Base Time / Actual Time)³")
    print("Base Times = World Records approved by World Aquatics")
    print("=" * 80)
    
    tests = [
        test_1_world_record_performance,
        test_2_olympic_qualifying_times,
        test_3_national_level_performance,
        test_4_age_group_competitive,
        test_5_recreational_swimmer,
        test_6_scm_vs_lcm_comparison,
        test_7_stroke_name_variations,
        test_8_long_distance_events,
        test_9_reverse_calculation,
        test_10_boundary_conditions,
    ]
    
    passed = 0
    failed = 0
    
    for test_func in tests:
        try:
            test_func()
            passed += 1
        except AssertionError as e:
            print(f"\n❌ FAILED: {test_func.__name__}")
            print(f"   Error: {str(e)}")
            failed += 1
        except Exception as e:
            print(f"\n❌ ERROR: {test_func.__name__}")
            print(f"   Error: {str(e)}")
            failed += 1
    
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    print(f"Total tests: {len(tests)}")
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    
    if failed == 0:
        print("\n🎉 All tests passed! FINA calculator is working correctly.")
    else:
        print(f"\n⚠️  {failed} test(s) failed. Please review the errors above.")
    
    return failed == 0
if __name__ == "__main__":
    success = run_all_tests()
    exit(0 if success else 1)
