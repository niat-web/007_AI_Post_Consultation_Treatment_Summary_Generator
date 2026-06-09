from openai import OpenAI
import os

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=OPENROUTER_API_KEY,
)

SYSTEM_PROMPT = """
You are an empathetic medical assistant working for Ayurdha Clinics.

Rules:
- Write only in the requested language.
- Use simple patient-friendly language.
- Avoid medical jargon.
- Medication names can remain unchanged.
- Do not use markdown.
- Return only the requested content.
"""


def generate_section(prompt, fallback_text=""):
    try:
        response = client.chat.completions.create(
            model="openai/gpt-oss-20b:free",
            messages=[
                {
                    "role": "system",
                    "content": SYSTEM_PROMPT
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.2,
            max_tokens=500
        )

        return response.choices[0].message.content.strip()

    except Exception as e:
        print(f"Section generation failed: {e}")
        return fallback_text


def generate_patient_summary(data):
    try:

        language = data.get("language", "English")

        if language.lower() != "telugu":
            language = "English"
        else:
            language = "Telugu"

        patient_name = data.get("patient_name", "Patient")
        age = data.get("age", "")
        complaint = data.get("complaint", "")
        diagnosis = data.get("diagnosis", "")
        treatment = data.get("treatment", "")
        followup = data.get("followup", "")
        understanding_level = data.get("understanding_level", "Simple")

        medications = data.get("medications", [])

        meds_list = []

        for m in medications:
            meds_list.append(
                f"{m.get('name')} ({m.get('dose')}, {m.get('frequency')}, {m.get('duration')})"
            )

        meds_str = ", ".join(meds_list) if meds_list else "None prescribed"

        section1 = generate_section(
            f"""
Language: {language}
Understanding Level: {understanding_level}

Patient Name: {patient_name}
Age: {age}
Presenting Complaint: {complaint}

Write a patient-friendly explanation of why the patient visited the clinic.

Return only the content.
""",
            fallback_text=f"The patient visited the clinic with complaints of {complaint}."
        )

        section2 = generate_section(
            f"""
Language: {language}
Understanding Level: {understanding_level}

Diagnosis:
{diagnosis}

Explain the diagnosis in simple language.

Return only the content.
""",
            fallback_text=f"The diagnosis recorded was {diagnosis}."
        )

        section3 = generate_section(
            f"""
Language: {language}
Understanding Level: {understanding_level}

Treatment:
{treatment}

Medications:
{meds_str}

Explain treatment and medication usage.

Return only the content.
""",
            fallback_text=f"Treatment provided: {treatment}. Medications: {meds_str}."
        )

        section4 = generate_section(
            f"""
Language: {language}
Understanding Level: {understanding_level}

Follow-up Instructions:
{followup}

Explain next steps and precautions.

Return only the content.
""",
            fallback_text=f"Follow-up instructions: {followup}."
        )

        full_summary = generate_section(
            f"""
Language: {language}
Understanding Level: {understanding_level}

Patient Name: {patient_name}
Age: {age}
Complaint: {complaint}
Diagnosis: {diagnosis}
Treatment: {treatment}
Medications: {meds_str}
Follow-up: {followup}

Create a concise patient-friendly summary.

Return only the content.
""",
            fallback_text=(
                f"{patient_name} visited for {complaint}. "
                f"Diagnosis: {diagnosis}. "
                f"Treatment: {treatment}. "
                f"Follow-up: {followup}."
            )
        )

        return {
            "section1": section1,
            "section2": section2,
            "section3": section3,
            "section4": section4,
            "full_summary": full_summary
        }

    except Exception as e:
        print(f"Summary generation failed: {e}")

        return {
            "section1": "Unable to generate summary.",
            "section2": "Unable to generate summary.",
            "section3": "Unable to generate summary.",
            "section4": "Unable to generate summary.",
            "full_summary": "Unable to generate summary at this time."
        }