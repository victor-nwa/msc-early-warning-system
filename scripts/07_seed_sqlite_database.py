
from pathlib import Path
import sqlite3
import hashlib
import pandas as pd

BASE_DIR = Path(__file__).resolve().parents[1]
DB_PATH = BASE_DIR / "data" / "app" / "early_warning.db"

PREDICTIONS_PATH = BASE_DIR / "data" / "processed" / "oulad" / "oulad_student_risk_predictions.csv"
MODEL_RESULTS_PATH = BASE_DIR / "outputs" / "reports" / "oulad" / "oulad_model_comparison_results.csv"
FEATURE_IMPORTANCE_PATH = BASE_DIR / "outputs" / "reports" / "oulad" / "oulad_top_20_feature_importance.csv"
INTERVENTION_SUMMARY_PATH = BASE_DIR / "outputs" / "reports" / "oulad" / "oulad_intervention_summary.csv"

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()

def clean_risk_level(value: str) -> str:
    mapping = {
        "Low Predicted Risk": "Low",
        "Moderate Predicted Risk": "Moderate",
        "High Predicted Risk": "High",
    }
    return mapping.get(str(value), str(value))

def main():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)

    if not PREDICTIONS_PATH.exists():
        raise FileNotFoundError(f"Missing predictions file: {PREDICTIONS_PATH}")

    predictions = pd.read_csv(PREDICTIONS_PATH)
    model_results = pd.read_csv(MODEL_RESULTS_PATH)

    predictions["risk_level"] = predictions["predicted_risk_level"].apply(clean_risk_level)

    users = pd.DataFrame([
        {
            "user_id": 1,
            "full_name": "System Administrator",
            "email": "admin@earlywarning.local",
            "password_hash": hash_password("Admin@2026Portal!"),
            "role": "Administrator",
            "is_active": 1,
        }
    ])

    learner_columns = [
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
    ]

    prediction_columns = [
        "student_record_key",
        "risk_status",
        "risk_label",
        "predicted_risk_probability",
        "predicted_risk_status",
        "predicted_risk_level",
        "risk_level",
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

    learners = predictions[learner_columns].copy()
    prediction_records = predictions[prediction_columns].copy()

    model_results["is_selected_model"] = model_results["model_name"].eq("gradient_boosting").astype(int)

    system_summary = pd.DataFrame([
        {"metric": "Total Learners", "value": len(predictions)},
        {"metric": "Actual At Risk", "value": int((predictions["risk_status"] == "At Risk").sum())},
        {"metric": "Actual Not At Risk", "value": int((predictions["risk_status"] == "Not At Risk").sum())},
        {"metric": "Predicted At Risk", "value": int((predictions["predicted_risk_status"] == "At Risk").sum())},
        {"metric": "Predicted Not At Risk", "value": int((predictions["predicted_risk_status"] == "Not At Risk").sum())},
        {"metric": "Low Risk", "value": int((predictions["risk_level"] == "Low").sum())},
        {"metric": "Moderate Risk", "value": int((predictions["risk_level"] == "Moderate").sum())},
        {"metric": "High Risk", "value": int((predictions["risk_level"] == "High").sum())},
    ])

    feature_importance = pd.read_csv(FEATURE_IMPORTANCE_PATH) if FEATURE_IMPORTANCE_PATH.exists() else pd.DataFrame()
    intervention_summary = pd.read_csv(INTERVENTION_SUMMARY_PATH) if INTERVENTION_SUMMARY_PATH.exists() else pd.DataFrame()

    with sqlite3.connect(DB_PATH) as conn:
        users.to_sql("users", conn, if_exists="replace", index=False)
        learners.to_sql("learners", conn, if_exists="replace", index=False)
        prediction_records.to_sql("predictions", conn, if_exists="replace", index=False)
        model_results.to_sql("model_results", conn, if_exists="replace", index=False)
        system_summary.to_sql("system_summary", conn, if_exists="replace", index=False)

        if not feature_importance.empty:
            feature_importance.to_sql("feature_importance", conn, if_exists="replace", index=False)

        if not intervention_summary.empty:
            intervention_summary.to_sql("intervention_summary", conn, if_exists="replace", index=False)

    print(f"SQLite database created: {DB_PATH}")
    print(f"Learners loaded: {len(learners):,}")
    print(f"Prediction records loaded: {len(prediction_records):,}")
    print(f"Model results loaded: {len(model_results):,}")
    print("\nRisk level distribution:")
    print(predictions["risk_level"].value_counts())

if __name__ == "__main__":
    main()
