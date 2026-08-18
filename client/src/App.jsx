import ScrollExpand from './ScrollExpand';
import PixelBlast from './PixelBlast';
import Shuffle from './Shuffle';

export default function App() {
  return (
    <div className="bg-neutral-950 text-white min-h-screen font-sans selection:bg-blue-500/30">
      
      {/* Hero Section */}
      <ScrollExpand
        customMedia={
          <PixelBlast
            variant="circle"
            pixelSize={6}
            color="#3b82f6" // Changed to match your blue UI theme
            patternScale={3}
            patternDensity={1.2}
            pixelSizeJitter={0.5}
            enableRipples={true}
            rippleSpeed={0.4}
            rippleThickness={0.12}
            rippleIntensityScale={1.5}
            liquid={true}
            liquidStrength={0.12}
            liquidRadius={1.2}
            liquidWobbleSpeed={5}
            speed={0.6}
            edgeFade={0.25}
            transparent={true}
          />
        }
        title={
          <Shuffle
            text="NEXUS CORE"
            shuffleDirection="right"
            duration={0.35}
            animationMode="evenodd"
            shuffleTimes={1}
            ease="power3.out"
            stagger={0.03}
            threshold={0.1}
            triggerOnce={true}
            triggerOnHover={true}
            respectReducedMotion={true}
          />
        }
        scrollHint="Scroll to Initiate"
        useWindowScroll={true}
      >
        {/* Overlay Content */}
        <div className="flex flex-col items-center justify-center space-y-6">
          <h2 className="text-4xl md:text-6xl font-bold text-blue-400 drop-shadow-lg text-center">
            Syllabus Intelligence
          </h2>
          <p className="text-lg md:text-xl text-gray-300 max-w-2xl text-center">
            Upload your university syllabus. Our AI engine instantly compares your curriculum against real-world industry demands, highlighting exactly what you need to learn to get hired.
          </p>
          <button className="px-8 py-4 mt-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-full transition-all shadow-[0_0_20px_rgba(37,99,235,0.5)]">
            Launch Analyzer
          </button>
        </div>
      </ScrollExpand>

      {/* The rest of the page (Dashboard Placeholder) */}
      <div className="h-screen flex items-center justify-center bg-neutral-950 relative z-10 border-t border-blue-900/30">
        <p className="text-blue-500/50 text-xl font-bold tracking-widest uppercase">
          Upload Interface Goes Here...
        </p>
      </div>

    </div>
  );
}