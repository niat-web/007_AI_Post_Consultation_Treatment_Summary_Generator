from flask import Blueprint, jsonify

from database.models import Consultation


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
            "medications": [
                {
                    "name": medication.medicine_name,
                    "dose": medication.dose,
                    "frequency": medication.frequency,
                    "duration": medication.duration,
                }
                for medication in consultation.medications
            ],
            "summary": latest_summary.full_summary if latest_summary else None,
            "created_at": consultation.created_at.isoformat(),
        }
    )
