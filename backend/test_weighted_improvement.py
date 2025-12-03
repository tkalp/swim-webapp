"""Test weighted improvement calculation."""
import sys
sys.path.insert(0, '/z:/Source/swim_app_repos/aquilus-webapp/backend')

from app.services.performance_service import PerformanceService

# Test case 1: Improving swimmer (times decreasing)
print("=" * 60)
print("Test 1: Improving swimmer (65s -> 62s)")
timeline1 = [
    {'time': 65.0, 'date': '2024-01-01'},
    {'time': 64.5, 'date': '2024-02-01'},
    {'time': 63.8, 'date': '2024-03-01'},
    {'time': 63.2, 'date': '2024-04-01'},
    {'time': 62.5, 'date': '2024-05-01'},
    {'time': 62.0, 'date': '2024-06-01'},
]
first_time1 = 65.0
weighted_imp1 = PerformanceService.calculate_weighted_improvement(timeline1, first_time1)
avg_imp1 = ((62.0 - 65.0) / 65.0) * 100
print(f"First time: {first_time1}s")
print(f"Latest time: {timeline1[-1]['time']}s")
print(f"Average improvement: {avg_imp1:.2f}%")
print(f"Weighted improvement: {weighted_imp1}%")

# Test case 2: Regressing swimmer (times increasing)
print("\n" + "=" * 60)
print("Test 2: Regressing swimmer (60s -> 65s)")
timeline2 = [
    {'time': 60.0, 'date': '2024-01-01'},
    {'time': 61.5, 'date': '2024-02-01'},
    {'time': 62.8, 'date': '2024-03-01'},
    {'time': 63.5, 'date': '2024-04-01'},
    {'time': 64.2, 'date': '2024-05-01'},
    {'time': 65.0, 'date': '2024-06-01'},
]
first_time2 = 60.0
weighted_imp2 = PerformanceService.calculate_weighted_improvement(timeline2, first_time2)
avg_imp2 = ((65.0 - 60.0) / 60.0) * 100
print(f"First time: {first_time2}s")
print(f"Latest time: {timeline2[-1]['time']}s")
print(f"Average improvement: {avg_imp2:.2f}%")
print(f"Weighted improvement: {weighted_imp2}%")

# Test case 3: Erratic performance
print("\n" + "=" * 60)
print("Test 3: Erratic swimmer (varied times)")
timeline3 = [
    {'time': 65.0, 'date': '2024-01-01'},
    {'time': 63.0, 'date': '2024-02-01'},
    {'time': 67.0, 'date': '2024-03-01'},
    {'time': 62.0, 'date': '2024-04-01'},
    {'time': 66.0, 'date': '2024-05-01'},
    {'time': 64.0, 'date': '2024-06-01'},
]
first_time3 = 65.0
weighted_imp3 = PerformanceService.calculate_weighted_improvement(timeline3, first_time3)
avg_imp3 = ((64.0 - 65.0) / 65.0) * 100
print(f"First time: {first_time3}s")
print(f"Latest time: {timeline3[-1]['time']}s")
print(f"Average improvement: {avg_imp3:.2f}%")
print(f"Weighted improvement: {weighted_imp3}%")

# Test case 4: The problematic case (first time very fast, then slower)
print("\n" + "=" * 60)
print("Test 4: Fast start, then slower (possible +258% case)")
timeline4 = [
    {'time': 58.0, 'date': '2024-01-01'},  # Very fast baseline
    {'time': 75.0, 'date': '2024-02-01'},  # Much slower
    {'time': 73.0, 'date': '2024-03-01'},
    {'time': 72.0, 'date': '2024-04-01'},
    {'time': 71.0, 'date': '2024-05-01'},
]
first_time4 = 58.0
weighted_imp4 = PerformanceService.calculate_weighted_improvement(timeline4, first_time4)
avg_imp4 = ((71.0 - 58.0) / 58.0) * 100
print(f"First time: {first_time4}s")
print(f"Latest time: {timeline4[-1]['time']}s")
print(f"Average improvement: {avg_imp4:.2f}%")
print(f"Weighted improvement: {weighted_imp4}%")
print("(This case should show positive %, indicating regression from fast baseline)")
