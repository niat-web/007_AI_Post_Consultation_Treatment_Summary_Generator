from sqlalchemy import cast, Date, func

from database.db import db
from database.models import Feedback, Summary, Consultation


def get_admin_analytics():
    total_generations = db.session.query(func.count(Summary.id)).scalar() or 0
    average_rating = db.session.query(func.avg(Feedback.rating)).scalar()
    
    ratings_per_day = (
        db.session.query(
            cast(Feedback.created_at, Date).label("date"),
            func.count(Feedback.id).label("count"),
            func.avg(Feedback.rating).label("average_rating"),
        )
        .group_by(cast(Feedback.created_at, Date))
        .order_by(cast(Feedback.created_at, Date))
        .all()
    )

    speciality_counts = (
        db.session.query(
            Consultation.speciality,
            func.count(Consultation.id).label("count")
        )
        .group_by(Consultation.speciality)
        .all()
    )

    consultations = Consultation.query.order_by(Consultation.created_at.desc()).all()
    records = []
    for c in consultations:
        latest_summary = c.summaries[-1] if c.summaries else None
        latest_feedback = latest_summary.feedback[-1] if latest_summary and latest_summary.feedback else None
        records.append({
            "id": c.id,
            "patient_name": c.patient_name,
            "speciality": c.speciality or "General Medicine",
            "age": c.age,
            "created_at": c.created_at.isoformat(),
            "rating": latest_feedback.rating if latest_feedback else None
        })

    return {
        "total_generations": total_generations,
        "average_rating": round(float(average_rating), 2) if average_rating else 0,
        "ratings_per_day": [
            {
                "date": row.date.isoformat(),
                "count": row.count,
                "average_rating": round(float(row.average_rating), 2),
            }
            for row in ratings_per_day
        ],
        "speciality_distribution": [
            {
                "speciality": row.speciality or "General Medicine",
                "count": row.count
            }
            for row in speciality_counts
        ],
        "records": records
    }
