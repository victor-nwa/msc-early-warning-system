
from typing import Optional
from functools import lru_cache
import hashlib

from backend.database import DB_PATH, get_connection, rows_to_dicts

# Keep this name because main.py already imports PREDICTIONS_PATH for health check.
PREDICTIONS_PATH = DB_PATH

def clear_cache():
    load_summary.cache_clear()

def _clean_risk_filter(value: Optional[str]) -> Optional[str]:
    if not value:
        return None

    mapping = {
        "low predicted risk": "Low",
        "moderate predicted risk": "Moderate",
        "high predicted risk": "High",
        "low": "Low",
        "moderate": "Moderate",
        "high": "High",
    }

    return mapping.get(value.strip().lower(), value.strip())

def _format_model_name(name: str) -> str:
    return str(name).replace("_", " ").title()

@lru_cache(maxsize=1)
def load_summary():
    with get_connection() as conn:
        total_learners = conn.execute("SELECT COUNT(*) FROM learners").fetchone()[0]

        predicted_at_risk = conn.execute(
            "SELECT COUNT(*) FROM predictions WHERE predicted_risk_status = 'At Risk'"
        ).fetchone()[0]

        predicted_not_at_risk = conn.execute(
            "SELECT COUNT(*) FROM predictions WHERE predicted_risk_status = 'Not At Risk'"
        ).fetchone()[0]

        actual_at_risk = conn.execute(
            "SELECT COUNT(*) FROM predictions WHERE risk_status = 'At Risk'"
        ).fetchone()[0]

        avg_probability = conn.execute(
            "SELECT AVG(predicted_risk_probability) FROM predictions"
        ).fetchone()[0]

        risk_levels = rows_to_dicts(conn.execute("""
            SELECT risk_level, COUNT(*) AS total
            FROM predictions
            GROUP BY risk_level
            ORDER BY 
                CASE risk_level
                    WHEN 'High' THEN 1
                    WHEN 'Moderate' THEN 2
                    WHEN 'Low' THEN 3
                    ELSE 4
                END
        """).fetchall())

        prediction_status = rows_to_dicts(conn.execute("""
            SELECT predicted_risk_status AS status, COUNT(*) AS total
            FROM predictions
            GROUP BY predicted_risk_status
            ORDER BY total DESC
        """).fetchall())

        module_distribution = rows_to_dicts(conn.execute("""
            SELECT 
                l.code_module, 
                p.risk_level, 
                COUNT(*) AS total,
                SUM(CASE WHEN l.gender = 'M' THEN 1 ELSE 0 END) AS male_learners,
                SUM(CASE WHEN l.gender = 'F' THEN 1 ELSE 0 END) AS female_learners
            FROM learners l
            JOIN predictions p ON l.student_record_key = p.student_record_key
            GROUP BY l.code_module, p.risk_level
            ORDER BY l.code_module, total DESC
        """).fetchall())

    risk_map = {row["risk_level"]: row["total"] for row in risk_levels}

    return {
        "total_learners": total_learners,
        "predicted_at_risk": predicted_at_risk,
        "predicted_not_at_risk": predicted_not_at_risk,
        "actual_at_risk": actual_at_risk,
        "average_probability": round(float(avg_probability or 0), 4),

        # Old frontend-compatible keys
        "high_predicted_risk": int(risk_map.get("High", 0)),
        "moderate_predicted_risk": int(risk_map.get("Moderate", 0)),
        "low_predicted_risk": int(risk_map.get("Low", 0)),

        # New cleaner keys
        "risk_level_distribution": risk_levels,
        "prediction_status_distribution": prediction_status,
        "module_risk_distribution": module_distribution,
    }

def get_summary():
    return load_summary()

def get_students(
    limit: int = 100,
    offset: int = 0,
    risk_level: Optional[str] = None,
    risk_status: Optional[str] = None,
    module: Optional[str] = None,
    presentation: Optional[str] = None,
    search: Optional[str] = None,
):
    risk_level = _clean_risk_filter(risk_level)

    where = []
    params = []

    if risk_level:
        where.append("p.risk_level = ?")
        params.append(risk_level)

    if risk_status:
        where.append("p.predicted_risk_status = ?")
        params.append(risk_status)

    if module:
        where.append("l.code_module = ?")
        params.append(module)

    if presentation:
        where.append("l.code_presentation = ?")
        params.append(presentation)

    if search:
        where.append("""
            (
                CAST(l.id_student AS TEXT) LIKE ?
                OR l.student_record_key LIKE ?
                OR l.code_module LIKE ?
                OR l.region LIKE ?
            )
        """)
        like_search = f"%{search}%"
        params.extend([like_search, like_search, like_search, like_search])

    where_sql = "WHERE " + " AND ".join(where) if where else ""

    query = f"""
        SELECT
            l.student_record_key,
            l.id_student,
            l.code_module,
            l.code_presentation,
            l.gender,
            l.region,
            l.highest_education,
            l.age_band,
            l.disability,
            l.final_result,
            p.predicted_risk_status,
            p.predicted_risk_probability,
            p.predicted_risk_level,
            p.risk_level,
            p.early_submission_rate,
            p.early_avg_score,
            p.early_total_clicks,
            p.observed_risk_factors,
            p.recommended_interventions
        FROM learners l
        JOIN predictions p ON l.student_record_key = p.student_record_key
        {where_sql}
        ORDER BY p.predicted_risk_probability DESC
        LIMIT ? OFFSET ?
    """

    count_query = f"""
        SELECT COUNT(*) AS total
        FROM learners l
        JOIN predictions p ON l.student_record_key = p.student_record_key
        {where_sql}
    """

    with get_connection() as conn:
        total = conn.execute(count_query, params).fetchone()["total"]
        rows = conn.execute(query, params + [limit, offset]).fetchall()

    records = rows_to_dicts(rows)

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "records": records,
        "students": records,
        "items": records,
    }

def get_student(student_record_key: str):
    query = """
        SELECT
            l.*,
            p.risk_status,
            p.risk_label,
            p.predicted_risk_probability,
            p.predicted_risk_status,
            p.predicted_risk_level,
            p.risk_level,
            p.early_submission_rate,
            p.early_assessments_submitted,
            p.early_missing_assessments,
            p.early_avg_score,
            p.early_late_submissions,
            p.early_total_clicks,
            p.clicks_day_0_30,
            p.clicks_day_31_60,
            p.clicks_day_61_90,
            p.early_active_days,
            p.early_avg_clicks_per_active_day,
            p.observed_risk_factors,
            p.recommended_interventions,
            p.ai_support_summary
        FROM learners l
        JOIN predictions p ON l.student_record_key = p.student_record_key
        WHERE l.student_record_key = ?
    """

    with get_connection() as conn:
        row = conn.execute(query, [student_record_key]).fetchone()

    if row is None:
        return None

    return dict(row)

def get_model_performance():
    with get_connection() as conn:
        rows = rows_to_dicts(conn.execute("""
            SELECT *
            FROM model_results
            ORDER BY is_selected_model DESC, roc_auc DESC
        """).fetchall())

    for row in rows:
        row["display_name"] = _format_model_name(row.get("model_name", ""))

    selected = next((row for row in rows if row.get("is_selected_model") == 1), rows[0] if rows else None)

    return {
        "selected_model": selected,
        "models": rows,
        "comparison": rows,
        "selection_reason": (
            "Gradient Boosting was selected because it identified more at-risk students "
            "and produced fewer false negatives than the other models. In an early warning "
            "system, missing an at-risk student is more serious than flagging an extra "
            "student for review."
        ),
    }

def get_explainability():
    with get_connection() as conn:
        table_exists = conn.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='feature_importance'
        """).fetchone()

        if table_exists:
            features = rows_to_dicts(conn.execute("""
                SELECT *
                FROM feature_importance
                LIMIT 20
            """).fetchall())
        else:
            features = []

        risk_profiles = rows_to_dicts(conn.execute("""
            SELECT
                p.risk_level,
                COUNT(*) AS learners,
                AVG(p.predicted_risk_probability) AS avg_probability,
                AVG(p.early_submission_rate) AS avg_submission_rate,
                AVG(p.early_avg_score) AS avg_score,
                AVG(p.early_total_clicks) AS avg_clicks,
                AVG(p.early_active_days) AS avg_active_days,
                AVG(p.early_missing_assessments) AS avg_missing_assessments,
                AVG(p.early_late_submissions) AS avg_late_submissions,
                SUM(CASE WHEN p.risk_status = 'At Risk' THEN 1 ELSE 0 END) AS actual_at_risk
            FROM predictions p
            GROUP BY p.risk_level
            ORDER BY
                CASE p.risk_level
                    WHEN 'High' THEN 1
                    WHEN 'Moderate' THEN 2
                    WHEN 'Low' THEN 3
                    ELSE 4
                END
        """).fetchall())

        module_profiles = rows_to_dicts(conn.execute("""
            SELECT
                l.code_module,
                COUNT(*) AS learners,
                SUM(CASE WHEN p.risk_level = 'High' THEN 1 ELSE 0 END) AS high_risk,
                SUM(CASE WHEN p.risk_level = 'Moderate' THEN 1 ELSE 0 END) AS moderate_risk,
                SUM(CASE WHEN p.risk_level = 'Low' THEN 1 ELSE 0 END) AS low_risk,
                AVG(p.predicted_risk_probability) AS avg_probability,
                AVG(p.early_submission_rate) AS avg_submission_rate,
                AVG(p.early_avg_score) AS avg_score,
                AVG(p.early_total_clicks) AS avg_clicks
            FROM learners l
            JOIN predictions p ON l.student_record_key = p.student_record_key
            GROUP BY l.code_module
            ORDER BY high_risk DESC
        """).fetchall())

    return {
        "top_features": features,
        "feature_importance": features,
        "risk_profiles": risk_profiles,
        "module_profiles": module_profiles,
    }



def get_overview_data():
    with get_connection() as conn:
        cohort_row = conn.execute("""
            SELECT
                COUNT(*) AS total_learners,
                SUM(CASE WHEN predicted_risk_status = 'At Risk' THEN 1 ELSE 0 END) AS predicted_at_risk,
                SUM(CASE WHEN predicted_risk_status = 'Not At Risk' THEN 1 ELSE 0 END) AS predicted_not_at_risk,
                SUM(CASE WHEN risk_level = 'High' THEN 1 ELSE 0 END) AS high_risk,
                SUM(CASE WHEN risk_level = 'Moderate' THEN 1 ELSE 0 END) AS moderate_risk,
                SUM(CASE WHEN risk_level = 'Low' THEN 1 ELSE 0 END) AS low_risk,
                AVG(predicted_risk_probability) AS avg_risk_probability
            FROM predictions
        """).fetchone()

        module_presentation_risk = rows_to_dicts(conn.execute("""
            SELECT
                l.code_module,
                l.code_presentation,
                COUNT(*) AS total_learners,
                SUM(CASE WHEN p.predicted_risk_status = 'At Risk' THEN 1 ELSE 0 END) AS at_risk_learners,
                ROUND(
                    1.0 * SUM(CASE WHEN p.predicted_risk_status = 'At Risk' THEN 1 ELSE 0 END)
                    / NULLIF(COUNT(*), 0),
                    4
                ) AS at_risk_rate
            FROM predictions p
            JOIN learners l ON l.student_record_key = p.student_record_key
            GROUP BY l.code_module, l.code_presentation
            ORDER BY at_risk_rate DESC, at_risk_learners DESC
        """).fetchall())

        engagement_row = conn.execute("""
            SELECT
                AVG(CASE WHEN predicted_risk_status = 'At Risk' THEN clicks_day_0_30 END) AS at_risk_0_30,
                AVG(CASE WHEN predicted_risk_status = 'At Risk' THEN clicks_day_31_60 END) AS at_risk_31_60,
                AVG(CASE WHEN predicted_risk_status = 'At Risk' THEN clicks_day_61_90 END) AS at_risk_61_90,
                AVG(CASE WHEN predicted_risk_status = 'Not At Risk' THEN clicks_day_0_30 END) AS not_at_risk_0_30,
                AVG(CASE WHEN predicted_risk_status = 'Not At Risk' THEN clicks_day_31_60 END) AS not_at_risk_31_60,
                AVG(CASE WHEN predicted_risk_status = 'Not At Risk' THEN clicks_day_61_90 END) AS not_at_risk_61_90
            FROM predictions
        """).fetchone()

        engagement_trend = [
            {
                "window": "Days 0-30",
                "at_risk": engagement_row["at_risk_0_30"],
                "not_at_risk": engagement_row["not_at_risk_0_30"],
            },
            {
                "window": "Days 31-60",
                "at_risk": engagement_row["at_risk_31_60"],
                "not_at_risk": engagement_row["not_at_risk_31_60"],
            },
            {
                "window": "Days 61-90",
                "at_risk": engagement_row["at_risk_61_90"],
                "not_at_risk": engagement_row["not_at_risk_61_90"],
            },
        ]

        submission_health = rows_to_dicts(conn.execute("""
            SELECT 'Strong submission rate' AS status, COUNT(*) AS learners
            FROM predictions
            WHERE COALESCE(early_submission_rate, 0) >= 0.80

            UNION ALL

            SELECT 'Partial submission rate' AS status, COUNT(*) AS learners
            FROM predictions
            WHERE COALESCE(early_submission_rate, 0) >= 0.50
              AND COALESCE(early_submission_rate, 0) < 0.80

            UNION ALL

            SELECT 'Low submission rate' AS status, COUNT(*) AS learners
            FROM predictions
            WHERE COALESCE(early_submission_rate, 0) < 0.50
        """).fetchall())

        submission_flags = rows_to_dicts(conn.execute("""
            SELECT 'Missing assessments' AS flag, COUNT(*) AS learners
            FROM predictions
            WHERE COALESCE(early_missing_assessments, 0) > 0

            UNION ALL

            SELECT 'Late submissions' AS flag, COUNT(*) AS learners
            FROM predictions
            WHERE COALESCE(early_late_submissions, 0) > 0
        """).fetchall())

    return {
        "cohort": dict(cohort_row) if cohort_row else {},
        "module_presentation_risk": module_presentation_risk,
        "engagement_trend": engagement_trend,
        "submission_health": submission_health,
        "submission_flags": submission_flags,
    }

def get_intervention_summary():
    """
    Compatibility endpoint for Overview/Dashboard only.
    Do not use this for the Interventions page.
    """
    with get_connection() as conn:
        risk_level_summary = rows_to_dicts(conn.execute("""
            SELECT 
                CASE p.risk_level
                    WHEN 'High' THEN 'High Predicted Risk'
                    WHEN 'Moderate' THEN 'Moderate Predicted Risk'
                    WHEN 'Low' THEN 'Low Predicted Risk'
                    ELSE p.risk_level
                END AS predicted_risk_level,
                COUNT(*) AS students,
                SUM(CASE WHEN p.risk_status = 'At Risk' THEN 1 ELSE 0 END) AS actual_at_risk_students,
                SUM(CASE WHEN l.gender = 'M' THEN 1 ELSE 0 END) AS male_learners,
                SUM(CASE WHEN l.gender = 'F' THEN 1 ELSE 0 END) AS female_learners
            FROM predictions p
            JOIN learners l ON l.student_record_key = p.student_record_key
            GROUP BY p.risk_level
            ORDER BY 
                CASE p.risk_level
                    WHEN 'High' THEN 1
                    WHEN 'Moderate' THEN 2
                    WHEN 'Low' THEN 3
                    ELSE 4
                END
        """).fetchall())

        prediction_status_distribution = rows_to_dicts(conn.execute("""
            SELECT 
                p.predicted_risk_status,
                COUNT(*) AS students,
                SUM(CASE WHEN l.gender = 'M' THEN 1 ELSE 0 END) AS male_learners,
                SUM(CASE WHEN l.gender = 'F' THEN 1 ELSE 0 END) AS female_learners
            FROM predictions p
            JOIN learners l ON l.student_record_key = p.student_record_key
            GROUP BY p.predicted_risk_status
            ORDER BY students DESC
        """).fetchall())

    return {
        "risk_level_summary": risk_level_summary,
        "prediction_status_distribution": prediction_status_distribution,
        "intervention_summary": risk_level_summary,
        "items": risk_level_summary,
    }


def get_interventions_action_centre():
    """
    Dedicated endpoint for the Interventions page.
    This is action-focused and does not serve dashboard summary charts.
    """
    with get_connection() as conn:
        priority_queue = rows_to_dicts(conn.execute("""
            SELECT
                l.student_record_key,
                l.id_student,
                l.code_module,
                l.code_presentation,
                l.region,
                p.risk_level,
                p.predicted_risk_status,
                p.predicted_risk_probability,
                p.early_submission_rate,
                p.early_missing_assessments,
                p.early_late_submissions,
                p.early_avg_score,
                p.early_total_clicks,
                p.observed_risk_factors,
                p.recommended_interventions,
                p.ai_support_summary,

                TRIM(
                    COALESCE(
                        CASE 
                            WHEN COALESCE(p.early_missing_assessments, 0) > 0 
                            THEN 'Missing assessments|' 
                        END, ''
                    ) ||
                    COALESCE(
                        CASE 
                            WHEN COALESCE(p.early_submission_rate, 1) < 0.50 
                            THEN 'Low submission rate|' 
                        END, ''
                    ) ||
                    COALESCE(
                        CASE 
                            WHEN COALESCE(p.early_avg_score, 100) < 40 
                            THEN 'Low early score|' 
                        END, ''
                    ) ||
                    COALESCE(
                        CASE 
                            WHEN COALESCE(p.early_total_clicks, 999999) < 50 
                            THEN 'Low engagement|' 
                        END, ''
                    ) ||
                    COALESCE(
                        CASE 
                            WHEN COALESCE(p.early_late_submissions, 0) > 0 
                            THEN 'Late submissions|' 
                        END, ''
                    ),
                    '|'
                ) AS reason_tags,

                CASE
                    WHEN COALESCE(p.early_missing_assessments, 0) > 0 THEN 'Review missed assessments and contact learner directly.'
                    WHEN COALESCE(p.early_submission_rate, 1) < 0.50 THEN 'Address assessment submission behaviour and agree recovery steps.'
                    WHEN COALESCE(p.early_avg_score, 100) < 40 THEN 'Refer for academic support and review early assessment performance.'
                    WHEN COALESCE(p.early_total_clicks, 999999) < 50 THEN 'Check engagement and encourage structured VLE activity.'
                    WHEN COALESCE(p.early_late_submissions, 0) > 0 THEN 'Discuss late submissions and agree a follow-up plan.'
                    ELSE 'Assign adviser review based on risk priority.'
                END AS recommended_action
            FROM predictions p
            JOIN learners l ON l.student_record_key = p.student_record_key
            WHERE p.risk_level IN ('High', 'Moderate')
            ORDER BY
                CASE p.risk_level WHEN 'High' THEN 1 WHEN 'Moderate' THEN 2 ELSE 3 END,
                p.predicted_risk_probability DESC
            LIMIT 30
        """).fetchall())

        workload_by_module = rows_to_dicts(conn.execute("""
            SELECT
                l.code_module,
                COUNT(*) AS high_risk_learners
            FROM predictions p
            JOIN learners l ON l.student_record_key = p.student_record_key
            WHERE p.risk_level = 'High'
            GROUP BY l.code_module
            ORDER BY high_risk_learners DESC
        """).fetchall())

        workload_by_region = rows_to_dicts(conn.execute("""
            SELECT
                l.region,
                COUNT(*) AS high_risk_learners
            FROM predictions p
            JOIN learners l ON l.student_record_key = p.student_record_key
            WHERE p.risk_level = 'High'
              AND l.region IS NOT NULL
              AND l.region <> ''
            GROUP BY l.region
            ORDER BY high_risk_learners DESC
            LIMIT 10
        """).fetchall())

        reason_summary = rows_to_dicts(conn.execute("""
            SELECT 'Missing assessments' AS reason, COUNT(*) AS learners
            FROM predictions
            WHERE risk_level IN ('High', 'Moderate')
              AND COALESCE(early_missing_assessments, 0) > 0

            UNION ALL

            SELECT 'Low submission rate' AS reason, COUNT(*) AS learners
            FROM predictions
            WHERE risk_level IN ('High', 'Moderate')
              AND COALESCE(early_submission_rate, 1) < 0.50

            UNION ALL

            SELECT 'Low early score' AS reason, COUNT(*) AS learners
            FROM predictions
            WHERE risk_level IN ('High', 'Moderate')
              AND COALESCE(early_avg_score, 100) < 40

            UNION ALL

            SELECT 'Low engagement' AS reason, COUNT(*) AS learners
            FROM predictions
            WHERE risk_level IN ('High', 'Moderate')
              AND COALESCE(early_total_clicks, 999999) < 50

            UNION ALL

            SELECT 'Late submissions' AS reason, COUNT(*) AS learners
            FROM predictions
            WHERE risk_level IN ('High', 'Moderate')
              AND COALESCE(early_late_submissions, 0) > 0

            ORDER BY learners DESC
        """).fetchall())

    return {
        "priority_queue": priority_queue,
        "workload_by_module": workload_by_module,
        "workload_by_region": workload_by_region,
        "reason_summary": reason_summary,
    }


def build_local_assistant_response(student_record_key: str, question: Optional[str] = None):
    question_text = (question or "").lower().strip()

    student = get_student(student_record_key) if student_record_key else None
    summary = get_summary()

    if "model" in question_text or "gradient" in question_text or "performance" in question_text:
        model_info = get_model_performance()
        answer = model_info["selection_reason"]

    elif "risk factor" in question_text or "factor" in question_text or "explain" in question_text:
        if student:
            answer = (
                f"The learner is classified as {student.get('risk_level')} risk with a "
                f"predicted risk probability of {student.get('predicted_risk_probability')}. "
                f"Observed risk factors include: {student.get('observed_risk_factors')}."
            )
        else:
            answer = (
                "The main risk factors are linked to assessment behaviour, early submission "
                "patterns, VLE engagement, active learning days, previous attempts, and "
                "educational background."
            )

    elif "intervention" in question_text or "support" in question_text or "recommend" in question_text:
        if student:
            answer = (
                f"Recommended support action: {student.get('recommended_interventions')}. "
                "The intervention should be prioritised based on the learner's risk level."
            )
        else:
            answer = (
                "High-risk learners should receive urgent academic support, moderate-risk "
                "learners should be monitored and followed up, and low-risk learners should "
                "continue receiving normal academic support."
            )

    elif "summary" in question_text or "distribution" in question_text or "dashboard" in question_text:
        answer = (
            f"The system analysed {summary['total_learners']:,} learners. "
            f"{summary['high_predicted_risk']:,} are classified as high risk, "
            f"{summary['moderate_predicted_risk']:,} as moderate risk, and "
            f"{summary['low_predicted_risk']:,} as low risk."
        )

    else:
        if student:
            answer = (
                f"This learner is currently classified as {student.get('risk_level')} risk. "
                f"The predicted risk status is {student.get('predicted_risk_status')} with "
                f"a probability score of {student.get('predicted_risk_probability')}. "
                f"Suggested intervention: {student.get('recommended_interventions')}."
            )
        else:
            answer = (
                "This portal supports early identification of learners who may be at risk. "
                "It can summarise risk distribution, explain model performance, identify "
                "risk factors, and suggest intervention actions."
            )

    return {
        "student_record_key": student_record_key,
        "question": question,
        "answer": answer,
        "response": answer,
    }


def get_model_evaluation_page():
    """
    Dedicated data endpoint for the Model Evaluation page.
    Reads model_results robustly and calculates missing metrics from TP/FP/TN/FN.
    """

    def normalise_key(value):
        return (
            str(value or "")
            .strip()
            .lower()
            .replace(" ", "_")
            .replace("-", "_")
            .replace(".", "_")
        )

    def row_lookup(row):
        return {normalise_key(key): row[key] for key in row.keys()}

    def get_value(row_map, names, default=0):
        for name in names:
            key = normalise_key(name)
            if key in row_map and row_map[key] is not None:
                return row_map[key]
        return default

    def to_float(value, default=0.0):
        try:
            return float(value)
        except Exception:
            return default

    def to_int(value, default=0):
        try:
            return int(float(value))
        except Exception:
            return default

    def clean_model_id(value):
        return normalise_key(value)

    def display_model_name(value):
        model_id = clean_model_id(value)
        names = {
            "logistic_regression": "Logistic Regression",
            "random_forest": "Random Forest",
            "gradient_boosting": "Gradient Boosting",
            "gradientboosting": "Gradient Boosting",
        }
        return names.get(model_id, str(value or "Model").replace("_", " ").title())

    def safe_divide(numerator, denominator):
        denominator = float(denominator or 0)
        if denominator == 0:
            return 0.0
        return float(numerator or 0) / denominator

    with get_connection() as conn:
        raw_rows = conn.execute("""
            SELECT *
            FROM model_results
        """).fetchall()

        models = []

        for raw_row in raw_rows:
            row = row_lookup(raw_row)

            model_raw = get_value(
                row,
                ["model_name", "model", "algorithm", "name", "classifier"],
                "",
            )

            tp = to_int(get_value(row, ["true_positive", "true_positives", "tp"], 0))
            fp = to_int(get_value(row, ["false_positive", "false_positives", "fp"], 0))
            tn = to_int(get_value(row, ["true_negative", "true_negatives", "tn"], 0))
            fn = to_int(get_value(row, ["false_negative", "false_negatives", "fn"], 0))

            accuracy = to_float(get_value(row, ["accuracy", "acc"], 0))
            precision = to_float(get_value(row, ["precision", "prec"], 0))
            recall = to_float(get_value(row, ["recall", "sensitivity"], 0))
            f1_score = to_float(get_value(row, ["f1_score", "f1", "f1score"], 0))

            # If any metric is missing or returned as 0, calculate it from confusion matrix.
            if accuracy == 0 and (tp + fp + tn + fn) > 0:
                accuracy = safe_divide(tp + tn, tp + fp + tn + fn)

            if precision == 0 and (tp + fp) > 0:
                precision = safe_divide(tp, tp + fp)

            if recall == 0 and (tp + fn) > 0:
                recall = safe_divide(tp, tp + fn)

            if f1_score == 0 and (precision + recall) > 0:
                f1_score = 2 * precision * recall / (precision + recall)

            model_id = clean_model_id(model_raw)

            models.append({
                "model_id": model_id,
                "model_name": display_model_name(model_raw),
                "accuracy": accuracy,
                "precision": precision,
                "recall": recall,
                "f1_score": f1_score,
                "true_positive": tp,
                "false_positive": fp,
                "true_negative": tn,
                "false_negative": fn,
            })

        selected = next((m for m in models if m["model_id"] in ["gradient_boosting", "gradientboosting"]), None)

        if selected is None and models:
            selected = sorted(
                models,
                key=lambda m: (
                    m["false_negative"],
                    -m["true_positive"],
                    -m["recall"],
                    -m["accuracy"],
                ),
            )[0]

        for model in models:
            model["selected"] = bool(selected and model["model_id"] == selected["model_id"])

        runner_up = None
        if selected:
            alternatives = [m for m in models if m["model_id"] != selected["model_id"]]
            if alternatives:
                runner_up = sorted(
                    alternatives,
                    key=lambda m: (
                        m["false_negative"],
                        -m["true_positive"],
                        -m["recall"],
                        -m["accuracy"],
                    ),
                )[0]

        feature_importance = []

        exists = conn.execute("""
            SELECT name
            FROM sqlite_master
            WHERE type = 'table'
              AND name = 'feature_importance'
        """).fetchone()

        if exists:
            feature_rows = conn.execute("""
                SELECT *
                FROM feature_importance
                LIMIT 20
            """).fetchall()

            cleaned_features = []

            for raw_feature in feature_rows:
                feature_map = row_lookup(raw_feature)

                feature = get_value(
                    feature_map,
                    ["feature", "feature_name", "variable", "name"],
                    "",
                )

                importance = to_float(
                    get_value(
                        feature_map,
                        ["importance", "feature_importance", "normalized_importance", "weight"],
                        0,
                    )
                )

                if feature:
                    cleaned_features.append({
                        "feature": str(feature).replace("_", " ").title().replace("Vle", "VLE"),
                        "importance": importance,
                    })

            total = sum(abs(row["importance"]) for row in cleaned_features) or 1

            feature_importance = [
                {
                    "feature": row["feature"],
                    "importance": row["importance"],
                    "weight": row["importance"] * 100 if row["importance"] <= 1 else (row["importance"] / total) * 100,
                }
                for row in sorted(cleaned_features, key=lambda x: x["importance"], reverse=True)[:10]
            ]

    return {
        "models": models,
        "selected_model": selected,
        "runner_up": runner_up,
        "feature_importance": feature_importance,
        "selection_note": "Gradient Boosting is selected because it provides the strongest protection against missed at-risk learners.",
    }


def get_portal_assistant_response(question: str):
    """
    Scoped assistant for the Student Early Warning Portal.
    Handles greetings, learner ID breakdowns, model questions, intervention questions and overview questions.
    """
    import re

    q = str(question or "").strip()
    q_lower = q.lower().strip()

    suggestions = [
        "Break down learner ID ",
        "Which module has the most high-risk learners?",
        "Which region has the highest support workload?",
        "How many false negatives did the selected model produce?",
        "Why was Gradient Boosting selected?",
        "What action should staff take for high-risk learners?",
        "Show learners with missing assessments and low engagement.",
        "What does high risk mean?",
    ]

    greeting_words = {
        "hi", "hello", "hey", "good morning", "good afternoon", "good evening",
        "morning", "afternoon", "evening", "yo"
    }

    clean_greeting = re.sub(r"[^a-z\s]", "", q_lower).strip()

    if not q_lower or clean_greeting in greeting_words:
        return {
            "answer": "Hello. I can help you with learner risk, intervention priorities, model evaluation and overview insights. Here are examples of what you can ask:",
            "suggestions": suggestions,
            "items": [],
            "breakdown": [],
        }

    def fmt(value):
        if value is None or value == "":
            return "—"
        return str(value)

    def pct(value):
        try:
            return f"{round(float(value) * 100)}%"
        except Exception:
            return "—"

    def get_columns(conn, table_name):
        return {row["name"] for row in conn.execute(f"PRAGMA table_info({table_name})").fetchall()}

    def build_select(learner_cols, prediction_cols):
        wanted = [
            "student_record_key",
            "id_student",
            "code_module",
            "code_presentation",
            "gender",
            "region",
            "highest_education",
            "imd_band",
            "age_band",
            "num_of_prev_attempts",
            "studied_credits",
            "disability",
            "final_result",
            "risk_level",
            "predicted_risk_status",
            "predicted_risk_probability",
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

        fields = []
        for col in wanted:
            if col in learner_cols:
                fields.append(f"l.{col} AS {col}")
            elif col in prediction_cols:
                fields.append(f"p.{col} AS {col}")

        return ",\n                ".join(fields)

    # Extract actual learner ID candidates.
    # This supports: "break down learner ID 123456", "learner 123456", or just "123456".
    candidates = []

    after_id = re.findall(
        r"(?:learner|student|id|record|key|breakdown|break down)\s*(?:id|key)?\s*[:#-]?\s*([A-Za-z0-9_:\-]{4,})",
        q,
        flags=re.IGNORECASE,
    )

    numeric_tokens = re.findall(r"\b\d{4,}\b", q)

    for item in after_id + numeric_tokens:
        cleaned = item.strip().strip(".,;:")
        if cleaned and cleaned.lower() not in {
            "learner", "student", "breakdown", "break", "down", "risk", "module"
        }:
            candidates.append(cleaned)

    seen = set()
    candidates = [x for x in candidates if not (x in seen or seen.add(x))]

    allowed_keywords = [
        "student", "learner", "id", "breakdown", "break down", "risk", "high", "moderate", "low",
        "module", "course", "presentation", "region", "intervention", "support",
        "assessment", "missing", "late", "submission", "engagement", "click", "vle",
        "model", "gradient", "boosting", "random forest", "logistic", "accuracy",
        "precision", "recall", "false negative", "false positive", "fail", "withdraw",
        "overview", "cohort", "performance", "action"
    ]

    if not any(word in q_lower for word in allowed_keywords) and not candidates:
        return {
            "answer": "Sorry, I can only help with this Student Early Warning Portal. Here are examples of what I can help with:",
            "suggestions": suggestions,
            "items": [],
            "breakdown": [],
        }

    with get_connection() as conn:
        # Learner breakdown
        if candidates:
            learner_cols = get_columns(conn, "learners")
            prediction_cols = get_columns(conn, "predictions")
            select_sql = build_select(learner_cols, prediction_cols)

            for candidate in candidates:
                rows = rows_to_dicts(conn.execute(f"""
                    SELECT
                        {select_sql}
                    FROM learners l
                    JOIN predictions p ON l.student_record_key = p.student_record_key
                    WHERE CAST(l.id_student AS TEXT) = ?
                       OR CAST(l.student_record_key AS TEXT) = ?
                    LIMIT 1
                """, (candidate, candidate)).fetchall())

                if rows:
                    row = rows[0]

                    breakdown = [
                        {"label": "Learner ID", "value": fmt(row.get("id_student"))},
                        {"label": "Student Record Key", "value": fmt(row.get("student_record_key"))},
                        {"label": "Module", "value": fmt(row.get("code_module"))},
                        {"label": "Presentation", "value": fmt(row.get("code_presentation"))},
                        {"label": "Region", "value": fmt(row.get("region"))},
                        {"label": "Gender", "value": fmt(row.get("gender"))},
                        {"label": "Education", "value": fmt(row.get("highest_education"))},
                        {"label": "Age Band", "value": fmt(row.get("age_band"))},
                        {"label": "Previous Attempts", "value": fmt(row.get("num_of_prev_attempts"))},
                        {"label": "Risk Level", "value": fmt(row.get("risk_level"))},
                        {"label": "Prediction", "value": fmt(row.get("predicted_risk_status"))},
                        {"label": "Risk Probability", "value": pct(row.get("predicted_risk_probability"))},
                        {"label": "Final Result", "value": fmt(row.get("final_result"))},
                        {"label": "Submission Rate", "value": pct(row.get("early_submission_rate"))},
                        {"label": "Assessments Submitted", "value": fmt(row.get("early_assessments_submitted"))},
                        {"label": "Missing Assessments", "value": fmt(row.get("early_missing_assessments"))},
                        {"label": "Late Submissions", "value": fmt(row.get("early_late_submissions"))},
                        {"label": "Early Average Score", "value": fmt(row.get("early_avg_score"))},
                        {"label": "Total Clicks", "value": fmt(row.get("early_total_clicks"))},
                        {"label": "Clicks Day 0-30", "value": fmt(row.get("clicks_day_0_30"))},
                        {"label": "Clicks Day 31-60", "value": fmt(row.get("clicks_day_31_60"))},
                        {"label": "Clicks Day 61-90", "value": fmt(row.get("clicks_day_61_90"))},
                        {"label": "Active Days", "value": fmt(row.get("early_active_days"))},
                        {"label": "Risk Factors", "value": fmt(row.get("observed_risk_factors"))},
                        {"label": "Recommended Action", "value": fmt(row.get("recommended_interventions") or row.get("ai_support_summary"))},
                    ]

                    breakdown = [
                        item for item in breakdown
                        if item["value"] not in ["—", "None", "none", "null", ""]
                    ]

                    answer = (
                        f"Learner {fmt(row.get('id_student'))} is {fmt(row.get('risk_level'))} risk "
                        f"in {fmt(row.get('code_module'))} / {fmt(row.get('code_presentation'))}. "
                        f"The predicted risk probability is {pct(row.get('predicted_risk_probability'))}."
                    )

                    return {
                        "answer": answer,
                        "suggestions": suggestions,
                        "items": [],
                        "breakdown": breakdown,
                    }

            return {
                "answer": f"I could not find a learner record for ID/key: {candidates[0]}. Please copy the learner ID exactly from the Learners table.",
                "suggestions": suggestions,
                "items": [],
                "breakdown": [],
            }

        if "learner" in q_lower or "student" in q_lower or "breakdown" in q_lower or "break down" in q_lower:
            return {
                "answer": "Please provide the learner ID. Example: Break down learner ID 123456.",
                "suggestions": suggestions,
                "items": [],
                "breakdown": [],
            }

        if "module" in q_lower and ("most" in q_lower or "highest" in q_lower or "high-risk" in q_lower or "high risk" in q_lower):
            rows = rows_to_dicts(conn.execute("""
                SELECT
                    l.code_module,
                    COUNT(*) AS high_risk_learners
                FROM predictions p
                JOIN learners l ON l.student_record_key = p.student_record_key
                WHERE p.risk_level = 'High'
                GROUP BY l.code_module
                ORDER BY high_risk_learners DESC
                LIMIT 5
            """).fetchall())

            top = rows[0] if rows else None

            return {
                "answer": (
                    f"{top['code_module']} has the highest high-risk workload with {top['high_risk_learners']:,} learners."
                    if top else
                    "I could not find module workload data."
                ),
                "suggestions": suggestions,
                "items": rows,
                "breakdown": [],
            }

        if "region" in q_lower and ("most" in q_lower or "highest" in q_lower or "workload" in q_lower):
            rows = rows_to_dicts(conn.execute("""
                SELECT
                    l.region,
                    COUNT(*) AS high_risk_learners
                FROM predictions p
                JOIN learners l ON l.student_record_key = p.student_record_key
                WHERE p.risk_level = 'High'
                  AND l.region IS NOT NULL
                  AND l.region <> ''
                GROUP BY l.region
                ORDER BY high_risk_learners DESC
                LIMIT 5
            """).fetchall())

            top = rows[0] if rows else None

            return {
                "answer": (
                    f"{top['region']} has the highest support workload with {top['high_risk_learners']:,} high-risk learners."
                    if top else
                    "I could not find region workload data."
                ),
                "suggestions": suggestions,
                "items": rows,
                "breakdown": [],
            }

        if "false negative" in q_lower or "missed" in q_lower:
            rows = rows_to_dicts(conn.execute("""
                SELECT *
                FROM model_results
            """).fetchall())

            cleaned = []
            for row in rows:
                model_name = row.get("model_name") or row.get("model") or row.get("algorithm") or row.get("name") or "Model"
                false_negative = row.get("false_negative") or row.get("false_negatives") or row.get("fn") or 0

                cleaned.append({
                    "model_name": str(model_name).replace("_", " ").title(),
                    "false_negative": int(float(false_negative or 0)),
                })

            cleaned = sorted(cleaned, key=lambda x: x["false_negative"])
            selected = next(
                (row for row in cleaned if "Gradient" in row["model_name"] and "Boost" in row["model_name"]),
                cleaned[0] if cleaned else None,
            )

            return {
                "answer": (
                    f"The selected model has {selected['false_negative']:,} false negatives. False negatives matter because they are learners who needed support but were not flagged."
                    if selected else
                    "I could not find false-negative data."
                ),
                "suggestions": suggestions,
                "items": cleaned,
                "breakdown": [],
            }

        if "gradient" in q_lower or "selected" in q_lower or ("why" in q_lower and "model" in q_lower):
            return {
                "answer": "Gradient Boosting was selected because this project prioritises reducing missed at-risk learners, not only maximising overall accuracy.",
                "suggestions": suggestions,
                "items": [],
                "breakdown": [],
            }

        if "high" in q_lower and ("action" in q_lower or "support" in q_lower or "intervention" in q_lower):
            return {
                "answer": "High-risk learners should receive direct contact, academic adviser follow-up, review of missing or late assessments, and weekly progress tracking.",
                "suggestions": suggestions,
                "items": [],
                "breakdown": [],
            }

        if "missing" in q_lower or "low engagement" in q_lower or "low clicks" in q_lower:
            rows = rows_to_dicts(conn.execute("""
                SELECT
                    l.id_student,
                    l.code_module,
                    l.code_presentation,
                    l.region,
                    p.risk_level,
                    p.early_missing_assessments,
                    p.early_total_clicks,
                    p.recommended_interventions
                FROM predictions p
                JOIN learners l ON l.student_record_key = p.student_record_key
                WHERE COALESCE(p.early_missing_assessments, 0) > 0
                   OR COALESCE(p.early_total_clicks, 999999) < 50
                ORDER BY
                    CASE p.risk_level WHEN 'High' THEN 1 WHEN 'Moderate' THEN 2 ELSE 3 END,
                    p.early_missing_assessments DESC,
                    p.early_total_clicks ASC
                LIMIT 8
            """).fetchall())

            return {
                "answer": f"I found {len(rows)} priority examples with missing assessments or low engagement.",
                "suggestions": suggestions,
                "items": rows,
                "breakdown": [],
            }

    return {
        "answer": "I can help with learner risk, support workload, intervention actions, model evaluation and overview analytics. Try one of the questions below.",
        "suggestions": suggestions,
        "items": [],
        "breakdown": [],
    }

