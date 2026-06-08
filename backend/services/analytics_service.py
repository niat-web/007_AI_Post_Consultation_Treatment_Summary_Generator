from sqlalchemy import cast, Date, func

from database.db import db
from database.models import Feedback, Summary


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
    }
