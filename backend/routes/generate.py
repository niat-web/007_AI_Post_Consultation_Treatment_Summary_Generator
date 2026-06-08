from flask import Blueprint, current_app, jsonify, request

from database.db import db
from database.models import Consultation, Medication, Summary
from llm import generate_patient_summary
from utils.validators import validate_generation_request


generate_bp = Blueprint("generate", __name__)


@generate_bp.post("/generate")
def generate_summary():
    data = request.get_json(silent=True) or {}
    errors = validate_generation_request(data)

    if errors:
        return jsonify({"errors": errors}), 400

    consultation = Consultation(
        patient_name=data["patient_name"],
        age=data["age"],
        complaint=data["complaint"],
        diagnosis=data["diagnosis"],
        treatment=data["treatment"],
        followup=data.get("followup"),
        speciality=data.get("speciality", "General Medicine"),
        language=data.get("language", "English"),
        understanding_level=data.get("understanding_level", "Simple"),
    )

    for item in data.get("medications", []):
        consultation.medications.append(
            Medication(
                medicine_name=item.get("name"),
                dose=item.get("dose"),
                frequency=item.get("frequency"),
                duration=item.get("duration"),
            )
        )

    summary_data = generate_patient_summary(data)
    summary = Summary(
        prompt_version=current_app.config["PROMPT_VERSION"],
        section1=summary_data["section1"],
        section2=summary_data["section2"],
        section3=summary_data["section3"],
        section4=summary_data["section4"],
        doctors_note=data.get("doctors_note", ""),
        full_summary=summary_data["full_summary"],
    )
    consultation.summaries.append(summary)

    db.session.add(consultation)
    db.session.commit()

    return jsonify(
        {
            "consultation_id": consultation.id,
            "summary_id": summary.id,
            "summary": summary.full_summary,
            "doctors_note": summary.doctors_note,
            "sections": {
                "section1": summary.section1,
                "section2": summary.section2,
                "section3": summary.section3,
                "section4": summary.section4,
            },
        }
    ), 201
