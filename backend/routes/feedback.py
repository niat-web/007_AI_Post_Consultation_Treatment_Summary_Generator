from flask import Blueprint, jsonify, request

from database.db import db
from database.models import Feedback, Summary
from utils.validators import validate_feedback_request


feedback_bp = Blueprint("feedback", __name__)


@feedback_bp.post("/feedback")
def create_feedback():
    data = request.get_json(silent=True) or {}
    errors = validate_feedback_request(data)

    if errors:
        return jsonify({"errors": errors}), 400

    Summary.query.get_or_404(data["summary_id"])

    feedback = Feedback(summary_id=data["summary_id"], rating=data["rating"])
    db.session.add(feedback)
    db.session.commit()

    return jsonify({"id": feedback.id, "message": "Feedback saved"}), 201
