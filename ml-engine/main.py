from fastapi import FastAPI, File, UploadFile
import uvicorn
import os
from src.parser import extract_text_from_pdf
from src.matcher import SkillDeltaEngine

app = FastAPI(title="Nexus Core API")

# Initialize the AI Model once when the server starts so it doesn't reload on every request
engine = SkillDeltaEngine()

# Dummy jobs for now (Later we will scrape these live)
INDUSTRY_JOB_REQUIREMENTS = [
    "Data Structures and Algorithms",
    "SQL Database Architecture",
    "Docker Containerization",
    "React Frontend Development",
    "Cloud Architecture"
]

@app.post("/api/analyze-syllabus")
async def analyze_syllabus(file: UploadFile = File(...)):
    # 1. Save the uploaded PDF temporarily
    file_location = f"data/raw_syllabi/{file.filename}"
    with open(file_location, "wb+") as file_object:
        file_object.write(await file.read())
        
    # 2. Extract text from the PDF using your parser
    raw_text = extract_text_from_pdf(file_location)
    
    # 3. Clean and split the text into syllabus topics
    # (A simple split by lines that have actual text to simulate modules)
    syllabus_topics = [line.strip() for line in raw_text.split('\n') if len(line.strip()) > 5]
    
    # 4. Run the extracted topics through the AI model
    covered, missing = engine.extract_delta(syllabus_topics, INDUSTRY_JOB_REQUIREMENTS, threshold=0.45)
    
    # 5. Clean up the temporary file so the server doesn't get cluttered
    os.remove(file_location)
    
    # 6. Return the formatted data as JSON for the React UI to consume
    return {
        "filename": file.filename,
        "coverage_stats": {
            "total_job_skills": len(INDUSTRY_JOB_REQUIREMENTS),
            "covered_count": len(covered)
        },
        "covered_skills": covered,
        "skill_delta": missing
    }