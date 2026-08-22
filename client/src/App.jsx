import { useState, useEffect, useRef } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import HalftoneReveal from './HalftoneReveal';
import PixelBlast from './PixelBlast';
import Shuffle from './Shuffle';
import './App.css';

export default function App() {
  // --- AUTH & STATE MANAGEMENT ---
  const [currentUser, setCurrentUser] = useState(() => localStorage.getItem('nexus_user') || null);
  const [currentView, setCurrentView] = useState(currentUser ? 'home' : 'login'); 
  const [theme, setTheme] = useState('dark'); 
  
  // Progress Persistence 
  const [userProgress, setUserProgress] = useState(() => {
    const saved = localStorage.getItem(`nexus_progress_${currentUser}`);
    return saved ? JSON.parse(saved) : {};
  });

  // Analyzer States
  const [file, setFile] = useState(null);
  const [jobRole, setJobRole] = useState("Software Engineer"); 
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  
  // Interactive States
  const [activeFixItSkill, setActiveFixItSkill] = useState(null);
  const [savedJobs, setSavedJobs] = useState([]);
  const [jobTab, setJobTab] = useState('matches'); 

  // LiveLogic States
  const [interviewMode, setInterviewMode] = useState('soft'); // 'soft' or 'tech'
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [recording, setRecording] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [interviewAnswers, setInterviewAnswers] = useState([]);
  const [interviewComplete, setInterviewComplete] = useState(false);
  const [mediaStream, setMediaStream] = useState(null);
  
  const recognitionRef = useRef(null);
  const finalTranscriptRef = useRef(""); 
  const videoRef = useRef(null);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(`nexus_progress_${currentUser}`, JSON.stringify(userProgress));
    }
  }, [userProgress, currentUser]);

  useEffect(() => {
    if (currentView !== 'livelogic') {
      stopMedia();
    }
  }, [currentView]);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  // --- DYNAMIC INTERVIEW QUESTIONS ---
  const getInterviewQuestions = () => {
    if (interviewMode === 'tech' && activeFixItSkill) {
      return [
        `Can you explain the core architecture and primary use cases of ${activeFixItSkill}?`,
        `What are some common performance bottlenecks or pitfalls when scaling ${activeFixItSkill} in a production environment?`,
        `If you had to integrate ${activeFixItSkill} into a legacy monolithic codebase, how would you approach the migration?`
      ];
    }
    return [
      "Tell me about a time you had to learn a complex technical stack under a tight deadline.",
      "How do you handle architectural disagreements or debugging roadblocks within a development team?",
      "Describe a project where you bridged a critical gap between academic theory and production requirements."
    ];
  };

  const launchInterview = (mode, skill = null) => {
    setInterviewMode(mode);
    if (skill) setActiveFixItSkill(skill);
    setInterviewStarted(false);
    setInterviewComplete(false);
    setCurrentQuestionIdx(0);
    setInterviewAnswers([]);
    setLiveTranscript("");
    finalTranscriptRef.current = "";
    setCurrentView('livelogic');
  };

  // --- HARDWARE & PURE SPEECH RECOGNITION LOGIC ---
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: { ideal: 1280 }, height: { ideal: 720 } }, 
        audio: true 
      });
      setMediaStream(stream);
      setInterviewStarted(true);
    } catch (err) {
      console.error("Camera/Mic access denied:", err);
      alert("Microphone and Camera access are strictly required for LiveLogic to function.");
    }
  };

  const stopMedia = () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      setMediaStream(null);
    }
    if (recognitionRef.current && typeof recognitionRef.current.stop === 'function') {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setRecording(false);
  };

  const startSpeaking = () => {
    setRecording(true);
    setLiveTranscript("");
    finalTranscriptRef.current = "";

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event) => {
          let interimTrans = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscriptRef.current += event.results[i][0].transcript + ' ';
            } else {
              interimTrans += event.results[i][0].transcript;
            }
          }
          setLiveTranscript(finalTranscriptRef.current + interimTrans);
        };

        recognition.onerror = (err) => {
          console.error("Speech recognition true error:", err.error);
          setLiveTranscript(`[Microphone Error: ${err.error}. Ensure browser permissions are granted and Shields are down.]`);
        };

        recognition.start();
        recognitionRef.current = recognition;
      } catch (e) {
        console.error("Speech recognition failed to start:", e);
        setLiveTranscript(`[System Error: Failed to start transcription engine.]`);
      }
    } else {
      setLiveTranscript("[Error: Web Speech API is completely unsupported in this specific browser.]");
    }
  };

  const handleStopRecording = () => {
    if (recognitionRef.current && typeof recognitionRef.current.stop === 'function') {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setRecording(false);
    
    const questions = getInterviewQuestions();
    // Use exactly what the user spoke, nothing else.
    const finalAnswer = finalTranscriptRef.current.trim() || liveTranscript.trim() || "";
    
    const updatedAnswers = [...interviewAnswers, { question: questions[currentQuestionIdx], answer: finalAnswer }];
    setInterviewAnswers(updatedAnswers);

    if (currentQuestionIdx < questions.length - 1) {
      setCurrentQuestionIdx(prev => prev + 1);
      setLiveTranscript("");
      finalTranscriptRef.current = "";
    } else {
      stopMedia();
      setInterviewComplete(true);
    }
  };

  // --- DYNAMIC AI SPEECH EVALUATOR ---
  const calculateInterviewMetrics = () => {
    const totalWords = interviewAnswers.reduce((acc, curr) => acc + curr.answer.split(/\s+/).filter(Boolean).length, 0);
    const combinedText = interviewAnswers.map(a => a.answer.toLowerCase()).join(" ");

    let keywords = ["team", "scale", "performance", "debug", "architecture", "data", "system", "communicate", "agile", "optimizing", "codebase"];
    if (interviewMode === 'tech' && activeFixItSkill) {
      keywords.push(activeFixItSkill.toLowerCase(), "api", "database", "deploy", "server", "cloud", "code", "repo");
    }

    const matchedKeywords = keywords.filter(kw => combinedText.includes(kw));

    let score = 0; 
    
    if (totalWords === 0) {
      score = 0; // If they say nothing, they get a 0. No fake participation trophies.
    } else {
      score = 40; // Base score for actually speaking
      if (totalWords > 50) score += 20;
      else if (totalWords > 20) score += 10;
      score += Math.min(30, matchedKeywords.length * 6);
    }
    
    score = Math.min(100, score); 

    return {
      score,
      totalWords,
      matchedKeywords,
      clarity: score === 0 ? "Failed to provide input" : score > 80 ? "Optimal (Structured Delivery)" : score > 60 ? "Stable (Moderate Cohesion)" : "Fragmented (Needs Expansion)"
    };
  };

  // --- STANDARD LOGIC ---
  const handleLogin = (e) => {
    e.preventDefault();
    const username = e.target.username.value.trim();
    if (username) {
      localStorage.setItem('nexus_user', username);
      setCurrentUser(username);
      const savedProgress = JSON.parse(localStorage.getItem(`nexus_progress_${username}`)) || {};
      setUserProgress(savedProgress);
      setCurrentView('home');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('nexus_user');
    setCurrentUser(null);
    setUserProgress({});
    setResults(null);
    stopMedia();
    setCurrentView('login');
  };

  const toggleProgress = (skill, week) => {
    setUserProgress(prev => {
      const skillProgress = prev[skill] || [];
      let newProgress;
      if (skillProgress.includes(week)) {
        newProgress = skillProgress.filter(w => w !== week);
      } else {
        newProgress = [...skillProgress, week];
      }
      return { ...prev, [skill]: newProgress };
    });
  };

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

  const toggleSaveJob = (job) => {
    setSavedJobs(prev => {
      const isSaved = prev.find(j => j.id === job.id);
      return isSaved ? prev.filter(j => j.id !== job.id) : [...prev, job];
    });
  };

  const generateRadarData = () => {
    if (!results) return [];
    
    const covered = (results.covered_skills || []).map(s => ({
      subject: typeof s === 'object' ? s.skill : s,
      coverage: s.confidence ? Number(s.confidence) : 85,
    }));

    const missing = (results.skill_delta || []).map(s => {
      const skillName = typeof s === 'object' ? s.skill : s;
      const baseCoverage = s.confidence ? Number(s.confidence) : 20; 
      
      const completedWeeks = (userProgress[skillName] || []).length;
      const boostPerWeek = (100 - baseCoverage) / 4;
      const currentCoverage = baseCoverage + (completedWeeks * boostPerWeek);

      return {
        subject: skillName,
        coverage: currentCoverage, 
      };
    });

    let prioritizedMissing = [...missing];
    if (activeFixItSkill) {
      const activeItem = missing.find(m => m.subject === activeFixItSkill);
      if (activeItem) {
        prioritizedMissing = [activeItem, ...missing.filter(m => m.subject !== activeFixItSkill)];
      }
    }

    const combined = [...prioritizedMissing, ...covered];

    return combined.slice(0, 8).map(item => ({
      ...item,
      subject: item.subject.length > 12 ? item.subject.substring(0, 12) + '...' : item.subject,
      fullMark: 100,
    }));
  };

  const getMockJobs = () => {
    const role = results?.target_role || "Software Engineer";
    return [
      { id: "job_1", title: `Junior ${role}`, company: "NexusTech Solutions", location: "Gurugram, HR (Hybrid)", match: 92, link: "https://linkedin.com/jobs" },
      { id: "job_2", title: `${role} - New Grad`, company: "DataFlow AI", location: "Remote - India", match: 88, link: "https://linkedin.com/jobs" },
      { id: "job_3", title: `Associate ${role}`, company: "CloudScale Inc.", location: "Bangalore, KA", match: 76, link: "https://linkedin.com/jobs" },
      { id: "job_4", title: `${role} (Core Team)`, company: "InnovateTech", location: "Gurugram, HR", match: 65, link: "https://linkedin.com/jobs" },
    ];
  };

  const generateFixItPlan = (skillName) => {
    if (!skillName) return null;
    const encodedSkill = encodeURIComponent(skillName);
    const normalizedSkill = skillName.toLowerCase();
    
    const resourceMap = {
      "react": {
        videos: [
          { title: "React in 100 Seconds", channel: "Fireship", length: "1:33", url: "https://www.youtube.com/watch?v=Tn6-PIqc4UM" },
          { title: "React Crash Course", channel: "Traversy Media", length: "1:48:00", url: "https://www.youtube.com/watch?v=w7ejDZ8SWv8" },
        ],
        docs: [{ title: "Official React Documentation", type: "Official Docs", url: "https://react.dev/" }]
      },
      "python": {
        videos: [
          { title: "Python in 100 Seconds", channel: "Fireship", length: "1:45", url: "https://www.youtube.com/watch?v=x7X9w_GIm1s" },
          { title: "Python Full Course", channel: "Programming with Mosh", length: "6:14:00", url: "https://www.youtube.com/watch?v=_uQrJ0TkZlc" },
        ],
        docs: [{ title: "Official Python Docs", type: "Official Docs", url: "https://docs.python.org/3/" }]
      }
    };

    const fallback = {
      videos: [
        { title: `${skillName} in 100 Seconds`, channel: "Fireship", length: "1:42", url: `https://www.youtube.com/results?search_query=Fireship+${encodedSkill}+in+100+seconds` },
        { title: `Full ${skillName} Crash Course`, channel: "FreeCodeCamp", length: "2:14:00", url: `https://www.youtube.com/results?search_query=FreeCodeCamp+${encodedSkill}+course` },
      ],
      docs: [{ title: `Official ${skillName} Docs`, type: "Official Site", url: `https://www.google.com/search?q=${encodedSkill}+official+documentation` }]
    };

    const resources = resourceMap[normalizedSkill] || fallback;
    
    return {
      title: `Mastering ${skillName}`,
      weeks: [
        { week: 1, title: `Core Fundamentals`, desc: `Understand the architecture, basic syntax, and primary use cases of ${skillName}.` },
        { week: 2, title: `Intermediate Implementation`, desc: `Build a small CRUD application or data pipeline focusing entirely on ${skillName}.` },
        { week: 3, title: `Advanced Patterns`, desc: `Dive into optimization, security, and scaling ${skillName} for enterprise environments.` },
        { week: 4, title: `Portfolio Integration`, desc: `Integrate ${skillName} with your existing projects to prove competency.` }
      ],
      ...resources
    };
  };

  // --- COMPONENTS ---

  const renderLoginPage = () => (
    <div className="flex-1 flex flex-col items-center justify-center p-6 relative z-10 animate-fade-in-up">
      <div className={`w-full max-w-lg p-10 border-[4px] backdrop-blur-lg ${theme === 'dark' ? 'bg-[#001A23]/95 border-[#B3EFB2] shadow-[12px_12px_0px_0px_rgba(179,239,178,1)]' : 'bg-[#E8F1F2]/95 border-[#001A23] shadow-[12px_12px_0px_0px_rgba(0,26,35,1)]'}`}>
        <h2 className={`text-5xl font-bold uppercase tracking-widest text-center mb-8 ${theme === 'dark' ? 'text-[#E8F1F2]' : 'text-[#001A23]'}`}>System Login</h2>
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className={`block text-xl font-bold mb-2 uppercase tracking-wider ${theme === 'dark' ? 'text-[#B3EFB2]' : 'text-[#001A23]'}`}>Operator ID</label>
            <input 
              type="text" 
              name="username"
              required
              placeholder="Enter your handle..."
              className={`w-full px-4 py-4 border-[4px] focus:outline-none focus:ring-0 font-bold text-2xl ${theme === 'dark' ? 'bg-[#001A23] border-[#B3EFB2] text-[#E8F1F2] placeholder-[#B3EFB2]/50' : 'bg-[#E8F1F2] border-[#001A23] text-[#001A23] placeholder-[#001A23]/50'}`}
            />
          </div>
          <button 
            type="submit"
            className={`w-full py-5 font-bold text-2xl uppercase tracking-widest border-4 transition-all duration-300 hover:scale-105 ${theme === 'dark' ? 'bg-[#B3EFB2] text-[#001A23] border-[#B3EFB2] shadow-[6px_6px_0px_0px_rgba(179,239,178,1)]' : 'bg-[#001A23] text-[#E8F1F2] border-[#001A23] shadow-[6px_6px_0px_0px_rgba(0,26,35,1)]'}`}
          >
            Access Mainframe
          </button>
        </form>
      </div>
    </div>
  );

  const renderHomePage = () => (
    <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-12 w-full max-w-7xl mx-auto relative z-10 animate-fade-in-up">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
        <div className={`col-span-1 md:col-span-2 border-[4px] p-8 md:p-16 relative overflow-hidden backdrop-blur-md transition-colors duration-300 ${theme === 'dark' ? 'border-[#B3EFB2] bg-[#001A23]/80 shadow-[8px_8px_0px_0px_rgba(179,239,178,1)]' : 'border-[#001A23] bg-[#E8F1F2]/80 shadow-[8px_8px_0px_0px_rgba(0,26,35,1)]'}`}>
          <div className="max-w-4xl mx-auto text-center space-y-8 relative z-10">
            <h1 className={`text-6xl md:text-8xl font-bold tracking-widest uppercase transition-colors duration-300 drop-shadow-md ${theme === 'dark' ? 'text-[#E8F1F2]' : 'text-[#001A23]'}`}>
              Nexus Core
            </h1>
            <p className={`text-2xl md:text-4xl leading-relaxed transition-colors duration-300 ${theme === 'dark' ? 'text-[#E8F1F2]' : 'text-[#001A23]'}`}>
              Bridging the gap between static academic curriculums and rapidly evolving industry realities. Upload your syllabus, target a role, and uncover the exact skill gaps holding you back.
            </p>
          </div>
        </div>

        <div className={`border-[4px] relative overflow-hidden h-80 md:h-96 transition-colors duration-300 flex items-center justify-center group ${theme === 'dark' ? 'border-[#B3EFB2] bg-[#B3EFB2] shadow-[8px_8px_0px_0px_rgba(179,239,178,1)]' : 'border-[#001A23] bg-[#001A23] shadow-[8px_8px_0px_0px_rgba(0,26,35,1)]'}`}>
          <div className="absolute inset-0 z-0 opacity-70 group-hover:opacity-100 transition-opacity duration-500">
            <PixelBlast />
          </div>
          <div className={`relative z-10 px-8 py-3 border-4 font-bold tracking-widest uppercase text-xl backdrop-blur-md shadow-lg ${theme === 'dark' ? 'bg-[#001A23]/90 border-[#B3EFB2] text-[#B3EFB2]' : 'bg-[#E8F1F2]/90 border-[#001A23] text-[#001A23]'}`}>
            AI Vector Engine
          </div>
        </div>

        <div onClick={() => setCurrentView('analyzer')} className={`border-[4px] p-8 md:p-12 h-80 md:h-96 flex flex-col justify-center items-center transition-colors duration-300 relative overflow-hidden backdrop-blur-md group cursor-pointer ${theme === 'dark' ? 'border-[#B3EFB2] bg-[#B3EFB2] hover:bg-[#E8F1F2] shadow-[8px_8px_0px_0px_rgba(179,239,178,1)] text-[#001A23]' : 'border-[#001A23] bg-[#B3EFB2] hover:bg-[#001A23] shadow-[8px_8px_0px_0px_rgba(0,26,35,1)] text-[#001A23] hover:text-[#E8F1F2]'}`}>
          <h2 className="text-4xl md:text-5xl font-bold mb-8 text-center leading-tight tracking-wider group-hover:scale-105 transition-transform duration-300">
            Ready to align your curriculum?
          </h2>
          <button className={`px-10 py-4 font-bold text-2xl uppercase tracking-widest border-4 transition-all duration-300 ${theme === 'dark' ? 'bg-[#001A23] text-[#B3EFB2] border-[#001A23] hover:bg-transparent hover:text-[#001A23] shadow-[4px_4px_0px_0px_rgba(0,26,35,1)]' : 'bg-[#E8F1F2] text-[#001A23] border-[#001A23] hover:bg-transparent hover:text-[#E8F1F2] shadow-[4px_4px_0px_0px_rgba(0,26,35,1)]'}`}>
            Launch Analyzer
          </button>
        </div>
      </div>
    </div>
  );

  const renderAnalyzerPage = () => (
    <div className="flex-1 flex flex-col items-center justify-center p-6 w-full max-w-7xl mx-auto relative z-10 animate-fade-in-up">
      <div className={`w-full space-y-8 p-8 border-[4px] backdrop-blur-lg ${theme === 'dark' ? 'bg-[#001A23]/95 border-[#B3EFB2] shadow-[12px_12px_0px_0px_rgba(179,239,178,1)]' : 'bg-[#E8F1F2]/95 border-[#001A23] shadow-[12px_12px_0px_0px_rgba(0,26,35,1)]'}`}>
        
        <div className={`flex justify-between items-center mb-12 border-b-4 pb-4 transition-colors duration-300 ${theme === 'dark' ? 'border-[#B3EFB2]' : 'border-[#001A23]'}`}>
          <h2 className={`text-3xl font-bold uppercase tracking-widest ${theme === 'dark' ? 'text-[#E8F1F2]' : 'text-[#001A23]'}`}>Nexus Core // Workspace</h2>
          <button 
            onClick={() => { setCurrentView('home'); }}
            className={`text-xl font-bold uppercase tracking-widest transition-colors duration-300 ${theme === 'dark' ? 'text-[#E8F1F2] hover:text-[#B3EFB2]' : 'text-[#001A23] hover:text-[#B3EFB2]'}`}
          >
            &larr; Back to Home
          </button>
        </div>

        {/* UPLOAD ZONE */}
        {!loading && !results && (
          <div className="text-center space-y-10 max-w-4xl mx-auto">
            <div className="w-full max-w-md mx-auto text-left">
              <label className={`block text-2xl font-bold mb-3 uppercase tracking-wider transition-colors duration-300 ${theme === 'dark' ? 'text-[#E8F1F2]' : 'text-[#001A23]'}`}>
                Target Industry Role
              </label>
              <input 
                type="text" 
                value={jobRole}
                onChange={(e) => setJobRole(e.target.value)}
                placeholder="e.g. Frontend Developer"
                className={`w-full px-4 py-4 border-[4px] focus:outline-none focus:ring-0 transition-colors duration-300 font-bold text-2xl ${theme === 'dark' ? 'bg-[#001A23] border-[#B3EFB2] text-[#E8F1F2] placeholder-[#B3EFB2]/50' : 'bg-[#E8F1F2] border-[#001A23] text-[#001A23] placeholder-[#001A23]/50'}`}
              />
            </div>

            <div 
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
              className={`border-[4px] border-dashed p-20 transition-colors duration-300 cursor-pointer ${theme === 'dark' ? 'border-[#B3EFB2] bg-[#001A23] hover:bg-[#B3EFB2]/10' : 'border-[#001A23] bg-[#E8F1F2] hover:bg-[#001A23]/5'}`}
            >
              <input 
                type="file" 
                accept="application/pdf"
                className="hidden" 
                id="file-upload"
                onChange={(e) => setFile(e.target.files[0])}
              />
              <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
                <span className={`font-bold text-3xl mb-4 transition-colors duration-300 tracking-widest ${theme === 'dark' ? 'text-[#B3EFB2]' : 'text-[#001A23]'}`}>
                  {file ? file.name : "DRAG & DROP SYLLABUS PDF"}
                </span>
                <span className={`text-xl font-bold tracking-wider ${theme === 'dark' ? 'text-[#E8F1F2]' : 'text-[#001A23]'}`}>or click to browse your files</span>
              </label>
            </div>

            <button 
              onClick={analyzeSyllabus}
              disabled={!file || !jobRole}
              className={`px-16 py-5 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-3xl uppercase tracking-widest transition-all duration-300 hover:scale-105 border-4 ${theme === 'dark' ? 'bg-[#B3EFB2] text-[#001A23] border-[#B3EFB2] hover:bg-[#001A23] hover:text-[#B3EFB2] shadow-[6px_6px_0px_0px_rgba(179,239,178,1)]' : 'bg-[#001A23] text-[#E8F1F2] border-[#001A23] hover:bg-[#B3EFB2] hover:text-[#001A23] shadow-[6px_6px_0px_0px_rgba(0,26,35,1)]'}`}
            >
              Initialize Analysis
            </button>
          </div>
        )}

        {/* PROCESSING */}
        {loading && (
          <div className="flex flex-col items-center justify-center space-y-10 py-32">
            <div className={`w-24 h-24 border-[6px] border-t-transparent animate-spin transition-colors duration-300 ${theme === 'dark' ? 'border-[#B3EFB2]' : 'border-[#001A23]'}`}></div>
            <div className={`text-4xl font-bold uppercase tracking-widest transition-colors duration-300 ${theme === 'dark' ? 'text-[#E8F1F2]' : 'text-[#001A23]'}`}>
              <Shuffle text="Querying Market Data..." />
            </div>
          </div>
        )}

        {/* RESULTS */}
        {results && !loading && (
          <div className="space-y-12 transition-colors duration-300">
            <div className={`flex flex-col md:flex-row justify-between items-start md:items-end border-b-4 pb-6 transition-colors duration-300 ${theme === 'dark' ? 'border-[#B3EFB2]' : 'border-[#001A23]'}`}>
              <div>
                <h2 className={`text-5xl font-bold uppercase tracking-widest transition-colors duration-300 ${theme === 'dark' ? 'text-[#E8F1F2]' : 'text-[#001A23]'}`}>Analysis Complete</h2>
                <p className={`font-bold text-xl mt-3 flex flex-col md:flex-row md:items-center gap-2 md:gap-4 transition-colors duration-300 tracking-wider ${theme === 'dark' ? 'text-[#E8F1F2]' : 'text-[#001A23]'}`}>
                  <span>File: {results.filename}</span>
                  <span className="hidden md:inline">|</span>
                  <span>Optimized for: <span className={`font-bold ${theme === 'dark' ? 'text-[#B3EFB2]' : 'text-[#001A23]'}`}>{results.target_role}</span></span>
                </p>
              </div>
              <button 
                onClick={() => { setResults(null); setFile(null); }}
                className={`mt-6 md:mt-0 px-8 py-3 border-4 font-bold uppercase text-xl tracking-widest transition-all duration-300 ${theme === 'dark' ? 'border-[#B3EFB2] text-[#B3EFB2] hover:bg-[#B3EFB2] hover:text-[#001A23] shadow-[4px_4px_0px_0px_rgba(179,239,178,1)]' : 'border-[#001A23] text-[#001A23] hover:bg-[#001A23] hover:text-[#E8F1F2] shadow-[4px_4px_0px_0px_rgba(0,26,35,1)]'}`}
              >
                Start Over
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
              <div className={`col-span-1 border-[4px] p-6 flex flex-col items-center justify-center ${theme === 'dark' ? 'border-[#B3EFB2] bg-[#001A23]' : 'border-[#001A23] bg-[#E8F1F2]'}`}>
                <h3 className={`text-2xl font-bold w-full text-center mb-4 uppercase tracking-widest ${theme === 'dark' ? 'text-[#E8F1F2]' : 'text-[#001A23]'}`}>Competency Web</h3>
                <div className="w-full h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={generateRadarData()}>
                      <PolarGrid stroke={theme === 'dark' ? '#B3EFB2' : '#001A23'} strokeOpacity={0.3} />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: theme === 'dark' ? '#E8F1F2' : '#001A23', fontSize: 14, fontFamily: "'VT323', monospace", fontWeight: 'bold' }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: theme === 'dark' ? '#001A23' : '#E8F1F2', border: `4px solid ${theme === 'dark' ? '#B3EFB2' : '#001A23'}`, color: theme === 'dark' ? '#B3EFB2' : '#001A23', fontFamily: "'VT323', monospace", fontSize: '1.2rem', fontWeight: 'bold' }} itemStyle={{ color: theme === 'dark' ? '#E8F1F2' : '#001A23' }} />
                      <Radar name="Coverage %" dataKey="coverage" stroke={theme === 'dark' ? '#B3EFB2' : '#001A23'} strokeWidth={3} fill={theme === 'dark' ? '#B3EFB2' : '#001A23'} fillOpacity={0.4} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="col-span-1 lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <h3 className={`text-3xl font-bold border-b-4 pb-3 flex items-center justify-between transition-colors duration-300 ${theme === 'dark' ? 'text-[#E8F1F2] border-[#E8F1F2]' : 'text-[#001A23] border-[#001A23]'}`}>
                    <span>Covered Skills</span>
                    <span className={`text-xl font-bold ${theme === 'dark' ? 'text-[#B3EFB2]' : 'text-[#001A23]'}`}>{results.coverage_stats?.covered_count} Matches</span>
                  </h3>
                  <div className="flex flex-wrap gap-4">
                    {results.covered_skills?.map((item, index) => {
                      const skillName = typeof item === 'object' ? item.skill : item;
                      return (
                        <span key={index} className={`px-5 py-2 border-4 font-bold flex flex-col transition-colors duration-300 ${theme === 'dark' ? 'bg-[#001A23] text-[#E8F1F2] border-[#B3EFB2] shadow-[4px_4px_0px_0px_rgba(179,239,178,1)]' : 'bg-[#E8F1F2] text-[#001A23] border-[#001A23] shadow-[4px_4px_0px_0px_rgba(0,26,35,1)]'}`}>
                          <span className="text-2xl tracking-wider">{skillName}</span>
                          {item.confidence && <span className={`text-lg mt-1 ${theme === 'dark' ? 'text-[#B3EFB2]' : 'text-[#001A23]'}`}>{Number(item.confidence).toFixed(0)}% match</span>}
                        </span>
                      )
                    })}
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className={`text-3xl font-bold border-b-4 pb-3 flex items-center justify-between transition-colors duration-300 ${theme === 'dark' ? 'text-[#E8F1F2] border-[#E8F1F2]' : 'text-[#001A23] border-[#001A23]'}`}>
                    <span>Industry Gaps</span>
                    <span className={`text-xl font-bold animate-pulse ${theme === 'dark' ? 'text-[#B3EFB2]' : 'text-[#001A23]'}`}>Missing</span>
                  </h3>
                  <div className="space-y-4 max-h-48 overflow-y-auto pr-4 custom-scrollbar">
                    {(!results.skill_delta || results.skill_delta.length === 0) ? (
                      <p className={`font-bold text-xl uppercase ${theme === 'dark' ? 'text-[#E8F1F2]' : 'text-[#001A23]'}`}>100% Alignment</p>
                    ) : (
                      results.skill_delta.map((item, index) => {
                         const missingSkill = typeof item === 'object' ? item.skill : item;
                         const completedWeeks = (userProgress[missingSkill] || []).length;
                         const baseConfidence = item.confidence ? Number(item.confidence) : 20;
                         const boostedConfidence = Math.min(100, Math.floor(baseConfidence + (completedWeeks * ((100 - baseConfidence) / 4))));

                         return (
                          <div key={index} className={`border-[4px] p-4 transition-colors duration-300 flex justify-between items-center ${theme === 'dark' ? 'border-[#B3EFB2] bg-[#001A23]' : 'border-[#001A23] bg-[#B3EFB2]'}`}>
                            <h4 className={`font-bold text-xl tracking-wider ${theme === 'dark' ? 'text-[#E8F1F2]' : 'text-[#001A23]'}`}>{missingSkill}</h4>
                            <span className={`text-sm font-bold px-2 py-1 border-2 ${completedWeeks === 4 ? 'bg-green-500 text-black border-black' : (theme === 'dark' ? 'bg-[#B3EFB2] text-[#001A23] border-[#E8F1F2]' : 'bg-[#001A23] text-[#B3EFB2] border-[#001A23]')}`}>
                              {boostedConfidence}% {completedWeeks === 4 && '✓'}
                            </span>
                          </div>
                         )
                      })
                    )}
                  </div>
                  
                  {/* WORKFLOW NAVIGATION BUTTONS */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                    {results.skill_delta && results.skill_delta.length > 0 && (
                      <button 
                        onClick={() => {
                          const firstSkill = typeof results.skill_delta[0] === 'object' ? results.skill_delta[0].skill : results.skill_delta[0];
                          setActiveFixItSkill(firstSkill);
                          setCurrentView('fixit');
                        }}
                        className={`w-full py-4 font-bold text-lg uppercase tracking-widest border-4 transition-all duration-300 hover:-translate-y-1 ${theme === 'dark' ? 'bg-[#B3EFB2] text-[#001A23] border-[#B3EFB2] shadow-[4px_4px_0px_0px_rgba(179,239,178,1)]' : 'bg-[#001A23] text-[#E8F1F2] border-[#001A23] shadow-[4px_4px_0px_0px_rgba(0,26,35,1)]'}`}
                      >
                        Fix-It Protocol
                      </button>
                    )}
                    <button 
                      onClick={() => launchInterview('soft')} // Always Soft Skills Mode from here
                      className={`w-full py-4 font-bold text-lg uppercase tracking-widest border-4 transition-all duration-300 hover:-translate-y-1 ${theme === 'dark' ? 'bg-[#E8F1F2] text-[#001A23] border-[#E8F1F2] shadow-[4px_4px_0px_0px_rgba(232,241,242,1)]' : 'bg-[#B3EFB2] text-[#001A23] border-[#001A23] shadow-[4px_4px_0px_0px_rgba(0,26,35,1)]'}`}
                    >
                      Test Soft Skills
                    </button>
                    <button 
                      onClick={() => setCurrentView('jobs')}
                      className={`w-full py-4 font-bold text-lg uppercase tracking-widest border-4 transition-all duration-300 hover:-translate-y-1 ${theme === 'dark' ? 'bg-[#001A23] text-[#B3EFB2] border-[#B3EFB2] shadow-[4px_4px_0px_0px_rgba(179,239,178,1)]' : 'bg-[#E8F1F2] text-[#001A23] border-[#001A23] shadow-[4px_4px_0px_0px_rgba(0,26,35,1)]'}`}
                    >
                      Job Hub
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderFixItPage = () => {
    const plan = generateFixItPlan(activeFixItSkill);
    const completedWeeks = (userProgress[activeFixItSkill] || []).length;
    const isSkillFullyCompleted = completedWeeks === 4;

    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 w-full max-w-[1400px] mx-auto relative z-10 animate-fade-in-up">
        <div className={`w-full p-8 border-[4px] backdrop-blur-lg ${theme === 'dark' ? 'bg-[#001A23]/95 border-[#B3EFB2] shadow-[12px_12px_0px_0px_rgba(179,239,178,1)]' : 'bg-[#E8F1F2]/95 border-[#001A23] shadow-[12px_12px_0px_0px_rgba(0,26,35,1)]'}`}>
          <div className={`flex justify-between items-center mb-8 border-b-4 pb-4 transition-colors duration-300 ${theme === 'dark' ? 'border-[#B3EFB2]' : 'border-[#001A23]'}`}>
            <h2 className={`text-4xl font-bold uppercase tracking-widest ${theme === 'dark' ? 'text-[#E8F1F2]' : 'text-[#001A23]'}`}>Nexus Core // Fix-It Protocol</h2>
            <button 
              onClick={() => setCurrentView('analyzer')}
              className={`text-xl font-bold uppercase tracking-widest transition-colors duration-300 ${theme === 'dark' ? 'text-[#E8F1F2] hover:text-[#B3EFB2]' : 'text-[#001A23] hover:text-[#B3EFB2]'}`}
            >
              &larr; Back to Analyzer
            </button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            
            <div className="lg:col-span-4 flex flex-col space-y-8">
              <div className={`border-[4px] p-4 flex flex-col items-center justify-center ${theme === 'dark' ? 'border-[#B3EFB2] bg-[#001A23]' : 'border-[#001A23] bg-[#E8F1F2]'}`}>
                <h3 className={`text-2xl font-bold w-full text-center mb-2 uppercase tracking-widest ${theme === 'dark' ? 'text-[#E8F1F2]' : 'text-[#001A23]'}`}>Gap Analysis</h3>
                <div className="w-full h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="75%" data={generateRadarData()}>
                      <PolarGrid stroke={theme === 'dark' ? '#B3EFB2' : '#001A23'} strokeOpacity={0.4} />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: theme === 'dark' ? '#E8F1F2' : '#001A23', fontSize: 16, fontFamily: "'VT323', monospace", fontWeight: 'bold' }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar name="Coverage %" dataKey="coverage" stroke={theme === 'dark' ? '#B3EFB2' : '#001A23'} strokeWidth={4} fill={theme === 'dark' ? '#B3EFB2' : '#001A23'} fillOpacity={0.5} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="space-y-4">
                <h3 className={`text-2xl font-bold border-b-4 pb-2 uppercase tracking-widest ${theme === 'dark' ? 'text-[#B3EFB2] border-[#B3EFB2]' : 'text-[#001A23] border-[#001A23]'}`}>Target Competencies</h3>
                <div className="flex flex-col gap-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                  {results?.skill_delta?.map((item, index) => {
                    const skillName = typeof item === 'object' ? item.skill : item;
                    const isActive = activeFixItSkill === skillName;
                    const completed = (userProgress[skillName] || []).length;
                    return (
                      <button 
                        key={index}
                        onClick={() => setActiveFixItSkill(skillName)}
                        className={`text-left px-4 py-3 border-[4px] font-bold text-xl uppercase tracking-wider transition-all duration-200 flex justify-between items-center ${isActive ? (theme === 'dark' ? 'bg-[#B3EFB2] text-[#001A23] border-[#B3EFB2] translate-x-2' : 'bg-[#001A23] text-[#E8F1F2] border-[#001A23] translate-x-2') : (theme === 'dark' ? 'bg-[#001A23] text-[#E8F1F2] border-[#E8F1F2] hover:border-[#B3EFB2]' : 'bg-[#E8F1F2] text-[#001A23] border-[#001A23] hover:bg-[#B3EFB2]')}`}
                      >
                        <span>&gt; {skillName}</span>
                        <span className="text-sm border-2 px-2 py-0.5">{completed}/4</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
            
            <div className={`lg:col-span-8 border-[4px] p-8 flex flex-col ${theme === 'dark' ? 'border-[#B3EFB2] bg-[#001A23]' : 'border-[#001A23] bg-[#E8F1F2]'}`}>
              {plan && (
                <div className="space-y-10 animate-fade-in-up" key={activeFixItSkill}>
                  <div className={`border-b-4 pb-4 ${theme === 'dark' ? 'border-[#B3EFB2]' : 'border-[#001A23]'}`}>
                    <h2 className={`text-5xl font-bold uppercase tracking-widest ${theme === 'dark' ? 'text-[#B3EFB2]' : 'text-[#001A23]'}`}>{plan.title}</h2>
                    <p className={`text-2xl mt-2 ${theme === 'dark' ? 'text-[#E8F1F2]' : 'text-[#001A23]'}`}>AI-Generated 4-Week Micro-Curriculum & Resource Hub</p>
                  </div>
                  
                  {/* GAMIFIED CURRICULUM */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {plan.weeks.map((w, i) => {
                      const isCompleted = (userProgress[activeFixItSkill] || []).includes(w.week);
                      return (
                        <div 
                          key={i} 
                          onClick={() => toggleProgress(activeFixItSkill, w.week)}
                          className={`p-5 cursor-pointer border-l-[6px] border-y-[4px] border-r-[4px] transition-all duration-300 hover:scale-[1.02] ${isCompleted ? (theme === 'dark' ? 'bg-[#B3EFB2] text-[#001A23] border-[#B3EFB2]' : 'bg-[#001A23] text-[#E8F1F2] border-[#001A23]') : (theme === 'dark' ? 'bg-[#001A23] text-[#E8F1F2] border-[#B3EFB2]' : 'bg-[#E8F1F2] text-[#001A23] border-[#001A23]')}`}
                        >
                          <div className="flex justify-between items-start">
                            <h4 className={`text-2xl font-bold uppercase tracking-wider`}>Week {w.week}: {w.title}</h4>
                            <span className="text-2xl">{isCompleted ? '☑' : '☐'}</span>
                          </div>
                          <p className={`text-xl mt-3 leading-snug opacity-90`}>{w.desc}</p>
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-4">
                      <h3 className={`text-3xl font-bold uppercase tracking-widest border-b-4 pb-2 ${theme === 'dark' ? 'text-[#E8F1F2] border-[#E8F1F2]' : 'text-[#001A23] border-[#001A23]'}`}>Video Tutorials</h3>
                      <div className="space-y-3">
                        {plan.videos.map((vid, i) => (
                          <a key={i} href={vid.url} target="_blank" rel="noopener noreferrer" className={`flex items-center justify-between p-3 border-[4px] cursor-pointer hover:scale-[1.02] transition-transform block ${theme === 'dark' ? 'border-[#E8F1F2] hover:border-[#B3EFB2] bg-[#001A23]' : 'border-[#001A23] hover:bg-[#B3EFB2] bg-[#E8F1F2]'}`}>
                            <div>
                              <p className={`font-bold text-xl ${theme === 'dark' ? 'text-[#B3EFB2]' : 'text-[#001A23]'}`}>{vid.title}</p>
                              <p className={`text-lg ${theme === 'dark' ? 'text-[#E8F1F2]/70' : 'text-[#001A23]/70'}`}>{vid.channel}</p>
                            </div>
                            <span className={`font-bold text-lg px-2 py-1 border-2 ${theme === 'dark' ? 'border-[#E8F1F2] text-[#E8F1F2]' : 'border-[#001A23] text-[#001A23]'}`}>{vid.length}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-4">
                      <h3 className={`text-3xl font-bold uppercase tracking-widest border-b-4 pb-2 ${theme === 'dark' ? 'text-[#E8F1F2] border-[#E8F1F2]' : 'text-[#001A23] border-[#001A23]'}`}>Source Materials</h3>
                      <div className="space-y-3">
                        {plan.docs.map((doc, i) => (
                          <a key={i} href={doc.url} target="_blank" rel="noopener noreferrer" className={`block p-3 border-[4px] cursor-pointer hover:scale-[1.02] transition-transform ${theme === 'dark' ? 'border-[#E8F1F2] hover:border-[#B3EFB2] bg-[#001A23]' : 'border-[#001A23] hover:bg-[#B3EFB2] bg-[#E8F1F2]'}`}>
                            <p className={`font-bold text-xl ${theme === 'dark' ? 'text-[#B3EFB2]' : 'text-[#001A23]'}`}>{doc.title}</p>
                            <p className={`text-lg uppercase tracking-widest mt-1 ${theme === 'dark' ? 'text-[#E8F1F2]/70' : 'text-[#001A23]/70'}`}>{doc.type}</p>
                          </a>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* DYNAMIC TECH INTERVIEW BUTTON (ONLY APPEARS AT 4/4 PROGRESS) */}
                  {isSkillFullyCompleted && (
                    <div className="pt-6 border-t-4 border-dashed opacity-90 border-green-500 animate-fade-in-up">
                       <button 
                          onClick={() => launchInterview('tech', activeFixItSkill)} 
                          className={`w-full py-5 font-bold text-2xl uppercase tracking-widest border-4 transition-all duration-300 hover:-translate-y-1 ${theme === 'dark' ? 'bg-[#E8F1F2] text-[#001A23] border-[#E8F1F2] shadow-[6px_6px_0px_0px_rgba(232,241,242,1)]' : 'bg-[#B3EFB2] text-[#001A23] border-[#001A23] shadow-[6px_6px_0px_0px_rgba(0,26,35,1)]'}`}
                        >
                          Initiate Technical Assessment: {activeFixItSkill}
                        </button>
                    </div>
                  )}

                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // --- LIVELOGIC: TWO MODES WITH LIVE TRANSCRIPTION & DYNAMIC EVALUATION ---
  const renderLiveLogicPage = () => {
    const questions = getInterviewQuestions();
    const metrics = interviewComplete ? calculateInterviewMetrics() : null;

    return (
      <div className="flex-1 flex flex-col items-center justify-start p-6 w-full max-w-6xl mx-auto relative z-10 animate-fade-in-up mt-6">
        <div className={`w-full p-8 border-[4px] backdrop-blur-lg ${theme === 'dark' ? 'bg-[#001A23]/95 border-[#B3EFB2] shadow-[12px_12px_0px_0px_rgba(179,239,178,1)]' : 'bg-[#E8F1F2]/95 border-[#001A23] shadow-[12px_12px_0px_0px_rgba(0,26,35,1)]'}`}>
          <div className={`flex justify-between items-center mb-8 border-b-4 pb-4 transition-colors duration-300 ${theme === 'dark' ? 'border-[#B3EFB2]' : 'border-[#001A23]'}`}>
            <h2 className={`text-4xl font-bold uppercase tracking-widest ${theme === 'dark' ? 'text-[#E8F1F2]' : 'text-[#001A23]'}`}>
              {interviewMode === 'tech' ? `LiveLogic // Technical Assessment: ${activeFixItSkill}` : 'LiveLogic // AI Soft-Skill Assessment'}
            </h2>
            <button 
              onClick={() => { stopMedia(); setCurrentView(interviewMode === 'tech' ? 'fixit' : 'analyzer'); }}
              className={`text-xl font-bold uppercase tracking-widest transition-colors duration-300 ${theme === 'dark' ? 'text-[#E8F1F2] hover:text-[#B3EFB2]' : 'text-[#001A23] hover:text-[#B3EFB2]'}`}
            >
              &larr; Abort Assessment
            </button>
          </div>

          {!interviewStarted && !interviewComplete && (
            <div className="text-center py-16 space-y-8">
              <h3 className={`text-4xl font-bold uppercase tracking-widest ${theme === 'dark' ? 'text-[#B3EFB2]' : 'text-[#001A23]'}`}>
                Ready to calibrate your {interviewMode === 'tech' ? 'technical vocabulary' : 'behavioral metrics'}?
              </h3>
              <p className={`text-2xl max-w-3xl mx-auto leading-relaxed ${theme === 'dark' ? 'text-[#E8F1F2]' : 'text-[#001A23]'}`}>
                {interviewMode === 'tech' 
                  ? `LiveLogic activates real-time speech recognition to evaluate your architectural logic and depth of knowledge regarding ${activeFixItSkill}.` 
                  : `LiveLogic analyzes your delivery cadence, keyword usage, and conceptual confidence for target role: ${results?.target_role || "Software Engineer"}.`}
              </p>
              <button 
                onClick={startCamera}
                className={`px-12 py-5 font-bold text-3xl uppercase tracking-widest border-4 transition-all duration-300 hover:scale-105 ${theme === 'dark' ? 'bg-[#B3EFB2] text-[#001A23] border-[#B3EFB2] shadow-[6px_6px_0px_0px_rgba(179,239,178,1)]' : 'bg-[#001A23] text-[#E8F1F2] border-[#001A23] shadow-[6px_6px_0px_0px_rgba(0,26,35,1)]'}`}
              >
                Enable Camera & Start
              </button>
            </div>
          )}

          {interviewStarted && !interviewComplete && (
            <div className="space-y-6 animate-fade-in-up">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* RELIABLE CAMERA ATTACHMENT */}
                <div className={`border-[4px] h-[360px] relative flex flex-col items-center justify-center p-2 overflow-hidden ${theme === 'dark' ? 'border-[#B3EFB2] bg-black/90' : 'border-[#001A23] bg-black/90'}`}>
                  <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
                    <span className={`w-4 h-4 rounded-full ${recording ? 'bg-red-500 animate-ping' : 'bg-gray-500'}`}></span>
                    <span className={`text-lg font-bold uppercase tracking-wider px-2 ${recording ? 'text-red-500 bg-black/70' : 'text-gray-300 bg-black/70'}`}>
                      {recording ? "REC // LIVE MIC" : "CAMERA STANDBY"}
                    </span>
                  </div>

                  <video 
                    ref={(el) => {
                      if (el && mediaStream && el.srcObject !== mediaStream) {
                        el.srcObject = mediaStream;
                      }
                    }} 
                    autoPlay 
                    muted 
                    playsInline 
                    className={`w-full h-full object-cover filter ${recording ? 'contrast-125 saturate-125' : 'grayscale opacity-90'} transition-all duration-500`} 
                  />

                  {recording && (
                    <div className="absolute bottom-4 left-0 w-full px-4 z-20">
                      <div className="h-2 w-full bg-black/50 border-2 border-[#B3EFB2] overflow-hidden">
                        <div className="h-full bg-[#B3EFB2] animate-pulse w-3/4"></div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Question Prompt */}
                <div className={`border-[4px] h-[360px] p-8 flex flex-col justify-between ${theme === 'dark' ? 'border-[#B3EFB2] bg-[#001A23]' : 'border-[#001A23] bg-[#E8F1F2]'}`}>
                  <div className="space-y-3">
                    <span className="text-xl font-bold uppercase tracking-widest opacity-70">Question {currentQuestionIdx + 1} of {questions.length}</span>
                    <h3 className={`text-3xl font-bold leading-snug tracking-wide ${theme === 'dark' ? 'text-[#B3EFB2]' : 'text-[#001A23]'}`}>
                      "{questions[currentQuestionIdx]}"
                    </h3>
                  </div>

                  <div className="flex gap-4">
                    {!recording ? (
                      <button 
                        onClick={startSpeaking}
                        className={`w-full py-5 font-bold text-2xl uppercase tracking-widest border-4 transition-transform hover:-translate-y-1 ${theme === 'dark' ? 'bg-[#B3EFB2] text-[#001A23] border-[#B3EFB2]' : 'bg-[#001A23] text-[#E8F1F2] border-[#001A23]'}`}
                      >
                        Start Speaking
                      </button>
                    ) : (
                      <button 
                        onClick={handleStopRecording}
                        className={`w-full py-5 font-bold text-2xl uppercase tracking-widest border-4 animate-pulse bg-red-600 text-white border-black`}
                      >
                        Submit Answer
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* LIVE TRANSCRIPTION TERMINAL */}
              <div className={`border-[4px] p-6 ${theme === 'dark' ? 'border-[#B3EFB2] bg-black/60' : 'border-[#001A23] bg-white/70'}`}>
                <div className="flex justify-between items-center border-b-2 pb-2 mb-4 opacity-80">
                  <span className="text-xl font-bold uppercase tracking-widest">LIVE TRANSCRIPTION STREAM</span>
                  <span className="text-lg">{recording ? "LISTENING..." : "IDLE"}</span>
                </div>
                <p className={`text-2xl font-bold tracking-wide min-h-[80px] leading-relaxed ${liveTranscript ? (theme === 'dark' ? 'text-[#B3EFB2]' : 'text-[#001A23]') : 'opacity-40 italic'}`}>
                  {liveTranscript || (recording ? "Speak now — voice transcription is capturing your input in real time..." : "Press 'Start Speaking' and state your response aloud.")}
                </p>
              </div>

            </div>
          )}

          {interviewComplete && metrics && (
            <div className="py-8 space-y-8 animate-fade-in-up">
              <div className={`p-8 border-[4px] text-center space-y-4 ${theme === 'dark' ? 'border-[#B3EFB2] bg-[#001A23]' : 'border-[#001A23] bg-[#E8F1F2]'}`}>
                <h3 className={`text-5xl font-bold uppercase tracking-widest ${theme === 'dark' ? 'text-[#B3EFB2]' : 'text-[#001A23]'}`}>
                  Assessment Complete!
                </h3>
                <p className={`text-3xl font-bold ${theme === 'dark' ? 'text-[#E8F1F2]' : 'text-[#001A23]'}`}>
                  {interviewMode === 'tech' ? 'Technical Competency Score:' : 'Overall Communication Score:'} <span className="underline">{metrics.score}/100</span>
                </p>
              </div>

              {/* REAL DATA METRICS BREAKDOWN */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                <div className={`border-[4px] p-6 ${theme === 'dark' ? 'border-[#B3EFB2] bg-[#001A23]' : 'border-[#001A23] bg-[#E8F1F2]'}`}>
                  <p className="text-xl uppercase opacity-70">Total Words Captured</p>
                  <p className={`text-5xl font-bold mt-2 ${theme === 'dark' ? 'text-[#B3EFB2]' : 'text-[#001A23]'}`}>{metrics.totalWords}</p>
                </div>
                <div className={`border-[4px] p-6 ${theme === 'dark' ? 'border-[#B3EFB2] bg-[#001A23]' : 'border-[#001A23] bg-[#E8F1F2]'}`}>
                  <p className="text-xl uppercase opacity-70">Keywords Detected</p>
                  <p className={`text-5xl font-bold mt-2 ${theme === 'dark' ? 'text-[#B3EFB2]' : 'text-[#001A23]'}`}>{metrics.matchedKeywords.length}</p>
                </div>
                <div className={`border-[4px] p-6 ${theme === 'dark' ? 'border-[#B3EFB2] bg-[#001A23]' : 'border-[#001A23] bg-[#E8F1F2]'}`}>
                  <p className="text-xl uppercase opacity-70">Verbal Clarity Metric</p>
                  <p className={`text-2xl font-bold mt-3 leading-snug ${theme === 'dark' ? 'text-[#B3EFB2]' : 'text-[#001A23]'}`}>{metrics.clarity}</p>
                </div>
              </div>

              <div className="text-center">
                <button 
                  onClick={() => setCurrentView('jobs')}
                  className={`px-12 py-5 font-bold text-3xl uppercase tracking-widest border-4 transition-all duration-300 hover:scale-105 ${theme === 'dark' ? 'bg-[#B3EFB2] text-[#001A23] border-[#B3EFB2] shadow-[6px_6px_0px_0px_rgba(179,239,178,1)]' : 'bg-[#001A23] text-[#E8F1F2] border-[#001A23] shadow-[6px_6px_0px_0px_rgba(0,26,35,1)]'}`}
                >
                  Proceed to Job Market Hub
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    );
  };

  const renderJobHubPage = () => {
    const jobsList = jobTab === 'matches' ? getMockJobs() : savedJobs;

    return (
      <div className="flex-1 flex flex-col items-center justify-start p-6 w-full max-w-5xl mx-auto relative z-10 animate-fade-in-up mt-10">
        <div className={`w-full p-8 border-[4px] backdrop-blur-lg ${theme === 'dark' ? 'bg-[#001A23]/95 border-[#B3EFB2] shadow-[12px_12px_0px_0px_rgba(179,239,178,1)]' : 'bg-[#E8F1F2]/95 border-[#001A23] shadow-[12px_12px_0px_0px_rgba(0,26,35,1)]'}`}>
          <div className={`flex justify-between items-center mb-8 border-b-4 pb-4 transition-colors duration-300 ${theme === 'dark' ? 'border-[#B3EFB2]' : 'border-[#001A23]'}`}>
            <h2 className={`text-4xl font-bold uppercase tracking-widest ${theme === 'dark' ? 'text-[#E8F1F2]' : 'text-[#001A23]'}`}>Nexus Core // Job Applications</h2>
            <button 
              onClick={() => setCurrentView('analyzer')}
              className={`text-xl font-bold uppercase tracking-widest transition-colors duration-300 ${theme === 'dark' ? 'text-[#E8F1F2] hover:text-[#B3EFB2]' : 'text-[#001A23] hover:text-[#B3EFB2]'}`}
            >
              &larr; Back to Analyzer
            </button>
          </div>

          <div className="flex gap-4 mb-8">
            <button 
              onClick={() => setJobTab('matches')}
              className={`px-8 py-3 border-[4px] font-bold text-2xl uppercase tracking-widest transition-all ${jobTab === 'matches' ? (theme === 'dark' ? 'bg-[#B3EFB2] text-[#001A23] border-[#B3EFB2]' : 'bg-[#001A23] text-[#E8F1F2] border-[#001A23]') : (theme === 'dark' ? 'bg-transparent text-[#E8F1F2] border-[#E8F1F2]' : 'bg-transparent text-[#001A23] border-[#001A23]')}`}
            >
              Job Matches
            </button>
            <button 
              onClick={() => setJobTab('saved')}
              className={`px-8 py-3 border-[4px] font-bold text-2xl uppercase tracking-widest transition-all ${jobTab === 'saved' ? (theme === 'dark' ? 'bg-[#B3EFB2] text-[#001A23] border-[#B3EFB2]' : 'bg-[#001A23] text-[#E8F1F2] border-[#001A23]') : (theme === 'dark' ? 'bg-transparent text-[#E8F1F2] border-[#E8F1F2]' : 'bg-transparent text-[#001A23] border-[#001A23]')}`}
            >
              Saved Roles ({savedJobs.length})
            </button>
          </div>

          <div className="space-y-4">
            {jobsList.length === 0 ? (
              <div className={`p-8 border-[4px] text-center ${theme === 'dark' ? 'border-[#E8F1F2] bg-[#001A23]' : 'border-[#001A23] bg-[#E8F1F2]'}`}>
                <p className={`text-2xl font-bold uppercase tracking-widest ${theme === 'dark' ? 'text-[#E8F1F2]/50' : 'text-[#001A23]/50'}`}>No roles found in this tab.</p>
              </div>
            ) : (
              jobsList.map((job) => {
                const isSaved = savedJobs.some(j => j.id === job.id);
                return (
                  <div key={job.id} className={`flex flex-col md:flex-row justify-between items-start md:items-center p-6 border-[4px] transition-transform hover:scale-[1.01] ${theme === 'dark' ? 'border-[#B3EFB2] bg-[#001A23] shadow-[4px_4px_0px_0px_rgba(179,239,178,1)]' : 'border-[#001A23] bg-[#E8F1F2] shadow-[4px_4px_0px_0px_rgba(0,26,35,1)]'}`}>
                    <div className="space-y-2 mb-4 md:mb-0">
                      <h3 className={`text-3xl font-bold tracking-wider ${theme === 'dark' ? 'text-[#E8F1F2]' : 'text-[#001A23]'}`}>{job.title}</h3>
                      <p className={`text-xl font-bold ${theme === 'dark' ? 'text-[#B3EFB2]' : 'text-[#001A23]'}`}>{job.company} <span className={`opacity-60 ml-2 ${theme === 'dark' ? 'text-[#E8F1F2]' : 'text-[#001A23]'}`}>// {job.location}</span></p>
                    </div>
                    
                    <div className="flex items-center gap-4 w-full md:w-auto">
                      <div className={`px-4 py-2 border-2 font-bold text-xl ${job.match > 80 ? (theme === 'dark' ? 'bg-[#B3EFB2] text-[#001A23] border-[#B3EFB2]' : 'bg-[#001A23] text-[#E8F1F2] border-[#001A23]') : (theme === 'dark' ? 'bg-transparent text-[#E8F1F2] border-[#E8F1F2]' : 'bg-transparent text-[#001A23] border-[#001A23]')}`}>
                        {job.match}% MATCH
                      </div>
                      
                      <button 
                        onClick={() => toggleSaveJob(job)}
                        className={`p-2 border-[4px] transition-colors ${isSaved ? (theme === 'dark' ? 'bg-[#B3EFB2] border-[#B3EFB2] text-[#001A23]' : 'bg-[#001A23] border-[#001A23] text-[#E8F1F2]') : (theme === 'dark' ? 'bg-transparent border-[#E8F1F2] text-[#E8F1F2] hover:border-[#B3EFB2] hover:text-[#B3EFB2]' : 'bg-transparent border-[#001A23] text-[#001A23] hover:bg-[#B3EFB2]')}`}
                      >
                        <svg className="w-8 h-8" fill={isSaved ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                      </button>
                      
                      <a 
                        href={job.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`px-6 py-2 border-[4px] font-bold text-2xl uppercase tracking-widest text-center transition-transform hover:-translate-y-1 ${theme === 'dark' ? 'bg-[#E8F1F2] text-[#001A23] border-[#E8F1F2]' : 'bg-[#001A23] text-[#E8F1F2] border-[#001A23]'}`}
                      >
                        Apply
                      </a>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=VT323&display=swap');
          .font-pixel { 
            font-family: 'VT323', monospace; 
            letter-spacing: 0.05em; 
          }
          
          /* GLOBAL SCROLLBAR STYLES - WEBKIT */
          .dark ::-webkit-scrollbar { width: 16px; }
          .dark ::-webkit-scrollbar-track { background: #001A23; border-left: 3px solid #B3EFB2; }
          .dark ::-webkit-scrollbar-thumb { background: #B3EFB2; border: 3px solid #001A23; }
          .dark ::-webkit-scrollbar-thumb:hover { background: #E8F1F2; }

          .light ::-webkit-scrollbar { width: 16px; }
          .light ::-webkit-scrollbar-track { background: #E8F1F2; border-left: 3px solid #001A23; }
          .light ::-webkit-scrollbar-thumb { background: #001A23; border: 3px solid #E8F1F2; }
          .light ::-webkit-scrollbar-thumb:hover { background: #B3EFB2; }
          
          /* GLOBAL SCROLLBAR STYLES - FIREFOX */
          .dark * { scrollbar-width: thin; scrollbar-color: #B3EFB2 #001A23; }
          .light * { scrollbar-width: thin; scrollbar-color: #001A23 #E8F1F2; }
        `}
      </style>

      {/* Main Wrapper */}
      <div className={`min-h-screen font-pixel flex flex-col transition-colors duration-500 relative ${theme} ${theme === 'dark' ? 'bg-[#001A23] text-[#E8F1F2]' : 'bg-[#E8F1F2] text-[#001A23]'}`}>
        
        <div className="fixed inset-0 z-0 pointer-events-auto">
          <HalftoneReveal
            src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop" 
            inkColor={theme === 'dark' ? "#B3EFB2" : "#001A23"}
            paperColor={theme === 'dark' ? "#001A23" : "#E8F1F2"}
            mode="mono"
            dotDensity={100}
            revealRadius={0.4} 
            borderRadius="0px"
          />
        </div>
        
        <header className="w-full p-6 flex justify-between items-center relative z-20">
          <div className={`font-bold text-3xl tracking-widest uppercase border-b-4 pb-1 transition-colors duration-300 px-4 pt-2 backdrop-blur-sm shadow-sm flex items-center gap-6 ${theme === 'dark' ? 'border-[#B3EFB2] bg-[#001A23]/50' : 'border-[#001A23] bg-[#E8F1F2]/50'}`}>
            <span>NC // 01</span>
            {currentUser && (
              <span className={`text-xl opacity-80 uppercase tracking-widest ${theme === 'dark' ? 'text-[#B3EFB2]' : 'text-[#001A23]'}`}>
                OP: {currentUser}
              </span>
            )}
          </div>
          <div className="flex gap-4">
            {currentUser && (
              <button 
                onClick={handleLogout}
                className={`p-3 px-6 font-bold uppercase tracking-widest flex items-center justify-center border-4 transition-all duration-300 hover:translate-x-[2px] hover:translate-y-[2px] ${theme === 'dark' ? 'border-[#B3EFB2] hover:bg-[#B3EFB2] hover:text-[#001A23] bg-transparent shadow-[4px_4px_0px_0px_rgba(179,239,178,1)] hover:shadow-[2px_2px_0px_0px_rgba(179,239,178,1)] text-[#B3EFB2]' : 'border-[#001A23] hover:bg-[#001A23] hover:text-[#E8F1F2] bg-transparent shadow-[4px_4px_0px_0px_rgba(0,26,35,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,26,35,1)] text-[#001A23]'}`}
              >
                Logout
              </button>
            )}
            <button 
              onClick={toggleTheme}
              className={`p-3 flex items-center justify-center border-4 transition-all duration-300 hover:translate-x-[2px] hover:translate-y-[2px] ${theme === 'dark' ? 'border-[#B3EFB2] hover:bg-[#B3EFB2] hover:text-[#001A23] bg-[#001A23] shadow-[4px_4px_0px_0px_rgba(179,239,178,1)] hover:shadow-[2px_2px_0px_0px_rgba(179,239,178,1)] text-[#B3EFB2]' : 'border-[#001A23] hover:bg-[#001A23] hover:text-[#E8F1F2] bg-[#B3EFB2] shadow-[4px_4px_0px_0px_rgba(0,26,35,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,26,35,1)] text-[#001A23]'}`}
              aria-label="Toggle Theme"
            >
              {theme === 'dark' ? (
                 <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
              )}
            </button>
          </div>
        </header>

        {currentView === 'login' && renderLoginPage()}
        {currentView === 'home' && renderHomePage()}
        {currentView === 'analyzer' && renderAnalyzerPage()}
        {currentView === 'fixit' && renderFixItPage()}
        {currentView === 'livelogic' && renderLiveLogicPage()}
        {currentView === 'jobs' && renderJobHubPage()}
        
      </div>
    </>
  );
}