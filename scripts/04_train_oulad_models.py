from pathlib import Path
import json
import joblib
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


DATA_PATH = Path("data/processed/oulad/oulad_student_features.csv")

MODELS_DIR = Path("models/oulad")
REPORTS_DIR = Path("outputs/reports/oulad")
FIGURES_DIR = Path("outputs/figures/oulad")

MODELS_DIR.mkdir(parents=True, exist_ok=True)
REPORTS_DIR.mkdir(parents=True, exist_ok=True)
FIGURES_DIR.mkdir(parents=True, exist_ok=True)

df = pd.read_csv(DATA_PATH)

TARGET = "risk_label"

# Columns that must not be used as model inputs.
# Some are identifiers; some are direct outcomes; some are leakage risks.
DROP_COLUMNS = [
    "student_record_key",
    "id_student",
    "final_result",
    "final_result_group",
    "risk_label",
    "risk_status",
    "actual_outcome_group",
]

# These columns may not exist in the final processed table, but are listed for safety.
LEAKAGE_COLUMNS = [
    "date_unregistration",
]

DROP_COLUMNS = DROP_COLUMNS + [col for col in LEAKAGE_COLUMNS if col in df.columns]

features = [col for col in df.columns if col not in DROP_COLUMNS]

X = df[features].copy()
y = df[TARGET].copy()


def make_one_hot_encoder():
    try:
        return OneHotEncoder(handle_unknown="ignore", sparse_output=False)
    except TypeError:
        return OneHotEncoder(handle_unknown="ignore", sparse=False)


def build_preprocessor(X_input):
    categorical_cols = X_input.select_dtypes(include=["object"]).columns.tolist()
    numeric_cols = X_input.select_dtypes(exclude=["object"]).columns.tolist()

    preprocessor = ColumnTransformer(
        transformers=[
            ("numeric", StandardScaler(), numeric_cols),
            ("categorical", make_one_hot_encoder(), categorical_cols),
        ],
        remainder="drop",
    )

    return preprocessor, numeric_cols, categorical_cols


def get_models():
    return {
        "logistic_regression": LogisticRegression(
            max_iter=3000,
            class_weight="balanced",
            random_state=42,
        ),
        "random_forest": RandomForestClassifier(
            n_estimators=250,
            max_depth=14,
            min_samples_split=8,
            min_samples_leaf=4,
            class_weight="balanced",
            n_jobs=-1,
            random_state=42,
        ),
        "gradient_boosting": GradientBoostingClassifier(
            random_state=42,
        ),
    }


def save_confusion_matrix_plot(cm, title, filename):
    plt.figure(figsize=(6, 5))
    sns.heatmap(
        cm,
        annot=True,
        fmt="d",
        cmap="Blues",
        xticklabels=["Not At Risk", "At Risk"],
        yticklabels=["Not At Risk", "At Risk"],
    )
    plt.title(title)
    plt.xlabel("Predicted")
    plt.ylabel("Actual")
    plt.tight_layout()
    plt.savefig(filename, dpi=300)
    plt.close()


print("=" * 80)
print("OULAD MODEL TRAINING STARTED")
print("=" * 80)

print("\nDataset shape:", df.shape)

print("\nTarget distribution:")
print(y.value_counts())

print("\nTarget distribution percentage:")
print((y.value_counts(normalize=True) * 100).round(2))

preprocessor, numeric_cols, categorical_cols = build_preprocessor(X)

print("\nNumber of input features before encoding:", len(features))
print("\nNumeric columns:")
print(numeric_cols)
print("\nCategorical columns:")
print(categorical_cols)

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.25,
    random_state=42,
    stratify=y,
)

all_results = []
best_model_info = None

for model_name, model in get_models().items():
    print("\n" + "=" * 80)
    print(f"Training OULAD model: {model_name}")
    print("=" * 80)

    pipeline = Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("model", model),
        ]
    )

    pipeline.fit(X_train, y_train)

    y_pred = pipeline.predict(X_test)

    if hasattr(pipeline.named_steps["model"], "predict_proba"):
        y_proba = pipeline.predict_proba(X_test)[:, 1]
        roc_auc = roc_auc_score(y_test, y_proba)
    else:
        y_proba = None
        roc_auc = None

    accuracy = accuracy_score(y_test, y_pred)
    precision = precision_score(y_test, y_pred, zero_division=0)
    recall = recall_score(y_test, y_pred, zero_division=0)
    f1 = f1_score(y_test, y_pred, zero_division=0)
    cm = confusion_matrix(y_test, y_pred)

    result = {
        "dataset": "OULAD",
        "model_name": model_name,
        "accuracy": round(accuracy, 4),
        "precision_at_risk": round(precision, 4),
        "recall_at_risk": round(recall, 4),
        "f1_at_risk": round(f1, 4),
        "roc_auc": round(roc_auc, 4) if roc_auc is not None else None,
        "true_negative": int(cm[0, 0]),
        "false_positive": int(cm[0, 1]),
        "false_negative": int(cm[1, 0]),
        "true_positive": int(cm[1, 1]),
        "number_of_input_features": len(features),
    }

    all_results.append(result)

    report_text = classification_report(
        y_test,
        y_pred,
        target_names=["Not At Risk", "At Risk"],
        zero_division=0,
    )

    report_path = REPORTS_DIR / f"oulad_classification_report_{model_name}.txt"
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(report_text)

    cm_path = FIGURES_DIR / f"oulad_confusion_matrix_{model_name}.png"
    save_confusion_matrix_plot(
        cm,
        f"OULAD Confusion Matrix: {model_name}",
        cm_path,
    )

    model_path = MODELS_DIR / f"oulad_{model_name}.joblib"
    joblib.dump(pipeline, model_path)

    print("Metrics:")
    print(result)

    print("\nClassification report:")
    print(report_text)

    # Selection prioritises recall, then F1, then ROC-AUC.
    ranking_tuple = (recall, f1, roc_auc if roc_auc is not None else 0)

    if best_model_info is None or ranking_tuple > best_model_info["ranking_tuple"]:
        best_model_info = {
            "model_name": model_name,
            "model_file": str(model_path),
            "features": features,
            "ranking_tuple": ranking_tuple,
            "metrics": result,
        }


results_df = pd.DataFrame(all_results)
results_path = REPORTS_DIR / "oulad_model_comparison_results.csv"
results_df.to_csv(results_path, index=False)

metadata = {
    "dataset": "OULAD",
    "target": TARGET,
    "positive_class": "At Risk",
    "positive_class_value": 1,
    "target_definition": {
        "At Risk": ["Fail", "Withdrawn"],
        "Not At Risk": ["Pass", "Distinction"],
    },
    "selection_rule": "Models ranked primarily by recall for the At Risk class, then F1-score, then ROC-AUC.",
    "excluded_columns": DROP_COLUMNS,
    "leakage_controls": [
        "final_result was excluded from model features.",
        "risk_status and risk_label were excluded from model features.",
        "student identifiers were excluded from model features.",
        "date_unregistration was excluded because it directly reveals withdrawal behaviour.",
        "Only engineered early activity and assessment features from the first 90 days were used.",
    ],
    "best_model": {
        "model_name": best_model_info["model_name"],
        "model_file": best_model_info["model_file"],
        "features": best_model_info["features"],
        "metrics": best_model_info["metrics"],
    },
}

metadata_path = REPORTS_DIR / "oulad_selected_model_metadata.json"
with open(metadata_path, "w", encoding="utf-8") as f:
    json.dump(metadata, f, indent=4)

print("\n" + "=" * 80)
print("OULAD MODEL COMPARISON RESULTS")
print("=" * 80)
print(results_df.sort_values(["recall_at_risk", "f1_at_risk", "roc_auc"], ascending=False))

print("\nBest OULAD model:")
print(metadata["best_model"])

print("\nSaved model comparison to:", results_path)
print("Saved metadata to:", metadata_path)
print("Saved models to:", MODELS_DIR)

print("\nOULAD MODEL TRAINING COMPLETED SUCCESSFULLY")
