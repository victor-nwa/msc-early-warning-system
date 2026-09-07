from pathlib import Path
import json
import joblib
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

DATA_PATH = Path("data/processed/oulad/oulad_student_features.csv")
METADATA_PATH = Path("outputs/reports/oulad/oulad_selected_model_metadata.json")

REPORTS_DIR = Path("outputs/reports/oulad")
FIGURES_DIR = Path("outputs/figures/oulad")

REPORTS_DIR.mkdir(parents=True, exist_ok=True)
FIGURES_DIR.mkdir(parents=True, exist_ok=True)

df = pd.read_csv(DATA_PATH)

with open(METADATA_PATH, "r", encoding="utf-8") as f:
    metadata = json.load(f)

best_model_info = metadata["best_model"]
model_path = Path(best_model_info["model_file"])
pipeline = joblib.load(model_path)

print("=" * 80)
print("OULAD MODEL EXPLAINABILITY")
print("=" * 80)
print("Selected model:", best_model_info["model_name"])
print("Model file:", model_path)


def get_feature_names_from_pipeline(pipeline):
    preprocessor = pipeline.named_steps["preprocessor"]

    numeric_features = preprocessor.transformers_[0][2]
    categorical_features = preprocessor.transformers_[1][2]
    encoder = preprocessor.named_transformers_["categorical"]

    encoded_categorical_features = encoder.get_feature_names_out(categorical_features)

    return list(numeric_features) + list(encoded_categorical_features)


model = pipeline.named_steps["model"]

if not hasattr(model, "feature_importances_"):
    raise TypeError(
        "Selected model does not expose feature_importances_. "
        "Use a tree-based model or implement SHAP/LIME."
    )

feature_names = get_feature_names_from_pipeline(pipeline)
importance_values = model.feature_importances_

importance_df = pd.DataFrame({
    "feature": feature_names,
    "importance": importance_values,
})

importance_df = importance_df.sort_values("importance", ascending=False)

importance_path = REPORTS_DIR / "oulad_feature_importance.csv"
importance_df.to_csv(importance_path, index=False)

top_20 = importance_df.head(20)
top_20_path = REPORTS_DIR / "oulad_top_20_feature_importance.csv"
top_20.to_csv(top_20_path, index=False)

plt.figure(figsize=(10, 8))
plot_df = top_20.sort_values("importance", ascending=True)
sns.barplot(data=plot_df, x="importance", y="feature")
plt.title("OULAD Top 20 Feature Importances")
plt.xlabel("Importance")
plt.ylabel("Feature")
plt.tight_layout()
plt.savefig(FIGURES_DIR / "oulad_top_20_feature_importance.png", dpi=300)
plt.close()

# Group feature importances back into broader original feature families.
def feature_family(feature_name):
    known_prefixes = [
        "code_module",
        "code_presentation",
        "gender",
        "region",
        "highest_education",
        "imd_band",
        "age_band",
        "disability",
    ]

    for prefix in known_prefixes:
        if feature_name.startswith(prefix + "_"):
            return prefix

    return feature_name

importance_df["feature_family"] = importance_df["feature"].apply(feature_family)

family_importance = (
    importance_df
    .groupby("feature_family")["importance"]
    .sum()
    .reset_index()
    .sort_values("importance", ascending=False)
)

family_path = REPORTS_DIR / "oulad_feature_family_importance.csv"
family_importance.to_csv(family_path, index=False)

plt.figure(figsize=(10, 8))
family_plot = family_importance.head(20).sort_values("importance", ascending=True)
sns.barplot(data=family_plot, x="importance", y="feature_family")
plt.title("OULAD Top Feature Families")
plt.xlabel("Total Importance")
plt.ylabel("Feature Family")
plt.tight_layout()
plt.savefig(FIGURES_DIR / "oulad_feature_family_importance.png", dpi=300)
plt.close()

summary_text = f"""
OULAD Explainability Summary

Selected model:
{best_model_info["model_name"]}

Interpretation method:
The selected model is Gradient Boosting, so the first explainability layer uses the model's built-in feature_importances_ values.

How to read the values:
Feature importance scores indicate how much each feature contributed to the model's split decisions across the fitted ensemble.
Higher importance means the feature was more influential in the model's predictions.

Top 20 features:
{top_20.to_string(index=False)}

Top feature families:
{family_importance.head(20).to_string(index=False)}

Important caution:
Feature importance shows predictive influence, not direct causation.
The model should support staff review and should not be used as an automated decision-maker.

Ethical note:
Sensitive or contextual attributes should be interpreted carefully. The system should prioritise supportive intervention rather than punitive action.
"""

summary_path = REPORTS_DIR / "oulad_explainability_summary.txt"
with open(summary_path, "w", encoding="utf-8") as f:
    f.write(summary_text)

print("\nTop 20 feature importances:")
print(top_20.to_string(index=False))

print("\nTop feature families:")
print(family_importance.head(20).to_string(index=False))

print("\nSaved feature importance to:", importance_path)
print("Saved feature family importance to:", family_path)
print("Saved explainability summary to:", summary_path)
print("Saved figures to:", FIGURES_DIR)

print("\nOULAD MODEL EXPLAINABILITY COMPLETED SUCCESSFULLY")
