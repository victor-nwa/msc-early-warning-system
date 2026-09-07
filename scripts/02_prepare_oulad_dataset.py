from pathlib import Path
import json
import numpy as np
import pandas as pd

RAW_DIR = Path("data/raw/oulad")
PROCESSED_DIR = Path("data/processed/oulad")
REPORTS_DIR = Path("outputs/reports/oulad")

PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
REPORTS_DIR.mkdir(parents=True, exist_ok=True)

EARLY_CUTOFF_DAY = 90
CHUNK_SIZE = 500_000

KEYS = ["code_module", "code_presentation", "id_student"]


def find_file(filename: str) -> Path:
    matches = list(RAW_DIR.rglob(filename))
    if not matches:
        raise FileNotFoundError(f"Could not find {filename} under {RAW_DIR}")
    return matches[0]


def clean_question_marks(df: pd.DataFrame) -> pd.DataFrame:
    return df.replace("?", pd.NA)


def to_numeric(series: pd.Series):
    return pd.to_numeric(series, errors="coerce")


print("=" * 80)
print("OULAD DATASET PREPARATION")
print("=" * 80)

courses_path = find_file("courses.csv")
assessments_path = find_file("assessments.csv")
student_info_path = find_file("studentInfo.csv")
registration_path = find_file("studentRegistration.csv")
student_assessment_path = find_file("studentAssessment.csv")
student_vle_path = find_file("studentVle.csv")

print("Loading core tables...")

courses = clean_question_marks(pd.read_csv(courses_path))
assessments = clean_question_marks(pd.read_csv(assessments_path))
student_info = clean_question_marks(pd.read_csv(student_info_path))
registration = clean_question_marks(pd.read_csv(registration_path))
student_assessment = clean_question_marks(pd.read_csv(student_assessment_path))

print("courses:", courses.shape)
print("assessments:", assessments.shape)
print("student_info:", student_info.shape)
print("registration:", registration.shape)
print("student_assessment:", student_assessment.shape)

# ---------------------------------------------------------------------
# 1. Base student table
# ---------------------------------------------------------------------

base = student_info.copy()

base["student_record_key"] = (
    base["code_module"].astype(str)
    + "_"
    + base["code_presentation"].astype(str)
    + "_"
    + base["id_student"].astype(str)
)

# Target definition:
# Fail or Withdrawn are treated as At Risk.
# Pass or Distinction are treated as Not At Risk.
base["risk_label"] = base["final_result"].isin(["Fail", "Withdrawn"]).astype(int)
base["risk_status"] = base["risk_label"].map({1: "At Risk", 0: "Not At Risk"})

# Keep readable risk outcome group.
base["final_result_group"] = base["final_result"].map({
    "Fail": "At Risk Outcome",
    "Withdrawn": "At Risk Outcome",
    "Pass": "Successful Outcome",
    "Distinction": "Successful Outcome",
})

# Fill categorical missing values with Unknown.
categorical_cols = [
    "gender",
    "region",
    "highest_education",
    "imd_band",
    "age_band",
    "disability",
]
for col in categorical_cols:
    base[col] = base[col].fillna("Unknown")

# ---------------------------------------------------------------------
# 2. Add course information
# ---------------------------------------------------------------------

courses["module_presentation_length"] = to_numeric(courses["module_presentation_length"])

base = base.merge(
    courses,
    on=["code_module", "code_presentation"],
    how="left",
)

# ---------------------------------------------------------------------
# 3. Add registration features
# ---------------------------------------------------------------------

registration["date_registration"] = to_numeric(registration["date_registration"])
registration["date_unregistration"] = to_numeric(registration["date_unregistration"])

registration_features = registration[KEYS + ["date_registration"]].copy()
registration_features["registered_before_start"] = (
    registration_features["date_registration"] < 0
).astype(int)

# Important:
# We deliberately do not use date_unregistration as a model feature because it
# directly relates to withdrawal and would create leakage for early prediction.

base = base.merge(registration_features, on=KEYS, how="left")

# ---------------------------------------------------------------------
# 4. Create early assessment features
# ---------------------------------------------------------------------

print("\nCreating early assessment features...")

assessments["date"] = to_numeric(assessments["date"])
assessments["weight"] = to_numeric(assessments["weight"])

early_assessments = assessments[
    (assessments["date"].notna()) &
    (assessments["date"] <= EARLY_CUTOFF_DAY)
].copy()

expected_assessments = (
    early_assessments
    .groupby(["code_module", "code_presentation"])
    .agg(
        early_expected_assessments=("id_assessment", "count"),
        early_expected_weight=("weight", "sum"),
    )
    .reset_index()
)

student_assessment["date_submitted"] = to_numeric(student_assessment["date_submitted"])
student_assessment["is_banked"] = to_numeric(student_assessment["is_banked"]).fillna(0)
student_assessment["score"] = to_numeric(student_assessment["score"])

assessment_joined = student_assessment.merge(
    early_assessments[
        [
            "code_module",
            "code_presentation",
            "id_assessment",
            "assessment_type",
            "date",
            "weight",
        ]
    ],
    on="id_assessment",
    how="inner",
)

# Keep assessment submissions known by the early cutoff day.
assessment_joined = assessment_joined[
    assessment_joined["date_submitted"] <= EARLY_CUTOFF_DAY
].copy()

assessment_joined["submitted_late"] = (
    assessment_joined["date_submitted"] > assessment_joined["date"]
).astype(int)

assessment_joined["weighted_score_component"] = (
    assessment_joined["score"].fillna(0) * assessment_joined["weight"].fillna(0)
) / 100

assessment_features = (
    assessment_joined
    .groupby(KEYS)
    .agg(
        early_assessments_submitted=("id_assessment", "count"),
        early_avg_score=("score", "mean"),
        early_min_score=("score", "min"),
        early_max_score=("score", "max"),
        early_late_submissions=("submitted_late", "sum"),
        early_banked_assessments=("is_banked", "sum"),
        early_weighted_score=("weighted_score_component", "sum"),
    )
    .reset_index()
)

base = base.merge(
    expected_assessments,
    on=["code_module", "code_presentation"],
    how="left",
)

base = base.merge(assessment_features, on=KEYS, how="left")

# ---------------------------------------------------------------------
# 5. Create early VLE engagement features using chunked processing
# ---------------------------------------------------------------------

print("\nCreating early VLE engagement features from large studentVle.csv...")
print("This is processed in chunks to avoid loading the full table unnecessarily.")

bucket_parts = []
daily_parts = []

vle_usecols = [
    "code_module",
    "code_presentation",
    "id_student",
    "date",
    "sum_click",
]

for chunk_no, chunk in enumerate(pd.read_csv(student_vle_path, usecols=vle_usecols, chunksize=CHUNK_SIZE), start=1):
    chunk["date"] = to_numeric(chunk["date"])
    chunk["sum_click"] = to_numeric(chunk["sum_click"]).fillna(0)

    # Keep only pre-course and early-course activity up to the cutoff day.
    chunk = chunk[chunk["date"] <= EARLY_CUTOFF_DAY].copy()

    if chunk.empty:
        continue

    conditions = [
        chunk["date"] < 0,
        (chunk["date"] >= 0) & (chunk["date"] <= 30),
        (chunk["date"] >= 31) & (chunk["date"] <= 60),
        (chunk["date"] >= 61) & (chunk["date"] <= EARLY_CUTOFF_DAY),
    ]

    choices = [
        "pre_course_clicks",
        "clicks_day_0_30",
        "clicks_day_31_60",
        "clicks_day_61_90",
    ]

    chunk["click_bucket"] = np.select(conditions, choices, default="outside_window")

    bucket_agg = (
        chunk[chunk["click_bucket"] != "outside_window"]
        .groupby(KEYS + ["click_bucket"])["sum_click"]
        .sum()
        .reset_index()
    )

    if not bucket_agg.empty:
        bucket_parts.append(bucket_agg)

    early_chunk = chunk[(chunk["date"] >= 0) & (chunk["date"] <= EARLY_CUTOFF_DAY)].copy()

    if not early_chunk.empty:
        daily_agg = (
            early_chunk
            .groupby(KEYS + ["date"])["sum_click"]
            .sum()
            .reset_index()
        )
        daily_parts.append(daily_agg)

    print(f"Processed VLE chunk {chunk_no}")

if bucket_parts:
    bucket_all = pd.concat(bucket_parts, ignore_index=True)
    bucket_all = (
        bucket_all
        .groupby(KEYS + ["click_bucket"])["sum_click"]
        .sum()
        .reset_index()
    )

    bucket_features = (
        bucket_all
        .pivot_table(
            index=KEYS,
            columns="click_bucket",
            values="sum_click",
            aggfunc="sum",
            fill_value=0,
        )
        .reset_index()
    )

    bucket_features.columns.name = None
else:
    bucket_features = pd.DataFrame(columns=KEYS)

if daily_parts:
    daily_all = pd.concat(daily_parts, ignore_index=True)
    daily_all = (
        daily_all
        .groupby(KEYS + ["date"])["sum_click"]
        .sum()
        .reset_index()
    )

    daily_features = (
        daily_all
        .groupby(KEYS)
        .agg(
            early_active_days=("date", "nunique"),
            early_total_clicks=("sum_click", "sum"),
            early_max_daily_clicks=("sum_click", "max"),
            early_avg_clicks_per_active_day=("sum_click", "mean"),
        )
        .reset_index()
    )
else:
    daily_features = pd.DataFrame(columns=KEYS)

base = base.merge(bucket_features, on=KEYS, how="left")
base = base.merge(daily_features, on=KEYS, how="left")

# ---------------------------------------------------------------------
# 6. Final cleanup and derived features
# ---------------------------------------------------------------------

numeric_fill_zero = [
    "early_expected_assessments",
    "early_expected_weight",
    "early_assessments_submitted",
    "early_late_submissions",
    "early_banked_assessments",
    "early_weighted_score",
    "pre_course_clicks",
    "clicks_day_0_30",
    "clicks_day_31_60",
    "clicks_day_61_90",
    "early_active_days",
    "early_total_clicks",
    "early_max_daily_clicks",
    "early_avg_clicks_per_active_day",
]

for col in numeric_fill_zero:
    if col not in base.columns:
        base[col] = 0
    base[col] = to_numeric(base[col]).fillna(0)

score_cols = ["early_avg_score", "early_min_score", "early_max_score"]
for col in score_cols:
    base[col] = to_numeric(base[col])
    base[f"{col}_missing"] = base[col].isna().astype(int)
    base[col] = base[col].fillna(0)

base["early_missing_assessments"] = (
    base["early_expected_assessments"] - base["early_assessments_submitted"]
)
base["early_missing_assessments"] = base["early_missing_assessments"].clip(lower=0)

base["early_submission_rate"] = np.where(
    base["early_expected_assessments"] > 0,
    base["early_assessments_submitted"] / base["early_expected_assessments"],
    0,
)

base["early_clicks_per_day_available"] = (
    base["early_total_clicks"] / EARLY_CUTOFF_DAY
)

base["date_registration"] = to_numeric(base["date_registration"]).fillna(0)
base["registered_before_start"] = base["registered_before_start"].fillna(0).astype(int)

base["num_of_prev_attempts"] = to_numeric(base["num_of_prev_attempts"]).fillna(0)
base["studied_credits"] = to_numeric(base["studied_credits"]).fillna(0)
base["module_presentation_length"] = to_numeric(base["module_presentation_length"]).fillna(0)

# A simple dashboard-friendly severity based on predicted target outcome.
base["actual_outcome_group"] = base["risk_status"]

# ---------------------------------------------------------------------
# 7. Save processed dataset and reports
# ---------------------------------------------------------------------

processed_path = PROCESSED_DIR / "oulad_student_features.csv"
base.to_csv(processed_path, index=False)

target_distribution = base["risk_status"].value_counts().reset_index()
target_distribution.columns = ["risk_status", "students"]
target_distribution["percentage"] = (
    target_distribution["students"] / len(base) * 100
).round(2)

final_result_distribution = base["final_result"].value_counts().reset_index()
final_result_distribution.columns = ["final_result", "students"]
final_result_distribution["percentage"] = (
    final_result_distribution["students"] / len(base) * 100
).round(2)

module_distribution = (
    base
    .groupby(["code_module", "code_presentation", "risk_status"])
    .size()
    .reset_index(name="students")
)

feature_summary = base[
    [
        "date_registration",
        "num_of_prev_attempts",
        "studied_credits",
        "early_expected_assessments",
        "early_assessments_submitted",
        "early_missing_assessments",
        "early_submission_rate",
        "early_avg_score",
        "early_total_clicks",
        "early_active_days",
        "early_avg_clicks_per_active_day",
        "early_clicks_per_day_available",
    ]
].describe().round(3)

target_distribution.to_csv(REPORTS_DIR / "oulad_target_distribution.csv", index=False)
final_result_distribution.to_csv(REPORTS_DIR / "oulad_final_result_distribution.csv", index=False)
module_distribution.to_csv(REPORTS_DIR / "oulad_module_risk_distribution.csv", index=False)
feature_summary.to_csv(REPORTS_DIR / "oulad_feature_summary.csv")

metadata = {
    "dataset": "Open University Learning Analytics Dataset",
    "processed_file": str(processed_path),
    "rows": int(base.shape[0]),
    "columns": int(base.shape[1]),
    "early_cutoff_day": EARLY_CUTOFF_DAY,
    "target_definition": {
        "At Risk": ["Fail", "Withdrawn"],
        "Not At Risk": ["Pass", "Distinction"],
    },
    "leakage_controls": [
        "date_unregistration was not used as a model feature.",
        "Only VLE activity up to day 90 was used.",
        "Only assessment submissions known by day 90 were used.",
        "final_result was used only to create the target label.",
    ],
}

with open(REPORTS_DIR / "oulad_preparation_metadata.json", "w", encoding="utf-8") as f:
    json.dump(metadata, f, indent=4)

summary_text = f"""
OULAD Processed Dataset Summary

Rows: {base.shape[0]}
Columns: {base.shape[1]}
Early cutoff day: {EARLY_CUTOFF_DAY}

Target definition:
- At Risk: Fail or Withdrawn
- Not At Risk: Pass or Distinction

Target distribution:
{target_distribution.to_string(index=False)}

Final result distribution:
{final_result_distribution.to_string(index=False)}

Feature summary:
{feature_summary.to_string()}

Leakage controls:
- date_unregistration was not used as a feature.
- VLE activity was restricted to activity up to day {EARLY_CUTOFF_DAY}.
- Assessment submissions were restricted to submissions known by day {EARLY_CUTOFF_DAY}.
- final_result was used only to create the target label.
"""

with open(REPORTS_DIR / "oulad_preparation_summary.txt", "w", encoding="utf-8") as f:
    f.write(summary_text)

print("\n" + "=" * 80)
print("OULAD PROCESSED DATASET CREATED")
print("=" * 80)
print("Saved processed dataset to:", processed_path)
print("Dataset shape:", base.shape)

print("\nTarget distribution:")
print(target_distribution)

print("\nFinal result distribution:")
print(final_result_distribution)

print("\nFeature summary:")
print(feature_summary)

print("\nSaved reports to:", REPORTS_DIR)
print("\nOULAD DATASET PREPARATION COMPLETED SUCCESSFULLY")
