import { useState } from 'react';
import PixelBlast from './PixelBlast';
import Shuffle from './Shuffle';
import './App.css';

export default function App() {
  const [file, setFile] = useState(null);
  const [jobRole, setJobRole] = useState("Software Engineer"); 
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);

  const handleFileDrop = (e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile?.type === "application/pdf") {
      setFile(droppedFile);
    }
  };

  const analyzeSyllabus = async () => {
    if (!file) return;
    setLoading(true);

    const formData = new FormData();
    formData.append("file", file); 
    formData.append("job_role", jobRole || "Software Engineer"); 

    try {
      const response = await fetch("http://127.0.0.1:8000/analyze_syllabus", {
        method: "POST",
        body: formData,
      });
      
      if (response.ok) {
        const data = await response.json();
        setResults(data);
      } else {
        console.error("Backend error:", response.status);
      }
    } catch (error) {
      console.error("Network error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans relative overflow-hidden flex flex-col items-center justify-center p-6">
      
      <div className="absolute inset-0 z-0 opacity-40 pointer-events-none">
        <PixelBlast />
      </div>

      <div className="relative z-10 w-full max-w-3xl space-y-8">
        
        {!loading && !results && (
          <div className="text-center space-y-6">
            <h1 className="text-5xl font-bold tracking-tight">Nexus Core</h1>
            <p className="text-gray-400">Align academic curriculum with live industry realities.</p>
            
            <div className="w-full max-w-md mx-auto text-left">
              <label className="block text-sm font-medium text-gray-400 mb-2 ml-1">
                Target Industry Role
              </label>
              <input 
                type="text" 
                value={jobRole}
                onChange={(e) => setJobRole(e.target.value)}
                placeholder="e.g. Frontend Developer, Data Scientist..."
                className="w-full px-4 py-3 bg-gray-800/80 border border-gray-600 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-white placeholder-gray-500 transition-all shadow-inner"
              />
            </div>

            <div 
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
              className="border-2 border-dashed border-gray-600 rounded-xl p-12 hover:border-blue-500 hover:bg-gray-800/80 transition-all cursor-pointer backdrop-blur-sm"
            >
              <input 
                type="file" 
                accept="application/pdf"
                className="hidden" 
                id="file-upload"
                onChange={(e) => setFile(e.target.files[0])}
              />
              <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
                <span className="text-blue-400 font-semibold mb-2">
                  {file ? file.name : "Drag & Drop Syllabus PDF"}
                </span>
                <span className="text-sm text-gray-500">or click to browse</span>
              </label>
            </div>

            <button 
              onClick={analyzeSyllabus}
              disabled={!file || !jobRole}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-full font-bold transition-all shadow-lg shadow-blue-500/30"
            >
              Analyze Syllabus
            </button>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center space-y-6 py-20">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <div className="text-2xl font-bold text-blue-400">
              <Shuffle text="Fetching Live Market Data..." />
            </div>
          </div>
        )}

        {results && !loading && (
          <div className="bg-gray-800/80 backdrop-blur-md border border-gray-700 p-8 rounded-2xl shadow-2xl space-y-8 animate-fade-in-up">
            <div className="flex justify-between items-end border-b border-gray-700 pb-4">
              <div>
                <h2 className="text-3xl font-bold">Analysis Complete</h2>
                <p className="text-gray-400 text-sm mt-2 flex items-center gap-2">
                  <span>File: {results.filename}</span>
                  <span className="text-gray-600">|</span>
                  <span>Optimized for: <span className="text-blue-400 font-semibold">{results.target_role}</span></span>
                </p>
              </div>
              <button 
                onClick={() => { setResults(null); setFile(null); }}
                className="text-sm text-blue-400 hover:text-blue-300"
              >
                Start Over
              </button>
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-green-400 border-b border-green-900/50 pb-2 flex items-center justify-between">
                  <span>Covered Skills</span>
                  <span className="text-sm font-normal text-green-500/70">{results.coverage_stats?.covered_count} Matches</span>
                </h3>
                <div className="flex flex-wrap gap-2">
                  {results.covered_skills?.map((item, index) => {
                    const skillName = typeof item === 'object' ? item.skill : item;
                    return (
                      <span key={index} className="bg-green-900/40 text-green-300 px-3 py-1 rounded-md text-sm border border-green-800 flex flex-col">
                        <span className="font-bold">{skillName}</span>
                        {item.confidence && <span className="text-xs text-green-500/70">{Number(item.confidence).toFixed(0)}% match</span>}
                      </span>
                    )
                  })}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-amber-400 border-b border-amber-900/50 pb-2 flex items-center justify-between">
                  <span>Live Industry Gaps</span>
                  <span className="text-sm font-normal text-amber-500/70">Missing Competencies</span>
                </h3>
                <div className="space-y-3 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                  {!results.skill_delta || results.skill_delta.length === 0 ? (
                    <div className="p-6 bg-green-900/20 border border-green-800 rounded-lg text-center text-green-400">
                      <p className="font-bold">100% Industry Alignment</p>
                      <p className="text-sm mt-1">This syllabus perfectly covers current requirements for this role.</p>
                    </div>
                  ) : (
                    results.skill_delta.map((item, index) => {
                       const missingSkill = typeof item === 'object' ? item.skill : item;
                       // Using a default 0 if confidence isn't provided by the backend
                       const confidenceScore = item.confidence ? Number(item.confidence).toFixed(0) : "0";
                       return (
                        <div key={index} className="bg-gray-900/80 border border-amber-900/50 rounded-lg p-4 shadow-sm">
                          <div className="flex justify-between items-start">
                            <h4 className="font-bold text-amber-400">{missingSkill}</h4>
                            
                            {/* FIXED: Badge now shows even if confidence is low/zero */}
                            <span className="text-xs bg-amber-900/30 text-amber-500 px-2 py-1 rounded border border-amber-800/50">
                              {confidenceScore}% match
                            </span>
                          </div>
                          
                          <p className="text-xs text-gray-400 mt-2">
                            Highly requested in recent <span className="text-blue-400 font-semibold">{results.target_role}</span> job postings but missing from this curriculum.
                          </p>
                        </div>
                       )
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        
      </div>
    </div>
  );
}