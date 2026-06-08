def validate_generation_request(data):
    errors = {}
    required_fields = [
        "patient_name",
        "age",
        "complaint",
        "diagnosis",
        "treatment",
    ]

    for field in required_fields:
        if not data.get(field):
            errors[field] = "This field is required."

    if data.get("age") and not isinstance(data["age"], int):
        errors["age"] = "Age must be a number."

    for index, medication in enumerate(data.get("medications", [])):
        if not medication.get("name"):
            errors[f"medications.{index}.name"] = "Medicine name is required."

    return errors


def validate_feedback_request(data):
    errors = {}

    if not data.get("summary_id"):
        errors["summary_id"] = "This field is required."

    rating = data.get("rating")
    if rating is None:
        errors["rating"] = "This field is required."
    elif not isinstance(rating, int) or rating < 1 or rating > 5:
        errors["rating"] = "Rating must be a number between 1 and 5."

    return errors
