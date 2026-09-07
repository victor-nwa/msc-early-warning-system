from pathlib import Path
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

DATA_PATH = Path("data/processed/oulad/oulad_student_features.csv")
REPORTS_DIR = Path("outputs/reports/oulad")
FIGURES_DIR = Path("outputs/figures/oulad")

REPORTS_DIR.mkdir(parents=True, exist_ok=True)
FIGURES_DIR.mkdir(parents=True, exist_ok=True)

df = pd.read_csv(DATA_PATH)

sns.set_theme(style="whitegrid")

print("=" * 80)
print("OULAD EXPLORATORY DATA ANALYSIS")
print("=" * 80)

print("\nDataset shape:", df.shape)

print("\nRisk status counts:")
risk_counts = df["risk_status"].value_counts()
print(risk_counts)

print("\nRisk status percentage:")
risk_pct = (df["risk_status"].value_counts(normalize=True) * 100).round(2)
print(risk_pct)

print("\nFinal result distribution:")
final_result_counts = df["final_result"].value_counts()
print(final_result_counts)

print("\nFinal result percentage:")
final_result_pct = (df["final_result"].value_counts(normalize=True) * 100).round(2)
print(final_result_pct)

print("\nRisk by module:")
risk_by_module = pd.crosstab(df["code_module"], df["risk_status"], margins=True)
print(risk_by_module)

print("\nRisk by module and presentation:")
risk_by_module_presentation = pd.crosstab(
    [df["code_module"], df["code_presentation"]],
    df["risk_status"],
    margins=True
)
print(risk_by_module_presentation)

print("\nRisk by previous attempts:")
risk_by_attempts = pd.crosstab(
    df["num_of_prev_attempts"],
    df["risk_status"],
    normalize="index"
) * 100
print(risk_by_attempts.round(2))

print("\nRisk by disability:")
risk_by_disability = pd.crosstab(
    df["disability"],
    df["risk_status"],
    normalize="index"
) * 100
print(risk_by_disability.round(2))

print("\nRisk by highest education:")
risk_by_education = pd.crosstab(
    df["highest_education"],
    df["risk_status"],
    normalize="index"
) * 100
print(risk_by_education.round(2))

print("\nAverage early-warning features by risk status:")
numeric_cols = [
    "date_registration",
    "num_of_prev_attempts",
    "studied_credits",
    "module_presentation_length",
    "early_expected_assessments",
    "early_assessments_submitted",
    "early_missing_assessments",
    "early_submission_rate",
    "early_avg_score",
    "early_late_submissions",
    "early_total_clicks",
    "pre_course_clicks",
    "clicks_day_0_30",
    "clicks_day_31_60",
    "clicks_day_61_90",
    "early_active_days",
    "early_avg_clicks_per_active_day",
    "early_clicks_per_day_available",
]

numeric_summary = df.groupby("risk_status")[numeric_cols].mean().round(3)
print(numeric_summary)

# Save report tables
risk_counts.to_csv(REPORTS_DIR / "eda_risk_status_counts.csv")
risk_pct.to_csv(REPORTS_DIR / "eda_risk_status_percentage.csv")
final_result_counts.to_csv(REPORTS_DIR / "eda_final_result_counts.csv")
final_result_pct.to_csv(REPORTS_DIR / "eda_final_result_percentage.csv")
risk_by_module.to_csv(REPORTS_DIR / "eda_risk_by_module.csv")
risk_by_module_presentation.to_csv(REPORTS_DIR / "eda_risk_by_module_presentation.csv")
risk_by_attempts.round(2).to_csv(REPORTS_DIR / "eda_risk_by_previous_attempts_percent.csv")
risk_by_disability.round(2).to_csv(REPORTS_DIR / "eda_risk_by_disability_percent.csv")
risk_by_education.round(2).to_csv(REPORTS_DIR / "eda_risk_by_highest_education_percent.csv")
numeric_summary.to_csv(REPORTS_DIR / "eda_numeric_summary_by_risk_status.csv")

# 1. Risk status count
plt.figure(figsize=(8, 5))
sns.countplot(data=df, x="risk_status", order=["At Risk", "Not At Risk"])
plt.title("OULAD Student Risk Status Distribution")
plt.xlabel("Risk Status")
plt.ylabel("Number of Students")
plt.tight_layout()
plt.savefig(FIGURES_DIR / "oulad_risk_status_distribution.png", dpi=300)
plt.close()

# 2. Final result distribution
plt.figure(figsize=(8, 5))
order = df["final_result"].value_counts().index.tolist()
sns.countplot(data=df, x="final_result", order=order)
plt.title("OULAD Final Result Distribution")
plt.xlabel("Final Result")
plt.ylabel("Number of Students")
plt.tight_layout()
plt.savefig(FIGURES_DIR / "oulad_final_result_distribution.png", dpi=300)
plt.close()

# 3. Risk by module
module_risk = (
    df.groupby(["code_module", "risk_status"])
    .size()
    .reset_index(name="students")
)

plt.figure(figsize=(10, 6))
sns.barplot(data=module_risk, x="code_module", y="students", hue="risk_status")
plt.title("Risk Status by Module")
plt.xlabel("Module")
plt.ylabel("Number of Students")
plt.tight_layout()
plt.savefig(FIGURES_DIR / "oulad_risk_by_module.png", dpi=300)
plt.close()

# 4. Previous attempts by risk status
plt.figure(figsize=(9, 5))
sns.countplot(data=df, x="num_of_prev_attempts", hue="risk_status")
plt.title("Previous Attempts by Risk Status")
plt.xlabel("Number of Previous Attempts")
plt.ylabel("Number of Students")
plt.tight_layout()
plt.savefig(FIGURES_DIR / "oulad_previous_attempts_by_risk.png", dpi=300)
plt.close()

# 5. Studied credits by risk status
plt.figure(figsize=(8, 5))
sns.boxplot(data=df, x="risk_status", y="studied_credits", order=["At Risk", "Not At Risk"])
plt.title("Studied Credits by Risk Status")
plt.xlabel("Risk Status")
plt.ylabel("Studied Credits")
plt.tight_layout()
plt.savefig(FIGURES_DIR / "oulad_studied_credits_by_risk.png", dpi=300)
plt.close()

# 6. Early average assessment score by risk status
plt.figure(figsize=(8, 5))
sns.boxplot(data=df, x="risk_status", y="early_avg_score", order=["At Risk", "Not At Risk"])
plt.title("Early Average Assessment Score by Risk Status")
plt.xlabel("Risk Status")
plt.ylabel("Early Average Score")
plt.tight_layout()
plt.savefig(FIGURES_DIR / "oulad_early_avg_score_by_risk.png", dpi=300)
plt.close()

# 7. Early submission rate by risk status
plt.figure(figsize=(8, 5))
sns.boxplot(data=df, x="risk_status", y="early_submission_rate", order=["At Risk", "Not At Risk"])
plt.title("Early Assessment Submission Rate by Risk Status")
plt.xlabel("Risk Status")
plt.ylabel("Early Submission Rate")
plt.tight_layout()
plt.savefig(FIGURES_DIR / "oulad_early_submission_rate_by_risk.png", dpi=300)
plt.close()

# 8. Early total clicks by risk status
# Clip extreme values only for visual readability, not for modelling.
click_cap = df["early_total_clicks"].quantile(0.95)
plot_clicks = df.copy()
plot_clicks["early_total_clicks_capped_95"] = plot_clicks["early_total_clicks"].clip(upper=click_cap)

plt.figure(figsize=(8, 5))
sns.boxplot(
    data=plot_clicks,
    x="risk_status",
    y="early_total_clicks_capped_95",
    order=["At Risk", "Not At Risk"]
)
plt.title("Early VLE Clicks by Risk Status")
plt.xlabel("Risk Status")
plt.ylabel("Early Total Clicks, Capped at 95th Percentile")
plt.tight_layout()
plt.savefig(FIGURES_DIR / "oulad_early_clicks_by_risk.png", dpi=300)
plt.close()

# 9. Early active days by risk status
plt.figure(figsize=(8, 5))
sns.boxplot(data=df, x="risk_status", y="early_active_days", order=["At Risk", "Not At Risk"])
plt.title("Early Active VLE Days by Risk Status")
plt.xlabel("Risk Status")
plt.ylabel("Early Active Days")
plt.tight_layout()
plt.savefig(FIGURES_DIR / "oulad_early_active_days_by_risk.png", dpi=300)
plt.close()

# 10. Risk by highest education
education_risk = (
    df.groupby(["highest_education", "risk_status"])
    .size()
    .reset_index(name="students")
)

plt.figure(figsize=(12, 6))
sns.barplot(data=education_risk, x="highest_education", y="students", hue="risk_status")
plt.title("Risk Status by Highest Education")
plt.xlabel("Highest Education")
plt.ylabel("Number of Students")
plt.xticks(rotation=35, ha="right")
plt.tight_layout()
plt.savefig(FIGURES_DIR / "oulad_risk_by_highest_education.png", dpi=300)
plt.close()

# 11. Correlation heatmap for numeric early-warning features
corr_cols = [
    "risk_label",
    "date_registration",
    "num_of_prev_attempts",
    "studied_credits",
    "early_expected_assessments",
    "early_assessments_submitted",
    "early_missing_assessments",
    "early_submission_rate",
    "early_avg_score",
    "early_late_submissions",
    "early_total_clicks",
    "pre_course_clicks",
    "clicks_day_0_30",
    "clicks_day_31_60",
    "clicks_day_61_90",
    "early_active_days",
    "early_avg_clicks_per_active_day",
    "early_clicks_per_day_available",
]

corr = df[corr_cols].corr()

plt.figure(figsize=(14, 10))
sns.heatmap(corr, annot=True, fmt=".2f", cmap="coolwarm")
plt.title("Correlation Heatmap of OULAD Early-Warning Features")
plt.tight_layout()
plt.savefig(FIGURES_DIR / "oulad_numeric_correlation_heatmap.png", dpi=300)
plt.close()

eda_summary = f"""
OULAD Exploratory Data Analysis Summary

Dataset shape:
{df.shape}

Target definition:
At Risk = Fail or Withdrawn
Not At Risk = Pass or Distinction

Risk status counts:
{risk_counts.to_string()}

Risk status percentage:
{risk_pct.to_string()}

Final result counts:
{final_result_counts.to_string()}

Final result percentage:
{final_result_pct.to_string()}

Risk by module:
{risk_by_module.to_string()}

Risk by previous attempts, percentage:
{risk_by_attempts.round(2).to_string()}

Risk by disability, percentage:
{risk_by_disability.round(2).to_string()}

Risk by highest education, percentage:
{risk_by_education.round(2).to_string()}

Average early-warning numeric features by risk status:
{numeric_summary.to_string()}

Initial interpretation:
1. The OULAD target is more balanced than the first UCI dataset.
2. The At Risk group includes students who failed or withdrew.
3. The Not At Risk group includes students who passed or achieved distinction.
4. Early assessment behaviour and early VLE engagement are important for the next modelling stage.
5. date_unregistration is excluded from modelling to avoid target leakage.
6. The modelling stage should prioritise recall for the At Risk class, while also reporting precision, F1-score and ROC-AUC.
"""

with open(REPORTS_DIR / "oulad_eda_summary.txt", "w", encoding="utf-8") as f:
    f.write(eda_summary)

print("\nSaved EDA reports to:", REPORTS_DIR)
print("Saved EDA figures to:", FIGURES_DIR)

print("\nGenerated OULAD report files:")
for path in sorted(REPORTS_DIR.glob("eda_*")):
    print("-", path)

print("\nGenerated OULAD figures:")
for path in sorted(FIGURES_DIR.glob("oulad_*")):
    print("-", path)

print("\nOULAD EDA COMPLETED SUCCESSFULLY")
