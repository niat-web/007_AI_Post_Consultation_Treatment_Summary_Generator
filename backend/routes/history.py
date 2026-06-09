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
    latest_feedback = latest_summary.feedback[-1] if latest_summary and latest_summary.feedback else None

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
            "rating": latest_feedback.rating if latest_feedback else None,
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
    latest_feedback = latest_summary.feedback[-1] if latest_summary and latest_summary.feedback else None

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
        "rating": latest_feedback.rating if latest_feedback else None,
        "sections": {
            "section1": latest_summary.section1 if latest_summary else "",
            "section2": latest_summary.section2 if latest_summary else "",
            "section3": latest_summary.section3 if latest_summary else "",
            "section4": latest_summary.section4 if latest_summary else "",
        } if latest_summary else None,
    })


@history_bp.post("/history")
def create_consultation_history():
    from flask import current_app
    from database.models import Medication
    
    data = request.get_json(silent=True) or {}
    
    consultation = Consultation(
        patient_name=data.get("patient_name"),
        age=int(data.get("age", 0)),
        complaint=data.get("complaint"),
        diagnosis=data.get("diagnosis"),
        treatment=data.get("treatment"),
        followup=data.get("followup"),
        speciality=data.get("speciality", "General Medicine"),
        language=data.get("language", "English"),
        understanding_level=data.get("understanding_level", "Simple"),
    )

    for item in data.get("medications", []):
        if item.get("name"):
            consultation.medications.append(
                Medication(
                    medicine_name=item.get("name"),
                    dose=item.get("dose"),
                    frequency=item.get("frequency"),
                    duration=item.get("duration"),
                )
            )

    sections = data.get("sections", {})
    summary = Summary(
        prompt_version=current_app.config.get("PROMPT_VERSION", "1.0"),
        section1=sections.get("section1", ""),
        section2=sections.get("section2", ""),
        section3=sections.get("section3", ""),
        section4=sections.get("section4", ""),
        doctors_note=data.get("doctors_note", ""),
        full_summary=data.get("summary", ""),
    )
    consultation.summaries.append(summary)

    db.session.add(consultation)
    db.session.commit()

    return jsonify({
        "message": "Consultation history created successfully",
        "id": consultation.id,
        "summary_id": summary.id,
        "sections": sections,
        "summary": summary.full_summary,
        "doctors_note": summary.doctors_note
    }), 201

@history_bp.delete("/history/<int:consultation_id>")
def delete_consultation_history(consultation_id):
    consultation = Consultation.query.get_or_404(consultation_id)
    # The models are set up with cascade="all, delete-orphan", so this deletes the summary and medications automatically.
    # Otherwise we might need to manually delete them. Let's assume the relationships are correctly configured or we can just delete it.
    db.session.delete(consultation)
    db.session.commit()
    return jsonify({"message": f"Consultation {consultation_id} deleted successfully"}), 200
