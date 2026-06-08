from flask import Blueprint, jsonify

from services.analytics_service import get_admin_analytics


analytics_bp = Blueprint("analytics", __name__)


@analytics_bp.get("/analytics")
def analytics():
    return jsonify(get_admin_analytics())
