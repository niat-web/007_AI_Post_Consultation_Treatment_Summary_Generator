import argparse

from app import create_app
from database.db import db
from database.models import Template


DEFAULT_TEMPLATES = [
    {
        "title": "Viral Fever",
        "complaint": "Fever, body pains, and tiredness for 2-3 days.",
        "diagnosis": "Likely viral fever.",
        "treatment": "Drink plenty of fluids, take fever medicine as advised, and rest.",
        "followup": "Come back if fever lasts more than 3 days or symptoms worsen.",
    },
    {
        "title": "Gastritis",
        "complaint": "Burning stomach pain, acidity, nausea, or discomfort after food.",
        "diagnosis": "Gastritis or acidity-related stomach irritation.",
        "treatment": "Avoid spicy food, eat small meals, and take prescribed antacid medicine.",
        "followup": "Review if pain is severe, vomiting continues, or black stools occur.",
    },
    {
        "title": "Upper Respiratory Infection",
        "complaint": "Cough, cold, sore throat, blocked nose, or mild fever.",
        "diagnosis": "Upper respiratory tract infection.",
        "treatment": "Steam inhalation, warm fluids, rest, and medicines as prescribed.",
        "followup": "Return if breathing difficulty, high fever, or chest pain develops.",
    },
]


def seed_templates() -> int:
    created = 0

    for item in DEFAULT_TEMPLATES:
        exists = Template.query.filter_by(title=item["title"]).first()
        if exists:
            continue

        db.session.add(Template(**item))
        created += 1

    db.session.commit()
    return created


def init_db(seed: bool = True) -> None:
    app = create_app()

    with app.app_context():
        db.create_all()
        print("Database tables created.")

        if seed:
            created = seed_templates()
            print(f"Template seed complete. Added {created} template(s).")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Initialize database tables.")
    parser.add_argument(
        "--no-seed",
        action="store_true",
        help="Create tables without inserting default templates.",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    init_db(seed=not args.no_seed)
