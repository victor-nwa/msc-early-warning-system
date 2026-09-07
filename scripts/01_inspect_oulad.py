from pathlib import Path
import pandas as pd

RAW_DIR = Path("data/raw/oulad")
REPORTS_DIR = Path("outputs/reports/oulad")
REPORTS_DIR.mkdir(parents=True, exist_ok=True)

expected_files = [
    "courses.csv",
    "assessments.csv",
    "vle.csv",
    "studentInfo.csv",
    "studentRegistration.csv",
    "studentAssessment.csv",
    "studentVle.csv",
]

print("=" * 80)
print("OULAD DATASET INSPECTION")
print("=" * 80)

found_files = []

for file_name in expected_files:
    matches = list(RAW_DIR.rglob(file_name))

    if not matches:
        print(f"\nMISSING: {file_name}")
        continue

    path = matches[0]
    found_files.append(path)

    print("\n" + "=" * 80)
    print(file_name)
    print("=" * 80)
    print("Path:", path)

    df = pd.read_csv(path)

    print("Shape:", df.shape)
    print("Columns:")
    print(df.columns.tolist())

    print("\nFirst 5 rows:")
    print(df.head())

    print("\nMissing values:")
    print(df.isna().sum())

    summary_path = REPORTS_DIR / f"{file_name.replace('.csv', '')}_summary.txt"
    with open(summary_path, "w", encoding="utf-8") as f:
        f.write(f"File: {file_name}\n")
        f.write(f"Path: {path}\n")
        f.write(f"Shape: {df.shape}\n\n")
        f.write("Columns:\n")
        f.write(str(df.columns.tolist()))
        f.write("\n\nMissing values:\n")
        f.write(df.isna().sum().to_string())
        f.write("\n\nFirst 5 rows:\n")
        f.write(df.head().to_string())

print("\n" + "=" * 80)
print("FOUND FILES")
print("=" * 80)

for path in found_files:
    print("-", path)

print("\nInspection complete.")
print("Saved summaries to:", REPORTS_DIR)
