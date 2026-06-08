from services.prompt_builder import build_patient_summary_prompt


def generate_patient_summary(data):
    """Temporary placeholder. Replace this with Gemini/OpenAI API call later."""
    prompt = build_patient_summary_prompt(data)

    patient_name = data.get("patient_name", "Patient")
    complaint = data.get("complaint", "the health concern")
    diagnosis = data.get("diagnosis", "the diagnosis")
    treatment = data.get("treatment", "the treatment")
    followup = data.get("followup", "Follow the doctor's advice.")

    return {
        "prompt": prompt,
        "section1": f"{patient_name} came with {complaint}.",
        "section2": f"The doctor diagnosed: {diagnosis}.",
        "section3": f"Treatment given: {treatment}.",
        "section4": f"Follow-up instructions: {followup}.",
        "full_summary": (
            f"{patient_name}, your main problem is {complaint}. "
            f"The diagnosis is {diagnosis}. Treatment given: {treatment}. "
            f"Please follow these instructions: {followup}"
        ),
    }
