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

    summary_data = generate_patient_summary(data)

    return jsonify(
        {
            "consultation_id": None,
            "summary_id": None,
            "summary": summary_data["full_summary"],
            "doctors_note": data.get("doctors_note", ""),
            "sections": {
                "section1": summary_data["section1"],
                "section2": summary_data["section2"],
                "section3": summary_data["section3"],
                "section4": summary_data["section4"],
            },
        }
    ), 200
