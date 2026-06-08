from flask import Blueprint, jsonify, request

from database.db import db
from database.models import Consultation, Summary


history_bp = Blueprint("history", __name__)


@history_bp.get("/history")
def get_history():
    consultations = Consultation.query.order_by(Consultation.created_at.desc()).all()

    return jsonify(
        [
            {
                "id": item.id,
                "patient_name": item.patient_name,
                "age": item.age,
                "complaint": item.complaint,
                "diagnosis": item.diagnosis,
                "speciality": item.speciality,
                "language": item.language,
                "understanding_level": item.understanding_level,
                "created_at": item.created_at.isoformat(),
            }
            for item in consultations
        ]
    )


@history_bp.get("/history/<int:consultation_id>")
def get_history_detail(consultation_id):
    consultation = Consultation.query.get_or_404(consultation_id)
    latest_summary = consultation.summaries[-1] if consultation.summaries else None

    return jsonify(
        {
            "id": consultation.id,
            "patient_name": consultation.patient_name,
            "age": consultation.age,
            "complaint": consultation.complaint,
            "diagnosis": consultation.diagnosis,
            "treatment": consultation.treatment,
            "followup": consultation.followup,
            "speciality": consultation.speciality,
            "language": consultation.language,
            "understanding_level": consultation.understanding_level,
            "medications": [
                {
                    "name": medication.medicine_name,
                    "dose": medication.dose,
                    "frequency": medication.frequency,
                    "duration": medication.duration,
                }
                for medication in consultation.medications
            ],
            "summary_id": latest_summary.id if latest_summary else None,
            "summary": latest_summary.full_summary if latest_summary else None,
            "doctors_note": latest_summary.doctors_note if latest_summary else "",
            "sections": {
                "section1": latest_summary.section1 if latest_summary else "",
                "section2": latest_summary.section2 if latest_summary else "",
                "section3": latest_summary.section3 if latest_summary else "",
                "section4": latest_summary.section4 if latest_summary else "",
            } if latest_summary else None,
            "created_at": consultation.created_at.isoformat(),
        }
    )


@history_bp.put("/history/<int:consultation_id>")
def update_consultation_history(consultation_id):
    consultation = Consultation.query.get_or_404(consultation_id)
    data = request.get_json(silent=True) or {}

    # Update consultation details
    if "patient_name" in data:
        consultation.patient_name = data["patient_name"]
    if "age" in data:
        consultation.age = int(data["age"])
    if "complaint" in data:
        consultation.complaint = data["complaint"]
    if "diagnosis" in data:
        consultation.diagnosis = data["diagnosis"]
    if "treatment" in data:
        consultation.treatment = data["treatment"]
    if "followup" in data:
        consultation.followup = data["followup"]
    if "speciality" in data:
        consultation.speciality = data["speciality"]
    if "language" in data:
        consultation.language = data["language"]
    if "understanding_level" in data:
        consultation.understanding_level = data["understanding_level"]

    # Update latest summary sections
    if consultation.summaries:
        latest_summary = consultation.summaries[-1]
        
        if "sections" in data:
            sections = data["sections"]
            if "section1" in sections:
                latest_summary.section1 = sections["section1"]
            if "section2" in sections:
                latest_summary.section2 = sections["section2"]
            if "section3" in sections:
                latest_summary.section3 = sections["section3"]
            if "section4" in sections:
                latest_summary.section4 = sections["section4"]
                
        if "summary" in data:
            latest_summary.full_summary = data["summary"]
            
        if "doctors_note" in data:
            latest_summary.doctors_note = data["doctors_note"]

    db.session.commit()

    # Retrieve updated summary information
    latest_summary = consultation.summaries[-1] if consultation.summaries else None

    return jsonify({
        "message": "Consultation history updated successfully",
        "id": consultation.id,
        "patient_name": consultation.patient_name,
        "age": consultation.age,
        "complaint": consultation.complaint,
        "diagnosis": consultation.diagnosis,
        "treatment": consultation.treatment,
        "followup": consultation.followup,
        "speciality": consultation.speciality,
        "language": consultation.language,
        "understanding_level": consultation.understanding_level,
        "summary_id": latest_summary.id if latest_summary else None,
        "summary": latest_summary.full_summary if latest_summary else None,
        "doctors_note": latest_summary.doctors_note if latest_summary else "",
        "sections": {
            "section1": latest_summary.section1 if latest_summary else "",
            "section2": latest_summary.section2 if latest_summary else "",
            "section3": latest_summary.section3 if latest_summary else "",
            "section4": latest_summary.section4 if latest_summary else "",
        } if latest_summary else None,
    })
