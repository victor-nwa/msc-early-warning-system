from pathlib import Path
import json
import joblib
import pandas as pd

DATA_PATH = Path("data/processed/oulad/oulad_student_features.csv")
METADATA_PATH = Path("outputs/reports/oulad/oulad_selected_model_metadata.json")

PROCESSED_DIR = Path("data/processed/oulad")
REPORTS_DIR = Path("outputs/reports/oulad")

PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
REPORTS_DIR.mkdir(parents=True, exist_ok=True)

df = pd.read_csv(DATA_PATH)

with open(METADATA_PATH, "r", encoding="utf-8") as f:
    metadata = json.load(f)

model_info = metadata["best_model"]
model_path = Path(model_info["model_file"])
features = model_info["features"]

pipeline = joblib.load(model_path)

X = df[features].copy()

risk_probability = pipeline.predict_proba(X)[:, 1]
risk_prediction = pipeline.predict(X)

df["predicted_risk_probability"] = risk_probability
df["predicted_risk_label"] = risk_prediction
df["predicted_risk_status"] = df["predicted_risk_label"].map({
    1: "At Risk",
    0: "Not At Risk",
})

def probability_band(probability):
    if probability >= 0.70:
        return "High Predicted Risk"
    elif probability >= 0.40:
        return "Moderate Predicted Risk"
    else:
        return "Low Predicted Risk"

df["predicted_risk_level"] = df["predicted_risk_probability"].apply(probability_band)


def observed_risk_factors(row):
    factors = []

    if row["early_submission_rate"] < 0.5:
        factors.append("Low early assessment submission rate")
    elif row["early_submission_rate"] < 0.8:
        factors.append("Partial early assessment submission")

    if row["early_missing_assessments"] > 0:
        factors.append("Missing early assessment activity")

    if row["early_avg_score"] > 0 and row["early_avg_score"] < 50:
        factors.append("Low early assessment score")

    if row["early_late_submissions"] > 0:
        factors.append("Late early assessment submission")

    if row["early_total_clicks"] < 50:
        factors.append("Low early VLE engagement")

    if row["early_active_days"] < 10:
        factors.append("Few active learning days")

    if row["clicks_day_61_90"] < 20:
        factors.append("Low engagement between days 61 and 90")

    if row["num_of_prev_attempts"] > 0:
        factors.append("Previous module attempt")

    if row["studied_credits"] >= 120:
        factors.append("High study credit load")

    if row["highest_education"] in ["Lower Than A Level", "No Formal quals"]:
        factors.append("Lower prior education background")

    if row["disability"] == "Y":
        factors.append("Declared disability support consideration")

    if not factors:
        factors.append("No major rule-based risk factor identified")

    return "; ".join(factors)


def recommended_interventions(row):
    actions = []

    if row["predicted_risk_probability"] >= 0.70:
        actions.append("Priority learner support review")
    elif row["predicted_risk_probability"] >= 0.40:
        actions.append("Academic support team review")

    if row["early_submission_rate"] < 0.8 or row["early_missing_assessments"] > 0:
        actions.append("Contact student about early assessment completion")

    if row["early_avg_score"] > 0 and row["early_avg_score"] < 50:
        actions.append("Offer academic skills support and targeted tutoring")

    if row["early_late_submissions"] > 0:
        actions.append("Discuss assessment planning and deadline management")

    if row["early_total_clicks"] < 50 or row["early_active_days"] < 10:
        actions.append("Encourage structured weekly VLE engagement")

    if row["clicks_day_61_90"] < 20:
        actions.append("Review recent engagement drop-off with student")

    if row["num_of_prev_attempts"] > 0:
        actions.append("Review previous attempt history and agree recovery plan")

    if row["studied_credits"] >= 120:
        actions.append("Check workload pressure and study planning")

    if row["highest_education"] in ["Lower Than A Level", "No Formal quals"]:
        actions.append("Offer transition support and study-skills guidance")

    if row["disability"] == "Y":
        actions.append("Confirm whether reasonable adjustments or support needs are in place")

    if not actions:
        actions.append("Continue normal monitoring")

    clean_actions = []
    for action in actions:
        if action not in clean_actions:
            clean_actions.append(action)

    return "; ".join(clean_actions)


def assistant_summary(row):
    probability_percent = round(row["predicted_risk_probability"] * 100, 1)

    if row["predicted_risk_level"] == "High Predicted Risk":
        opening = (
            f"This learner is currently classified as High Predicted Risk "
            f"with an estimated risk probability of {probability_percent}%."
        )
    elif row["predicted_risk_level"] == "Moderate Predicted Risk":
        opening = (
            f"This learner is currently classified as Moderate Predicted Risk "
            f"with an estimated risk probability of {probability_percent}%."
        )
    else:
        opening = (
            f"This learner is currently classified as Low Predicted Risk "
            f"with an estimated risk probability of {probability_percent}%."
        )

    return (
        f"{opening} The main observed factors are: {row['observed_risk_factors']}. "
        f"Suggested support actions are: {row['recommended_interventions']}. "
        f"This output is advisory and should be reviewed by academic or learner support staff before action is taken."
    )


df["observed_risk_factors"] = df.apply(observed_risk_factors, axis=1)
df["recommended_interventions"] = df.apply(recommended_interventions, axis=1)
df["ai_support_summary"] = df.apply(assistant_summary, axis=1)

dashboard_columns = [
    "student_record_key",
    "code_module",
    "code_presentation",
    "id_student",
    "gender",
    "region",
    "highest_education",
    "imd_band",
    "age_band",
    "num_of_prev_attempts",
    "studied_credits",
    "disability",
    "final_result",
    "risk_status",
    "risk_label",
    "predicted_risk_probability",
    "predicted_risk_status",
    "predicted_risk_level",
    "early_submission_rate",
    "early_assessments_submitted",
    "early_missing_assessments",
    "early_avg_score",
    "early_late_submissions",
    "early_total_clicks",
    "clicks_day_0_30",
    "clicks_day_31_60",
    "clicks_day_61_90",
    "early_active_days",
    "early_avg_clicks_per_active_day",
    "observed_risk_factors",
    "recommended_interventions",
    "ai_support_summary",
]

dashboard_df = df[dashboard_columns].copy()

predictions_path = PROCESSED_DIR / "oulad_student_risk_predictions.csv"
dashboard_df.to_csv(predictions_path, index=False)

summary = df.groupby("predicted_risk_level").agg(
    students=("student_record_key", "count"),
    average_probability=("predicted_risk_probability", "mean"),
    actual_at_risk_students=("risk_label", "sum"),
).reset_index()

summary["average_probability"] = summary["average_probability"].round(4)
summary["actual_at_risk_rate"] = (
    summary["actual_at_risk_students"] / summary["students"] * 100
).round(2)

summary_path = REPORTS_DIR / "oulad_intervention_summary.csv"
summary.to_csv(summary_path, index=False)

prediction_status = df["predicted_risk_status"].value_counts().reset_index()
prediction_status.columns = ["predicted_risk_status", "students"]
prediction_status["percentage"] = (
    prediction_status["students"] / len(df) * 100
).round(2)
prediction_status_path = REPORTS_DIR / "oulad_prediction_status_distribution.csv"
prediction_status.to_csv(prediction_status_path, index=False)

logic_note = """
OULAD Intervention Recommendation Logic

The intervention component is rule-based and designed for human review.
It converts observable early-warning indicators into recommended support actions.

The model predicts risk probability using early assessment, registration, demographic and VLE engagement features.
The recommendation rules then translate selected risk factors into practical academic support actions.

Example rules:
- Low early assessment submission rate -> contact student about early assessment completion.
- Low early assessment score -> offer academic skills support and targeted tutoring.
- Low VLE engagement -> encourage structured weekly engagement.
- Previous attempts -> review previous attempt history and agree recovery plan.
- High credit load -> check workload pressure and study planning.
- Declared disability -> confirm support needs or reasonable adjustments.

The output is advisory only. Staff should review student context before any action is taken.
"""

logic_path = REPORTS_DIR / "oulad_intervention_logic.txt"
with open(logic_path, "w", encoding="utf-8") as f:
    f.write(logic_note)

print("=" * 80)
print("OULAD INTERVENTION DATASET CREATED")
print("=" * 80)
print("Model used:", model_info["model_name"])
print("Model path:", model_path)
print("Saved dashboard prediction dataset to:", predictions_path)
print("Saved intervention summary to:", summary_path)
print("Saved prediction status distribution to:", prediction_status_path)
print("Saved intervention logic note to:", logic_path)

print("\nPrediction status counts:")
print(prediction_status)

print("\nPredicted risk level summary:")
print(summary)

print("\nPreview:")
print(dashboard_df.head(10))

print("\nOULAD INTERVENTION GENERATION COMPLETED SUCCESSFULLY")
