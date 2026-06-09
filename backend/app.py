from flask import Flask, jsonify
from flask_cors import CORS

from config import Config
from database.db import db
from routes.analytics import analytics_bp
from routes.feedback import feedback_bp
from routes.generate import generate_bp
from routes.history import history_bp
from routes.templates import templates_bp


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    CORS(app)
    db.init_app(app)

    app.register_blueprint(generate_bp, url_prefix="/api")
    app.register_blueprint(history_bp, url_prefix="/api")
    app.register_blueprint(feedback_bp, url_prefix="/api")
    app.register_blueprint(analytics_bp, url_prefix="/api/admin")
    app.register_blueprint(templates_bp, url_prefix="/api")

    @app.get("/api/health")
    def health_check():
        return jsonify({"status": "ok"})

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)