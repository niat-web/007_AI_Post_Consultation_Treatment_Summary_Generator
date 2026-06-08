import os
import json
import google.generativeai as genai


def generate_patient_summary(data):
    api_key = os.getenv("GEMINI_API_KEY")
    language = data.get("language", "English")
    understanding_level = data.get("understanding_level", "Simple")
    
    patient_name = data.get("patient_name", "Patient")
    complaint = data.get("complaint", "")
    diagnosis = data.get("diagnosis", "")
    treatment = data.get("treatment", "")
    followup = data.get("followup", "Follow standard clinical advice.")
    
    medications = data.get("medications", [])
    meds_list = []
    for m in medications:
        meds_list.append(f"{m.get('name')} ({m.get('dose')}, {m.get('frequency')}, for {m.get('duration')})")
    meds_str = ", ".join(meds_list) if meds_list else "None prescribed"
    
    prompt = f"""
You are an empathetic, patient-friendly AI medical assistant at Ayurdha Clinics.
Convert the following clinical notes into a clear, patient-friendly visit summary in {language} language.
The summary must be tailored to a "{understanding_level}" understanding level (avoid complex medical jargon, explain things in simple terms).

Patient Name: {patient_name}
Age: {data.get("age")}
Presenting Complaint: {complaint}
Diagnosis: {diagnosis}
Treatment Provided: {treatment}
Medications: {meds_str}
Follow-up Instructions: {followup}

You MUST return the output as a valid JSON object with the following keys. Do NOT wrap the JSON in ```json markdown blocks, just return the raw JSON:
{{
  "section1": "What you came in for (Explain the patient's presenting complaint and reason for visit in simple terms)",
  "section2": "What was found (Explain the diagnosis and what it means in plain language, avoiding jargon)",
  "section3": "What was done / what you need to take (Explain the treatment provided and how to take each medication in clear steps)",
  "section4": "What to do next (Explain follow-up instructions, warning signs, and when to return)",
  "full_summary": "A cohesive, single-paragraph summary of the entire visit."
}}
"""

    if api_key:
        try:
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel("gemini-1.5-pro", generation_config={"response_mime_type": "application/json"})
            response = model.generate_content(prompt)
            result = json.loads(response.text.strip())
            return {
                "prompt": prompt,
                "section1": result.get("section1", ""),
                "section2": result.get("section2", ""),
                "section3": result.get("section3", ""),
                "section4": result.get("section4", ""),
                "full_summary": result.get("full_summary", "")
            }
        except Exception as e:
            print("Gemini API Error, falling back to local engine:", e)
            # Fallback to local engine
    
    # Local engine (fallback mockup)
    is_telugu = language.lower() == "telugu"
    
    if is_telugu:
        s1 = f"మీరు ఈ రోజు ఈ క్రింది సమస్యలతో మా క్లినిక్‌ని సందర్శించారు: {complaint}."
        s2 = f"మా పరీక్షల ఆధారంగా నిర్ధారణ అయిన వ్యాధి: {diagnosis}."
        s3 = f"చేయబడిన చికిత్స: {treatment}."
        if meds_list:
            s3 += f" దయచేసి ఈ క్రింది మందులను తీసుకోండి: {meds_str}."
        s4 = f"తదుపరి సూచనలు: {followup}."
        full = f"{patient_name} గారు, మీ ఆరోగ్య పరిస్థితిని బట్టి {diagnosis} ఉన్నట్లు నిర్ధారణ అయింది. చికిత్స కోసం {treatment} సూచించబడింది మరియు మందులు ({meds_str}) ఇవ్వబడ్డాయి. దయచేసి ఈ క్రింది జాగ్రత్తలు తీసుకోండి: {followup}."
    else:
        s1 = f"You visited our clinic today with complaints of: {complaint}."
        s2 = f"Based on our evaluation, the diagnosis is: {diagnosis}."
        s3 = f"Treatment provided: {treatment}."
        if meds_list:
            s3 += f" Please take the following prescribed medications: {meds_str}."
        s4 = f"Follow-up instructions: {followup}."
        full = f"Dear {patient_name}, you visited us for {complaint}. We diagnosed it as {diagnosis}. The recommended treatment is {treatment}. Medications: {meds_str}. Please follow up as instructed: {followup}."
        
    return {
        "prompt": prompt,
        "section1": s1,
        "section2": s2,
        "section3": s3,
        "section4": s4,
        "full_summary": full
    }
