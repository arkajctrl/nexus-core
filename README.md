# Nexus Core - AI Curriculum & Skill Matching Engine

Nexus Core is an intelligent, full-stack platform designed to analyze academic curriculums and automatically align them with real-world job competencies. By extracting raw text directly from university syllabus PDFs and passing it through an advanced natural language processing (NLP) vector matching engine, Nexus Core bridges the gap between academic coursework and industry requirements. 

## Key Features

* **PDF Ingestion Pipeline:** Instantly extract course units, topics, and learning objectives from uploaded academic documents using intelligent parsing.
* **Semantic Skill Matching:** Leverages advanced ML models to calculate cosine similarity, mapping academic content directly to real-world job competencies and highlighting skill gaps.
* **Interactive Frontend Visuals:** A highly engaging React UI featuring WebGL particle background animations (tracked to mouse movements) and GSAP text-reveal effects.
* **Asynchronous API Processing:** Built on a robust FastAPI architecture to handle multipart file uploads and lightning-fast ML inference without blocking the user interface.

## Tech Stack

* **Frontend:** React, Vite, Tailwind CSS, GSAP, WebGL (OGL/GLSL Shaders)
* **Backend:** Python, FastAPI, Uvicorn
* **ML Engine:** `sentence-transformers`, `scikit-learn`, `pdfplumber`, `numpy`

## Prerequisites

Before you begin, ensure you have the following installed on your system:
* **Node.js (LTS version)** and **npm** (for the frontend).
* **Python 3.8+** (for the backend and ML engine).

## Installation Guide

**1. Clone the Repository**
```powershell
git clone <repository-url>
cd nexus-core
```

**2. Set up the Backend (ML Engine)**
Open a terminal and navigate to the backend folder:
```powershell
cd ml-engine
```
Create and activate a virtual environment:
```powershell
# Windows
python -m venv venv
.\venv\Scripts\Activate.ps1

# Mac/Linux
python3 -m venv venv
source venv/bin/activate
```
Install the Python dependencies:
```powershell
py -m pip install -r requirements.txt
```

**3. Set up the Frontend (Client)**
Open a *new* terminal tab and navigate to the frontend folder:
```powershell
cd client
```
Install the Node dependencies:
```powershell
npm install
```

## Usage

To run the full application, you need to start both the backend and frontend servers simultaneously in separate terminal windows.

### Start the Backend
In your `ml-engine` terminal (with the virtual environment activated), run:
```powershell
py -m uvicorn main:app --reload
```
*The API will be available at `http://127.0.0.1:8000`.*

### Start the Frontend
In your `client` terminal, run:
```powershell
npm run dev
```
*The UI will launch on local port 5173.*

## Project Structure

```text
nexus-core/
├── client/                 # React frontend application
│   ├── src/
│   │   ├── PixelBlast.jsx  # WebGL interactive background animations
│   │   ├── ScrollExpand.jsx# Scroll-triggered UI components
│   │   ├── Shuffle.jsx     # Text shuffle reveal effects
│   │   ├── App.jsx         # Main React application layout
│   │   └── main.jsx        # React DOM entry point
│   └── package.json        # Node dependencies and scripts
└── ml-engine/              # Python FastAPI & ML backend
    ├── src/
    │   ├── matcher.py      # Vector embedding and cosine similarity engine
    │   └── parser.py       # PDF syllabus text extraction pipeline
    ├── main.py             # FastAPI routing and entry point
    └── requirements.txt    # Python backend dependencies
```

## Troubleshooting

* **`npm` is not recognized:**
  Ensure you have downloaded and installed Node.js. If you just installed it, completely close and reopen your terminal so it recognizes the new command path.
* **`uvicorn` is not recognized:**
  If your virtual environment isn't finding Uvicorn, bypass the script path error by running Python as a module directly: `py -m uvicorn main:app --reload`.
* **ModuleNotFoundError for Python packages:**
  Ensure your virtual environment is explicitly activated (`.\venv\Scripts\Activate.ps1`) before running the `pip install` command.
