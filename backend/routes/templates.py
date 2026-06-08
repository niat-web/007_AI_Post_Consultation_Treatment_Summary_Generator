from flask import Blueprint, jsonify

from database.models import Template


templates_bp = Blueprint("templates", __name__)


@templates_bp.get("/templates")
def get_templates():
    templates = Template.query.order_by(Template.title.asc()).all()

    return jsonify(
        [
            {
                "id": template.id,
                "title": template.title,
                "complaint": template.complaint,
                "diagnosis": template.diagnosis,
                "treatment": template.treatment,
                "followup": template.followup,
            }
            for template in templates
        ]
    )
