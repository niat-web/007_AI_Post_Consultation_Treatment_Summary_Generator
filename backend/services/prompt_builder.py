def build_patient_summary_prompt(data):
    medications = data.get("medications", [])
    medicine_lines = [
        (
            f"- {item.get('name')} {item.get('dose')} "
            f"{item.get('frequency')} for {item.get('duration')}"
        )
        for item in medications
    ]

    return f"""
Create a patient-friendly medical visit summary in simple English and Telugu.

Patient Name: {data.get("patient_name")}
Age: {data.get("age")}
Complaint: {data.get("complaint")}
Diagnosis: {data.get("diagnosis")}
Treatment Given: {data.get("treatment")}
Medicines:
{chr(10).join(medicine_lines) if medicine_lines else "- No medicines added"}
Follow-up: {data.get("followup")}

Keep the language simple and easy for a patient or family member to understand.
""".strip()
