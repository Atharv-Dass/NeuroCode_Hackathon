import { motion } from 'framer-motion';
import { ArrowRight, Brain, TrendingUp, Zap, CheckCircle2 } from 'lucide-react';
import { Page } from '../App';

interface LandingProps {
  onNavigate: (page: Page) => void;
}

const Landing = ({ onNavigate }: LandingProps) => {
  const fadeInUp = {
    initial: { opacity: 0, y: 30 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6 }
  };

  const staggerContainer = {
    animate: {
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <motion.section 
        className="relative bg-gradient-to-br from-[#004F7E] via-[#005A92] to-[#003D62] text-white py-20 px-6 overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-64 h-64 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-10 right-20 w-96 h-96 bg-white rounded-full blur-3xl"></div>
        </div>

        <div className="max-w-6xl mx-auto relative z-10">
          <motion.div 
            className="text-center"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full mb-6">
              <Brain className="w-5 h-5" />
              <span className="text-sm font-semibold">Medical Grade AI Diagnostics</span>
            </motion.div>

            <motion.h1 
              variants={fadeInUp}
              className="text-5xl md:text-7xl font-bold mb-6 leading-tight"
            >
              OBT Quantifier
              <span className="block text-3xl md:text-4xl mt-2 text-blue-200 font-light">
                Clinical Tremor Diagnostic Suite
              </span>
            </motion.h1>

            <motion.p 
              variants={fadeInUp}
              className="text-xl md:text-2xl mb-10 text-blue-100 max-w-3xl mx-auto"
            >
              Precision analysis of Parkinson's Disease resting tremor patterns
              using advanced computer vision and kinematic frequency analysis
            </motion.p>

            <motion.button
              variants={fadeInUp}
              onClick={() => onNavigate('dashboard')}
              className="group bg-white text-[#004F7E] px-8 py-4 rounded-lg text-lg font-bold inline-flex items-center gap-3 hover:shadow-2xl hover:scale-105 transition-all duration-300"
            >
              Go To Tool
              <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
            </motion.button>
          </motion.div>
        </div>
      </motion.section>

      {/* Clinical Use Section */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold text-[#004F7E] mb-4">Parkinson's Disease Analysis</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Quantitative resting tremor assessment for clinical diagnosis and monitoring
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Parkinson's Disease - Resting Tremor */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="glass-card-hover p-8"
            >
              <div className="flex items-start gap-4 mb-6">
                <div className="p-3 bg-[#004F7E] rounded-lg">
                  <Brain className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-[#004F7E] mb-2">Resting Tremor</h3>
                  <p className="text-sm text-gray-500 font-mono">Parkinson's Disease Signature</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-gray-900">Frequency Range</p>
                    <p className="text-gray-600 font-mono text-sm">4-6 Hz (Typical: 4.5-5.5 Hz)</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-gray-900">Presentation</p>
                    <p className="text-gray-600">Pill-rolling motion, present at rest</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-gray-900">Clinical Pattern</p>
                    <p className="text-gray-600">Decreases with voluntary movement</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-gray-900">Associated Features</p>
                    <p className="text-gray-600">Rigidity, bradykinesia, postural instability</p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Quantitative Benefits */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="glass-card-hover p-8"
            >
              <div className="flex items-start gap-4 mb-6">
                <div className="p-3 bg-green-600 rounded-lg">
                  <TrendingUp className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-green-700 mb-2">Quantitative Analysis</h3>
                  <p className="text-sm text-gray-500 font-mono">Objective Measurement</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-gray-900">Precision Detection</p>
                    <p className="text-gray-600">Computer vision tracks sub-millimeter movements</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-gray-900">Frequency Profiling</p>
                    <p className="text-gray-600">Real-time spectral analysis identifies PD patterns</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-gray-900">Treatment Monitoring</p>
                    <p className="text-gray-600">Track medication effectiveness over time</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-gray-900">Clinical Documentation</p>
                    <p className="text-gray-600">Objective data for medical records and research</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Case Studies Section */}
      <section className="py-20 px-6 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold text-[#004F7E] mb-4">Research Applications</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Real-world clinical scenarios where OBT Quantifier makes a difference
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Case Study 1 */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="glass-card p-8"
            >
              <div className="w-full h-48 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg mb-6 flex items-center justify-center">
                <Zap className="w-20 h-20 text-[#004F7E]" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Early-Stage Identification</h3>
              <p className="text-gray-600 mb-4">
                Detecting subtle frequency differences in early-stage patients where clinical 
                examination alone may be inconclusive. Quantitative data supports earlier intervention.
              </p>
              <div className="flex items-center gap-2 text-sm text-[#004F7E] font-semibold">
                <span className="font-mono">4.8 Hz</span>
                <span>→</span>
                <span>PD Suspected</span>
              </div>
            </motion.div>

            {/* Case Study 2 */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="glass-card p-8"
            >
              <div className="w-full h-48 bg-gradient-to-br from-purple-100 to-purple-200 rounded-lg mb-6 flex items-center justify-center">
                <TrendingUp className="w-20 h-20 text-purple-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Treatment Optimization</h3>
              <p className="text-gray-600 mb-4">
                Monitor medication effectiveness through quantitative tremor measurement. 
                Track frequency and amplitude changes to optimize dosing schedules and therapeutic interventions.
              </p>
              <div className="flex items-center gap-2 text-sm text-purple-600 font-semibold">
                <span className="font-mono">45% Reduction</span>
                <span>→</span>
                <span>Post-Treatment</span>
              </div>
            </motion.div>
          </div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-center mt-12"
          >
            <button
              onClick={() => onNavigate('dashboard')}
              className="btn-primary text-xl px-10 py-5 inline-flex items-center gap-3"
            >
              Start Diagnostic Session
              <ArrowRight className="w-6 h-6" />
            </button>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default Landing;
