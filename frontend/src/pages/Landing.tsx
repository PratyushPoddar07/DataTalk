import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Bot, Sparkles, ChevronRight, Zap, Shield, Database } from 'lucide-react';
import Background3D from '@/components/Background3D';

export default function Landing() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen relative overflow-hidden bg-[#0a0a0f] text-white">
            <Background3D />

            {/* Navbar */}
            <nav className="relative z-20 flex items-center justify-between px-8 py-6 max-w-7xl mx-auto">
                <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary-600/20">
                        <Bot className="w-6 h-6" />
                    </div>
                    <span className="text-xl font-bold tracking-tight">QueryMind AI</span>
                </div>
                <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-400">
                    <a href="#features" className="hover:text-white transition-colors">Features</a>
                    <a href="#solutions" className="hover:text-white transition-colors">Solutions</a>
                    <a href="#security" className="hover:text-white transition-colors">Security</a>
                </div>
                <button
                    onClick={() => navigate('/dashboard')}
                    className="px-6 py-2.5 glass-effect rounded-full text-sm font-bold hover:bg-white/10 dark:hover:bg-white/15 transition-all border border-white/10 hover:border-white/20 active:scale-95"
                >
                    Sign In
                </button>
            </nav>

            {/* Hero Section */}
            <main className="relative z-10 flex flex-col items-center justify-center px-4 pt-20 pb-32 text-center max-w-5xl mx-auto">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-400 text-xs font-bold uppercase tracking-widest mb-8"
                >
                    <Sparkles className="w-4 h-4" />
                    Next Generation Data Intelligence
                </motion.div>

                <motion.h1
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    className="text-6xl md:text-8xl font-black mb-8 leading-[1.1] tracking-tight"
                >
                    Talk to Your <br />
                    <span className="gradient-text">Data in Seconds.</span>
                </motion.h1>

                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.8, delay: 0.4 }}
                    className="text-gray-400 text-xl md:text-2xl max-w-2xl mb-12 leading-relaxed"
                >
                    Transform natural language into powerful SQL queries instantly.
                    Bridge the gap between raw data and actionable insights with
                    AI-driven intelligence.
                </motion.p>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.6 }}
                    className="flex flex-col sm:flex-row gap-4"
                >
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="btn-premium group"
                    >
                        Get Started Free
                        <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>

                    <button className="btn-glass">
                        Watch Demo
                    </button>
                </motion.div>

                {/* Feature Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-32 w-full">
                    {[
                        {
                            icon: <Zap className="w-6 h-6" />,
                            title: "Instant SQL",
                            desc: "From complex joins to window functions, get precise queries in heartbeat."
                        },
                        {
                            icon: <Shield className="w-6 h-6" />,
                            title: "Enterprise Grade",
                            desc: "Secure, encrypted connections to your PostgreSQL, MongoDB, and more."
                        },
                        {
                            icon: <Database className="w-6 h-6" />,
                            title: "Universal Sync",
                            desc: "Automatically discover schemas and relationships across all your data sources."
                        }
                    ].map((item, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.8 + (i * 0.1) }}
                            className="card text-left group hover:border-primary-500/50 transition-all border border-white/5"
                        >
                            <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center mb-6 group-hover:bg-primary-500/10 group-hover:text-primary-400 transition-all">
                                {item.icon}
                            </div>
                            <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                            <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
                        </motion.div>
                    ))}
                </div>
            </main>

            {/* Decorative Elements */}
            <div className="absolute top-1/4 -left-64 w-[500px] h-[500px] bg-primary-600/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-1/4 -right-64 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />
        </div>
    );
}
