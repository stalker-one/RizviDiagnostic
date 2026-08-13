import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext.jsx';
import Lightbox from '../components/Lightbox.jsx';
import useCountUp from '../hooks/useCountUp.js';
import {
  Bone, Waves, Activity, CircleDot, Stethoscope, ClipboardList,
  Phone, MapPin, Clock, Star, Menu, X, ArrowRight, ShieldCheck,
  BadgeCheck, Quote, PhoneCall, ChevronDown, HeartPulse,
  CalendarCheck, Users, Building2, Award, Sparkles,
  ChevronRight, CheckCircle2, Cpu, Microscope,
  Zap, Gem, Layers, Orbit, Infinity, Target,
  Briefcase, GraduationCap, Globe, MessageCircle,
} from 'lucide-react';

const YEAR = new Date().getFullYear();
const YEARS_ACTIVE = YEAR - 1954;

const SERVICES = [
  {
    Icon: Bone,
    name: 'Digital X-Ray',
    dept: 'X-Ray',
    blurb: 'High-resolution digital radiography with instant, computer-enhanced images — lower wait times and clearer results than traditional film.',
    gradient: 'from-blue-600 to-indigo-600',
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    tag: 'Most Popular',
  },
  {
    Icon: Waves,
    name: 'Ultrasound',
    dept: 'Ultrasound',
    blurb: 'General, abdominal, obstetric and small-parts ultrasound, read directly by our radiologists on the same visit.',
    gradient: 'from-purple-600 to-pink-600',
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-600',
    tag: 'Same-Day Report',
  },
  {
    Icon: Activity,
    name: 'Colour Doppler',
    dept: 'Ultrasound',
    blurb: 'Vascular and cardiac flow studies to assess circulation, ideal for follow-up on blood flow and vessel health.',
    gradient: 'from-cyan-600 to-blue-600',
    iconBg: 'bg-cyan-50',
    iconColor: 'text-cyan-600',
    tag: 'Advanced',
  },
  {
    Icon: CircleDot,
    name: 'CT Scan',
    dept: 'CT Scan',
    blurb: 'Cross-sectional imaging for a detailed look at bones, organs, and soft tissue when an X-ray or ultrasound isn\'t enough.',
    gradient: 'from-orange-600 to-red-600',
    iconBg: 'bg-orange-50',
    iconColor: 'text-orange-600',
    tag: 'High Precision',
  },
  {
    Icon: CircleDot,
    name: 'MRI',
    dept: 'MRI',
    blurb: 'Magnetic resonance imaging for detailed soft-tissue, joint, and neurological studies without radiation exposure.',
    gradient: 'from-indigo-600 to-purple-600',
    iconBg: 'bg-indigo-50',
    iconColor: 'text-indigo-600',
    tag: 'No Radiation',
  },
  {
    Icon: ClipboardList,
    name: 'Radiological Procedures',
    dept: 'Procedure',
    blurb: 'IVP, HSG, and barium studies carried out by our lady doctor, with privacy and comfort kept front of mind.',
    gradient: 'from-amber-600 to-yellow-600',
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    tag: 'Women-Friendly',
  },
];

const DOCTORS = [
  { 
    name: 'Dr. Mohd Ahmed', 
    title: 'Radiologist, FCPS', 
    specialty: 'Advanced Imaging',
    experience: '15+ years',
    icon: '👨‍⚕️',
    gradient: 'from-blue-600 to-indigo-600',
    patients: '5000+',
  },
  { 
    name: 'Dr. Moosa Hassan', 
    title: 'Consultant Radiologist, MBBS', 
    specialty: 'Diagnostic Radiology',
    experience: '12+ years',
    icon: '👨‍⚕️',
    gradient: 'from-purple-600 to-pink-600',
    patients: '4200+',
  },
  { 
    name: 'Dr. Ishmal Zahra', 
    title: 'Radiology Resident, MBBS', 
    specialty: 'Women\'s Imaging',
    experience: '8+ years',
    icon: '👩‍⚕️',
    gradient: 'from-cyan-600 to-blue-600',
    patients: '3800+',
  },
];

const REVIEWS = [
  {
    name: 'Waqas G.',
    stars: 5,
    text: 'One of the best X-ray and ultrasound centres in the area — modern equipment and clear, colour-printed reports.',
    date: '2 weeks ago',
    location: 'Faisalabad',
    verified: true,
  },
  {
    name: 'Syed Maisam R.',
    stars: 5,
    text: 'Consistently good results across X-rays, ultrasounds, and Doppler studies.',
    date: '1 month ago',
    location: 'Faisalabad',
    verified: true,
  },
  {
    name: 'Shahzaib A.',
    stars: 5,
    text: 'Highly recommend their ultrasound service — professional and efficient.',
    date: '2 months ago',
    location: 'Faisalabad',
    verified: true,
  },
  {
    name: 'Hammad N.',
    stars: 5,
    text: 'A trusted choice for female patients in particular — the staff are careful about privacy and comfort.',
    date: '3 months ago',
    location: 'Faisalabad',
    verified: true,
  },
];

const STATS = [
  { value: `${YEARS_ACTIVE}+`, label: 'Years of Excellence', Icon: Award, gradient: 'from-blue-600 to-indigo-600' },
  { value: DOCTORS.length, label: 'Expert Doctors', Icon: Users, gradient: 'from-purple-600 to-pink-600' },
  { value: SERVICES.length, label: 'Services', Icon: Building2, gradient: 'from-cyan-600 to-blue-600' },
  { value: '6', label: 'Days Open', Icon: CalendarCheck, gradient: 'from-orange-600 to-red-600' },
];

const NAV_LINKS = [
  { href: '#about', label: 'About' },
  { href: '#services', label: 'Services' },
  { href: '#doctors', label: 'Doctors' },
  { href: '#reviews', label: 'Reviews' },
  { href: '#contact', label: 'Contact' },
];

// Animates the numeric portion of a stat value (e.g. "72+" -> counts 0..72
// then keeps the "+"), so every figure in the Stats Strip counts up into
// view instead of just appearing.
function AnimatedStatValue({ value, duration = 1400 }) {
  const str = String(value);
  const match = str.match(/^(\d+)(.*)$/);
  const numeric = match ? Number(match[1]) : 0;
  const suffix = match ? match[2] : '';
  const animated = useCountUp(numeric, duration);
  if (!match) return <>{str}</>;
  return <>{Math.round(animated)}{suffix}</>;
}

function Stars({ count }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={14} fill={i < count ? '#F59E0B' : 'none'} className={i < count ? 'text-amber-400' : 'text-gray-300'} strokeWidth={1.5} />
      ))}
    </div>
  );
}

function ServiceCard({ Icon, name, blurb, gradient, iconBg, iconColor, tag, index }) {
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <div 
      className="group relative bg-white rounded-2xl overflow-hidden transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 reveal-item reveal-up"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ '--reveal-delay': `${index * 0.1}s` }}
    >
      {/* Gradient Top Border */}
      <div className={`h-1 bg-gradient-to-r ${gradient} transform origin-left transition-transform duration-500 ${isHovered ? 'scale-x-100' : 'scale-x-0'}`} />
      
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className={`w-14 h-14 rounded-2xl ${iconBg} flex items-center justify-center group-hover:scale-110 transition-all duration-300`}>
            <Icon size={24} className={iconColor} strokeWidth={1.5} />
          </div>
          <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full bg-gradient-to-r ${gradient} text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300`}>
            {tag}
          </span>
        </div>
        
        <h3 className="font-bold text-lg text-gray-900 mb-2">{name}</h3>
        <p className="text-sm text-gray-600 leading-relaxed">{blurb}</p>
        
        <div className="mt-4 flex items-center gap-2">
          <span className={`text-sm font-medium text-transparent bg-gradient-to-r ${gradient} bg-clip-text transition-all duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
            Learn More
          </span>
          <ChevronRight size={16} className={`text-gray-400 transition-all duration-300 ${isHovered ? 'translate-x-1 opacity-100' : 'opacity-0'}`} />
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const { settings } = useSettings();
  const [navOpen, setNavOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState('top');
  const [isVisible, setIsVisible] = useState({});
  const sectionRefs = {};

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
      
      const sections = NAV_LINKS.map(l => l.href.substring(1));
      const current = sections.find(id => {
        const el = document.getElementById(id);
        if (el) {
          const rect = el.getBoundingClientRect();
          return rect.top <= 150 && rect.bottom >= 150;
        }
        return false;
      });
      if (current) setActiveSection(current);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setIsVisible(prev => ({ ...prev, [entry.target.id]: true }));
          }
        });
      },
      { threshold: 0.1 }
    );

    document.querySelectorAll('.section-animate').forEach(el => {
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const clinicName = settings?.clinicName || 'Rizvi Diagnostic Center';
  const address = settings?.address || '547-A Jinnah Colony, Near Chathri Wala Ground, Faisalabad';
  const phone1 = settings?.phone1 || '0320-2616216';
  const phone2 = settings?.phone2 || '041-2616216';
  const mapQuery = encodeURIComponent(`${clinicName}, ${address}, Faisalabad, Pakistan`);

  return (
    <div className="font-sans text-gray-900 bg-white overflow-x-hidden">
      {/* ---------------- Nav ---------------- */}
      <header className={`fixed top-0 w-full z-50 transition-all duration-500 ${
        scrolled 
          ? 'bg-white shadow-lg border-b border-gray-100' 
          : 'bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 md:h-20 flex items-center justify-between">
          <a href="#top" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-600/30">
              <HeartPulse size={18} className="text-white" />
            </div>
            <span className={`font-bold text-lg sm:text-xl transition-all duration-300 ${
              scrolled ? 'text-gray-900' : 'text-white'
            }`}>
              {clinicName}
            </span>
            <span className={`hidden sm:inline text-[10px] font-medium tracking-widest border rounded-full px-2.5 py-0.5 transition-all duration-300 ${
              scrolled 
                ? 'text-blue-600 border-blue-600/30 bg-blue-50' 
                : 'text-amber-400 border-amber-400/40'
            }`}>
              EST. 1954
            </span>
          </a>

          <nav className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((l) => (
              <a 
                key={l.href} 
                href={l.href} 
                className={`text-sm font-medium transition-all duration-300 relative ${
                  scrolled ? 'text-gray-600 hover:text-gray-900' : 'text-white/80 hover:text-white'
                } ${activeSection === l.href.substring(1) ? 'text-blue-600' : ''}`}
              >
                {l.label}
                {activeSection === l.href.substring(1) && (
                  <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full" />
                )}
              </a>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-4">
            <a 
              href={`tel:${phone1.replace(/[^0-9+]/g, '')}`} 
              className={`flex items-center gap-1.5 text-sm font-medium transition-all duration-300 ${
                scrolled ? 'text-blue-600 hover:text-indigo-600' : 'text-amber-300 hover:text-amber-200'
              }`}
            >
              <PhoneCall size={15} /> {phone1}
            </a>
            <Link
              to="/login"
              className={`text-sm font-medium rounded-full px-5 py-2 transition-all duration-300 ${
                scrolled 
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/30 hover:shadow-xl hover:-translate-y-0.5' 
                  : 'bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white border border-white/10'
              }`}
            >
              Staff Login
            </Link>
          </div>

          <button 
            className={`md:hidden p-2 rounded-lg transition-all duration-300 ${
              scrolled ? 'text-gray-900 hover:bg-gray-100' : 'text-white hover:bg-white/10'
            }`} 
            onClick={() => setNavOpen((v) => !v)} 
            aria-label="Toggle menu"
          >
            {navOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* Mobile Menu */}
        <div className={`md:hidden transition-all duration-500 overflow-hidden ${
          navOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
        }`}>
          <div className={`px-4 py-4 space-y-3 ${
            scrolled ? 'bg-white border-b border-gray-100' : 'bg-gray-900/95 backdrop-blur-md'
          }`}>
            {NAV_LINKS.map((l) => (
              <a 
                key={l.href} 
                href={l.href} 
                onClick={() => setNavOpen(false)} 
                className={`block text-sm font-medium transition-colors ${
                  scrolled ? 'text-gray-700 hover:text-gray-900' : 'text-white/80 hover:text-white'
                }`}
              >
                {l.label}
              </a>
            ))}
            <a 
              href={`tel:${phone1.replace(/[^0-9+]/g, '')}`} 
              className={`block text-sm font-medium ${scrolled ? 'text-blue-600' : 'text-amber-300'}`}
            >
              Call {phone1}
            </a>
            <Link 
              to="/login" 
              className={`block rounded-full px-4 py-2 text-sm font-medium w-fit ${
                scrolled 
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white' 
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              Staff Login
            </Link>
          </div>
        </div>
      </header>

      {/* ---------------- Hero ---------------- */}
      <section id="top" className="relative min-h-screen flex items-center overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        {/* Background Pattern */}
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-gradient-to-bl from-blue-600/10 to-transparent" />
          <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-gradient-to-tr from-indigo-600/10 to-transparent" />
          
          {/* Grid */}
          <div className="absolute inset-0 opacity-5" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            backgroundSize: '60px 60px',
          }} />
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28 grid lg:grid-cols-2 gap-16 items-center w-full">
          <div className="text-center lg:text-left">
            <div className="hero-fade-in inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 mb-6 border border-white/10" style={{ '--reveal-delay': '0s' }}>
              <Zap size={14} className="text-amber-400" />
              <span className="font-mono text-[10px] tracking-widest text-amber-400 uppercase">
                Faisalabad's Trusted Imaging Centre
              </span>
            </div>
            
            <h1 className="hero-fade-in font-bold text-4xl sm:text-5xl lg:text-6xl xl:text-7xl leading-tight text-white mb-6" style={{ '--reveal-delay': '0.12s' }}>
              {YEARS_ACTIVE} Years of<br />
              <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent shimmer-text">
                Diagnostic Excellence
              </span>
            </h1>
            
            <p className="hero-fade-in text-white/60 text-base sm:text-lg leading-relaxed mb-8 max-w-lg mx-auto lg:mx-0" style={{ '--reveal-delay': '0.24s' }}>
              {clinicName} brings digital X-ray, ultrasound, colour Doppler, CT and MRI imaging
              together under one roof in the heart of Faisalabad — read by experienced
              radiologists, reported the same day.
            </p>
            
            <div className="hero-fade-in flex flex-wrap gap-4 justify-center lg:justify-start" style={{ '--reveal-delay': '0.36s' }}>
              <a
                href={`tel:${phone1.replace(/[^0-9+]/g, '')}`}
                className="group inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-full px-8 py-4 text-sm transition-all duration-300 shadow-xl shadow-blue-600/30 hover:shadow-2xl hover:-translate-y-1"
              >
                <Phone size={16} className="group-hover:rotate-12 transition-transform" /> 
                Book Now: {phone1}
              </a>
              <a
                href="#services"
                className="group inline-flex items-center gap-2 border border-white/20 hover:border-white/40 text-white rounded-full px-8 py-4 text-sm transition-all duration-300 hover:bg-white/5 hover:-translate-y-1"
              >
                Explore Services
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </a>
            </div>

            {/* Trust Indicators */}
            <div className="hero-fade-in flex flex-wrap gap-8 justify-center lg:justify-start mt-8 pt-6 border-t border-white/10" style={{ '--reveal-delay': '0.48s' }}>
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-emerald-400" />
                <span className="text-xs text-white/40">Trusted Since 1954</span>
              </div>
              <div className="flex items-center gap-2">
                <BadgeCheck size={16} className="text-blue-400" />
                <span className="text-xs text-white/40">Board Certified</span>
              </div>
              <div className="flex items-center gap-2">
                <Users size={16} className="text-purple-400" />
                <span className="text-xs text-white/40">500+ Patients/Month</span>
              </div>
            </div>
          </div>

          <div className="hero-fade-in flex justify-center lg:justify-end" style={{ '--reveal-delay': '0.2s' }}>
            <div className="w-full max-w-md float-slow">
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-r from-blue-600/20 to-indigo-600/20 rounded-3xl blur-2xl" />
                <div className="relative bg-white/5 backdrop-blur-sm rounded-3xl p-2 border border-white/10 shadow-2xl">
                  <Lightbox />
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/20">
          <span className="text-[10px] tracking-widest uppercase">Scroll</span>
          <ChevronDown size={20} className="animate-bounce" />
        </div>
      </section>

      {/* ---------------- Stats Strip ---------------- */}
      <section id="stats" className={`relative -mt-8 section-animate ${isVisible.stats ? 'is-visible' : ''}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-3xl shadow-2xl shadow-black/5 border border-gray-100 p-6 md:p-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {STATS.map((s, index) => (
                <div
                  key={s.label}
                  className="group flex flex-col items-center text-center reveal-item reveal-scale"
                  style={{ '--reveal-delay': `${index * 0.1}s` }}
                >
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${s.gradient} flex items-center justify-center mb-3 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 shadow-lg`}>
                    <s.Icon size={22} className="text-white" />
                  </div>
                  <div className="font-bold text-3xl text-gray-900 tabular-nums">
                    <AnimatedStatValue value={s.value} duration={1200 + index * 150} />
                  </div>
                  <div className="text-xs font-medium text-gray-500 mt-1 uppercase tracking-wide">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- About ---------------- */}
      <section id="about" className={`py-24 section-animate ${isVisible.about ? 'is-visible' : ''}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="reveal-item reveal-left">
              <div className="inline-flex items-center gap-2 bg-blue-50 rounded-full px-4 py-2 mb-4 border border-blue-100">
                <Award size={14} className="text-blue-600" />
                <span className="font-mono text-[10px] tracking-widest text-blue-600 uppercase">About Us</span>
              </div>
              <h2 className="font-bold text-3xl sm:text-4xl lg:text-5xl text-gray-900 mb-6 leading-tight">
                Faisalabad's Most<br />
                <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Trusted Radiology</span> Centre
              </h2>
              <p className="text-gray-600 leading-relaxed mb-4">
                Opened in 1954 as one of the first radiology practices in the city, {clinicName} has
                grown from a single X-ray room into a full diagnostic imaging centre — without losing
                the personal attention that made it a trusted name for three generations of local
                families.
              </p>
              <p className="text-gray-600 leading-relaxed mb-6">
                Every study is reviewed by a qualified radiologist before it reaches you or your
                referring doctor, and our reception team is trained to keep waiting times, privacy,
                and comfort front of mind — especially for elderly patients and women.
              </p>
              <ul className="space-y-3">
                {[
                  'Same-day reporting on all studies',
                  'Dedicated privacy for female patients',
                  'AI-assisted diagnostic accuracy',
                  'Digital records available instantly',
                ].map((item, index) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-gray-700">
                    <CheckCircle2 size={18} className="text-blue-600 shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex justify-center reveal-item reveal-right" style={{ '--reveal-delay': '0.15s' }}>
              <div className="relative w-full max-w-sm float-slow">
                <div className="relative bg-gradient-to-br from-blue-600/10 to-indigo-600/10 rounded-3xl p-8 border border-gray-100 shadow-2xl">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white rounded-2xl p-4 shadow-lg">
                      <Microscope size={24} className="text-blue-600 mb-2" />
                      <p className="text-xs font-medium text-gray-900">Modern Equipment</p>
                    </div>
                    <div className="bg-white rounded-2xl p-4 shadow-lg">
                      <ShieldCheck size={24} className="text-emerald-600 mb-2" />
                      <p className="text-xs font-medium text-gray-900">Accurate Reports</p>
                    </div>
                    <div className="bg-white rounded-2xl p-4 shadow-lg">
                      <Users size={24} className="text-purple-600 mb-2" />
                      <p className="text-xs font-medium text-gray-900">Expert Team</p>
                    </div>
                    <div className="bg-white rounded-2xl p-4 shadow-lg">
                      <Clock size={24} className="text-amber-600 mb-2" />
                      <p className="text-xs font-medium text-gray-900">Quick Results</p>
                    </div>
                  </div>
                  <div className="mt-6 text-center">
                    <div className="inline-flex items-center gap-2 bg-blue-600 text-white rounded-full px-4 py-2 text-xs font-medium">
                      <Target size={14} /> 100% Patient Satisfaction
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- Services ---------------- */}
      <section id="services" className={`py-24 bg-gray-50 section-animate ${isVisible.services ? 'is-visible' : ''}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 reveal-item reveal-up">
            <div className="inline-flex items-center gap-2 bg-blue-50 rounded-full px-4 py-2 mb-4 border border-blue-100">
              <Cpu size={14} className="text-blue-600" />
              <span className="font-mono text-[10px] tracking-widest text-blue-600 uppercase">Our Services</span>
            </div>
            <h2 className="font-bold text-3xl sm:text-4xl lg:text-5xl text-gray-900 mb-4">
              Comprehensive Diagnostic<br />
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Imaging Services</span>
            </h2>
            <p className="text-gray-500 text-lg">State-of-the-art equipment and expert radiologists for accurate diagnoses.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {SERVICES.map((service, index) => (
              <ServiceCard key={service.name} {...service} index={index} />
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Doctors ---------------- */}
      <section id="doctors" className={`py-24 bg-white section-animate ${isVisible.doctors ? 'is-visible' : ''}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 reveal-item reveal-up">
            <div className="inline-flex items-center gap-2 bg-blue-50 rounded-full px-4 py-2 mb-4 border border-blue-100">
              <Stethoscope size={14} className="text-blue-600" />
              <span className="font-mono text-[10px] tracking-widest text-blue-600 uppercase">Our Team</span>
            </div>
            <h2 className="font-bold text-3xl sm:text-4xl lg:text-5xl text-gray-900 mb-4">
              Expert Radiologists<br />
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">You Can Trust</span>
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {DOCTORS.map((d, index) => (
              <div
                key={d.name}
                className="group bg-white rounded-3xl p-8 border border-gray-100 shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 text-center reveal-item reveal-scale"
                style={{ '--reveal-delay': `${index * 0.12}s` }}
              >
                <div className={`w-28 h-28 rounded-full bg-gradient-to-br ${d.gradient} flex items-center justify-center mx-auto mb-4 shadow-xl group-hover:scale-110 transition-transform duration-500 text-5xl`}>
                  {d.icon}
                </div>
                <h3 className="font-bold text-xl text-gray-900">{d.name}</h3>
                <p className="text-sm text-gray-500 flex items-center justify-center gap-1.5 mt-1">
                  <Stethoscope size={14} /> {d.title}
                </p>
                <p className={`text-sm font-medium mt-2 bg-gradient-to-r ${d.gradient} bg-clip-text text-transparent`}>
                  {d.specialty}
                </p>
                <div className="mt-4 pt-4 border-t border-gray-100 flex justify-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Briefcase size={12} className="text-blue-600" />
                    {d.experience}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users size={12} className="text-blue-600" />
                    {d.patients}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Reviews ---------------- */}
      <section id="reviews" className={`py-24 bg-gray-50 section-animate ${isVisible.reviews ? 'is-visible' : ''}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 reveal-item reveal-up">
            <div className="inline-flex items-center gap-2 bg-blue-50 rounded-full px-4 py-2 mb-4 border border-blue-100">
              <MessageCircle size={14} className="text-blue-600" />
              <span className="font-mono text-[10px] tracking-widest text-blue-600 uppercase">Patient Stories</span>
            </div>
            <h2 className="font-bold text-3xl sm:text-4xl lg:text-5xl text-gray-900 mb-4">
              What Our Patients<br />
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Say About Us</span>
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            {REVIEWS.map((r, index) => (
              <div
                key={r.name}
                className="bg-white rounded-3xl p-6 border border-gray-100 shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-1 reveal-item reveal-up"
                style={{ '--reveal-delay': `${index * 0.1}s` }}
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                    {r.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-gray-900">{r.name}</span>
                        <span className="text-[10px] text-gray-400 ml-2">{r.location}</span>
                      </div>
                      <Stars count={r.stars} />
                    </div>
                    <p className="text-sm text-gray-600 mt-2 leading-relaxed">"{r.text}"</p>
                    <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                      <span>{r.date}</span>
                      {r.verified && (
                        <span className="flex items-center gap-1 text-emerald-600">
                          <BadgeCheck size={12} /> Verified
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Contact ---------------- */}
      <section id="contact" className={`py-24 bg-white section-animate ${isVisible.contact ? 'is-visible' : ''}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16">
            <div className="reveal-item reveal-left">
              <div className="inline-flex items-center gap-2 bg-blue-50 rounded-full px-4 py-2 mb-4 border border-blue-100">
                <PhoneCall size={14} className="text-blue-600" />
                <span className="font-mono text-[10px] tracking-widest text-blue-600 uppercase">Contact Us</span>
              </div>
              <h2 className="font-bold text-3xl sm:text-4xl lg:text-5xl text-gray-900 mb-4">
                Get in Touch<br />
                <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">With Our Team</span>
              </h2>
              <p className="text-gray-500 text-lg mb-8">We're here to help. Reach out for appointments or inquiries.</p>

              <div className="space-y-6">
                <div className="flex items-start gap-4 group">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors">
                    <MapPin size={20} className="text-blue-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">Visit Us</div>
                    <div className="text-sm text-gray-600">{address}</div>
                  </div>
                </div>
                <div className="flex items-start gap-4 group">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors">
                    <Phone size={20} className="text-blue-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">Call Us</div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <a href={`tel:${phone1.replace(/[^0-9+]/g, '')}`} className="block hover:text-blue-600 transition-colors">
                        {phone1}
                      </a>
                      {phone2 && (
                        <a href={`tel:${phone2.replace(/[^0-9+]/g, '')}`} className="block hover:text-blue-600 transition-colors">
                          {phone2}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-4 group">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors">
                    <Clock size={20} className="text-blue-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">Opening Hours</div>
                    <div className="text-sm text-gray-600">Monday – Saturday: 9:30 AM – 8:30 PM</div>
                    <div className="text-sm text-gray-600">Sunday: Closed</div>
                  </div>
                </div>
              </div>

              <a
                href={`tel:${phone1.replace(/[^0-9+]/g, '')}`}
                className="inline-flex items-center gap-2 mt-8 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-full px-8 py-4 text-sm font-medium transition-all duration-300 shadow-xl shadow-blue-600/30 hover:shadow-2xl hover:-translate-y-1"
              >
                <PhoneCall size={16} /> Call Now
              </a>
            </div>

            <div className="rounded-3xl overflow-hidden border border-gray-200 min-h-[400px] shadow-2xl shadow-black/5 reveal-item reveal-right" style={{ '--reveal-delay': '0.15s' }}>
              <iframe
                title="Clinic location map"
                src={`https://www.google.com/maps?q=${mapQuery}&output=embed`}
                width="100%"
                height="100%"
                style={{ border: 0, minHeight: 400 }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="w-full h-full"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- Footer ---------------- */}
      <footer className="bg-slate-900 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center">
                  <HeartPulse size={16} className="text-white" />
                </div>
                <div className="font-bold text-lg text-white">{clinicName}</div>
              </div>
              <p className="text-sm text-slate-400">Faisalabad's trusted diagnostic imaging centre since 1954.</p>
              <div className="flex gap-3 mt-4">
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center hover:bg-slate-700 transition-colors cursor-pointer">
                  <span className="text-xs text-slate-400">FB</span>
                </div>
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center hover:bg-slate-700 transition-colors cursor-pointer">
                  <span className="text-xs text-slate-400">IG</span>
                </div>
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center hover:bg-slate-700 transition-colors cursor-pointer">
                  <span className="text-xs text-slate-400">YT</span>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-white text-sm mb-3">Quick Links</h4>
              <ul className="space-y-2">
                {NAV_LINKS.map((l) => (
                  <li key={l.href}>
                    <a href={l.href} className="text-sm text-slate-400 hover:text-white transition-colors">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white text-sm mb-3">Services</h4>
              <ul className="space-y-2">
                {SERVICES.slice(0, 4).map((s) => (
                  <li key={s.name}>
                    <span className="text-sm text-slate-400">{s.name}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white text-sm mb-3">Contact Info</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>{phone1}</li>
                {phone2 && <li>{phone2}</li>}
                <li>{address}</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-8 flex flex-col sm:flex-row justify-between gap-4 items-center">
            <div className="text-xs text-slate-500">
              &copy; {YEAR} {clinicName}. All rights reserved.
            </div>
            <div className="flex gap-6 text-xs text-slate-500">
              <Link to="/login" className="hover:text-white transition-colors">Staff Login</Link>
              <a href="#top" className="hover:text-white transition-colors">Back to Top ↑</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}