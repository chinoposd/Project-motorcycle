import { ArrowRight, BatteryCharging, Bike, ChevronLeft, ChevronRight, Clock3, MapPinned, Menu, Pause, Play, ShieldCheck, UsersRound, X, Zap } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';

const features = [
  { icon: ShieldCheck, title: 'ปลอดภัยทุกการเดินทาง', body: 'ตรวจสอบความพร้อมรถและสิทธิ์ก่อนเริ่มใช้งาน' },
  { icon: BatteryCharging, title: 'เดินทางด้วยพลังงานสะอาด', body: 'รถจักรยานยนต์ไฟฟ้าสำหรับการเดินทางในมหาวิทยาลัย' },
  { icon: MapPinned, title: 'ติดตามตำแหน่งรถ', body: 'ดูตำแหน่งและสถานะการใช้งานจากหน้าแผนที่' },
];

const campusPhotos = [
  { src: '/assets/walailak-park-photo.jpg', alt: 'ภาพมุมสูงสวนวลัยลักษณ์และทะเลสาบภายในมหาวิทยาลัย', className: 'landing-bottom-photo--park' },
  { src: '/assets/walailak-campus-aerial.jpg', alt: 'ภาพมุมสูงอาคารและภูเขารอบมหาวิทยาลัยวลัยลักษณ์', className: 'landing-bottom-photo--campus' },
  { src: '/assets/walailak-main-gate.jpg', alt: 'ทางเข้าหลักมหาวิทยาลัยวลัยลักษณ์', className: 'landing-bottom-photo--entrance' },
  { src: '/assets/walailak-campus-building.jpg', alt: 'อาคารจุฬาภรณวลัยลักษณ์และสวนหน้าอาคาร', className: 'landing-bottom-photo--building' },
  { src: '/assets/walailak-student-residence-gate.jpg', alt: 'ทางเข้าหอพักนักศึกษามหาวิทยาลัยวลัยลักษณ์', className: 'landing-bottom-photo--residence' },
] as const;

type LandingSection = 'about' | 'how-and-safety';

interface LandingPageProps {
  onOpenAuth: (target: 'login' | 'register') => void;
}

export default function LandingPage({ onOpenAuth }: LandingPageProps) {
  const [campusPhotoIndex, setCampusPhotoIndex] = useState(0);
  const [isCampusAutoPlayPaused, setIsCampusAutoPlayPaused] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('');
  const pendingNavSection = useRef<LandingSection | null>(null);
  const registerReturnPath = window.location.pathname === '/Welcome' ? '/Welcome' : '/';
  useEffect(() => {
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pauseForReducedMotion = () => {
      if (motionPreference.matches) setIsCampusAutoPlayPaused(true);
    };
    motionPreference.addEventListener('change', pauseForReducedMotion);
    return () => motionPreference.removeEventListener('change', pauseForReducedMotion);
  }, []);
  useEffect(() => {
    if (isCampusAutoPlayPaused) return;
    const intervalId = window.setInterval(() => {
      setCampusPhotoIndex((current) => (current + 1) % campusPhotos.length);
    }, 5000);
    return () => window.clearInterval(intervalId);
  }, [campusPhotoIndex, isCampusAutoPlayPaused]);
  useEffect(() => {
    const updateActiveSection = () => {
      const activationLine = Math.min(240, window.innerHeight * 0.32);
      const requestedSection = pendingNavSection.current;
      if (requestedSection) {
        const target = document.getElementById(requestedSection);
        if (target && target.getBoundingClientRect().top > activationLine) {
          setActiveSection(requestedSection);
          return;
        }
        pendingNavSection.current = null;
        setActiveSection(requestedSection);
        return;
      }
      const aboutBounds = document.getElementById('about')?.getBoundingClientRect();
      const combinedBounds = document.getElementById('how-and-safety')?.getBoundingClientRect();
      const aboutIsCurrent = aboutBounds && aboutBounds.top <= activationLine && aboutBounds.bottom > activationLine;
      const combinedIsCurrent = combinedBounds && combinedBounds.top <= activationLine && combinedBounds.bottom > activationLine;
      const currentSection = aboutIsCurrent ? 'about' : combinedIsCurrent ? 'how-and-safety' : '';
      setActiveSection(currentSection);
    };
    updateActiveSection();
    window.addEventListener('scroll', updateActiveSection, { passive: true });
    window.addEventListener('resize', updateActiveSection);
    return () => {
      window.removeEventListener('scroll', updateActiveSection);
      window.removeEventListener('resize', updateActiveSection);
    };
  }, []);
  function navigateToSection(sectionId: LandingSection) {
    pendingNavSection.current = sectionId;
    setActiveSection(sectionId);
    setMobileMenuOpen(false);
  }
  function followAuthLink(event: MouseEvent<HTMLAnchorElement>, target: 'login' | 'register') {
    setMobileMenuOpen(false);
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onOpenAuth(target);
  }
  return <div className="landing-page">
    <header className="landing-header">
      <a className="landing-brand" href="/" aria-label="EV Walailak หน้าแรก">
        <span className="landing-brand-icon"><Bike size={22}/></span>
        <span><strong>EV Walailak</strong><small>รถจักรยานยนต์ไฟฟ้า · วลัยลักษณ์</small></span>
      </a>
      <nav id="landing-navigation" className={`landing-nav${mobileMenuOpen ? ' is-open' : ''}`} aria-label="เมนูหลัก">
        <a href="#about" aria-current={activeSection === 'about' ? 'location' : undefined} onClick={() => navigateToSection('about')}>เกี่ยวกับเรา</a>
        <a href="#how-and-safety" aria-current={activeSection === 'how-and-safety' ? 'location' : undefined} onClick={() => navigateToSection('how-and-safety')}>วิธีใช้และความปลอดภัย</a>
      </nav>
      <div className="landing-actions">
        <a className="landing-signup" href={`/RegisterPage?returnTo=${encodeURIComponent(registerReturnPath)}`} onClick={(event) => followAuthLink(event, 'register')}>สมัครสมาชิก</a>
        <a className="landing-signin" href="/LoginPage" onClick={(event) => followAuthLink(event, 'login')}>เข้าสู่ระบบ</a>
        <button className="landing-menu-toggle" type="button" aria-label={mobileMenuOpen ? 'ปิดเมนู' : 'เปิดเมนู'} aria-expanded={mobileMenuOpen} aria-controls="landing-navigation" onClick={() => setMobileMenuOpen((open) => !open)}>
          {mobileMenuOpen ? <X size={20}/> : <Menu size={20}/>}
        </button>
      </div>
    </header>
    <main>
      <section className="landing-hero"><div className="landing-hero-copy"><h1>เดินทางสะดวก<br/><strong>ขับเคลื่อนอย่างมั่นใจ</strong></h1><p className="landing-hero-description">EV Walailak เชื่อมผู้ใช้กับรถจักรยานยนต์ไฟฟ้าภายในมหาวิทยาลัยวลัยลักษณ์ ตั้งแต่ตรวจสิทธิ์ ดูสถานะรถ ไปจนถึงติดตามการเดินทางในระบบเดียว</p><a id="start-riding" className="landing-cta" href="/LoginPage" onClick={(event) => followAuthLink(event, "login")}><Zap size={17}/> เริ่มใช้งานรถไฟฟ้า <ArrowRight size={17}/></a><span className="landing-cta-note">เข้าสู่ระบบก่อนขอใช้รถ · สำหรับผู้มีสิทธิ์ใช้งาน</span></div><div className="landing-hero-visual"><img src="/assets/ev-01-motorcycle-login.png" alt="รถจักรยานยนต์ไฟฟ้าต้นแบบ EV-01"/></div><div className="landing-trustbar"><div><ShieldCheck/><span><b>ปลอดภัยและตรวจสอบได้</b><small>ตรวจสิทธิ์และสภาพรถก่อนใช้งาน</small></span></div><div><UsersRound/><span><b>เพื่อชุมชนวลัยลักษณ์</b><small>นักศึกษาและบุคลากรใช้งานร่วมกัน</small></span></div><div><Clock3/><span><b>ติดตามการใช้งาน</b><small>ดู Session และประวัติได้ในระบบ</small></span></div><div><BatteryCharging/><span><b>พลังงานสะอาด</b><small>ทางเลือกการเดินทางในมหาวิทยาลัย</small></span></div></div></section>
      <section className="landing-about" id="about"><div className="landing-about-copy"><span className="landing-section-label">EV WALAILAK</span><h2>ทุกการเดินทาง<br/>เริ่มต้นได้ง่ายขึ้น</h2><p>แพลตฟอร์มกลางสำหรับจัดการรถจักรยานยนต์ไฟฟ้า ตั้งแต่ตรวจสอบสิทธิ์ ดูสถานะรถ ไปจนถึงติดตามการใช้งาน</p></div><div className="landing-feature-grid" id="features">{features.map(({icon: Icon,title,body})=><article className="landing-feature" key={title}><span><Icon size={24}/></span><h3>{title}</h3><p>{body}</p></article>)}</div></section>
      <div className="landing-info-grid" id="how-and-safety"><section className="landing-how" id="how-it-works"><div><span className="landing-section-label">วิธีใช้งาน</span><h2>จากตรวจสิทธิ์สู่การเดินทาง</h2></div><div className="landing-steps"><article><i>1</i><p>สมัครสมาชิกและรอการอนุมัติสิทธิ์ขับขี่</p></article><article><i>2</i><p>ตรวจสถานะรถและความพร้อมก่อนเริ่ม Session</p></article><article><i>3</i><p>ใช้งานรถและจบ Session ตามขั้นตอนคืนรถ</p></article></div></section><section className="landing-safety" id="safety"><ShieldCheck size={29}/><span className="landing-section-label">ความปลอดภัย</span><h2>เดินทางอย่างมั่นใจ<br/>ในทุกขั้นตอน</h2><p>ตรวจสอบสิทธิ์ สวมหมวกนิรภัย และเช็กสภาพรถก่อนออกเดินทาง หากพบปัญหาให้แจ้งผ่านระบบเพื่อให้ผู้ดูแลตรวจสอบ</p></section></div>
      <section className="landing-bottom" aria-label="ภาพบรรยากาศมหาวิทยาลัยวลัยลักษณ์ เลื่อนภาพอัตโนมัติทุก 5 วินาที">
        <img key={campusPhotos[campusPhotoIndex].src} className={`landing-bottom-photo ${campusPhotos[campusPhotoIndex].className}`} src={campusPhotos[campusPhotoIndex].src} alt={campusPhotos[campusPhotoIndex].alt} />
        <div className="landing-bottom-copy"><h2>อีกก้าวของการเดินทาง<br/>ในมหาวิทยาลัย</h2><p>รถไฟฟ้าเพื่อการเดินทางที่สะดวกและใส่ใจสิ่งแวดล้อม</p></div>
        <span>EV Walailak · ELECTRIC MOBILITY</span>
        <div className="landing-bottom-controls" aria-label="ควบคุมภาพบรรยากาศ">
          <button type="button" aria-label="ภาพก่อนหน้า" onClick={() => setCampusPhotoIndex((current) => (current - 1 + campusPhotos.length) % campusPhotos.length)}><ChevronLeft size={15} /></button>
          <span aria-live="off">{campusPhotoIndex + 1} / {campusPhotos.length}</span>
          <button type="button" className="landing-autoplay-toggle" aria-label={isCampusAutoPlayPaused ? 'เล่นภาพอัตโนมัติ' : 'หยุดภาพอัตโนมัติ'} onClick={() => setIsCampusAutoPlayPaused((paused) => !paused)}>
            {isCampusAutoPlayPaused ? <Play size={13} /> : <Pause size={13} />}
          </button>
          <button type="button" aria-label="ภาพถัดไป" onClick={() => setCampusPhotoIndex((current) => (current + 1) % campusPhotos.length)}><ChevronRight size={15} /></button>
        </div>
      </section>
    </main><footer className="landing-footer"><div className="landing-footer-inner"><div className="landing-footer-about"><a className="landing-brand" href="/"><span className="landing-brand-icon"><Bike size={20}/></span><span><strong>EV Walailak</strong><small>รถจักรยานยนต์ไฟฟ้า · วลัยลักษณ์</small></span></a><p>ระบบจัดการรถจักรยานยนต์ไฟฟ้าต้นแบบสำหรับการเดินทางภายในมหาวิทยาลัย</p></div><div><strong>สำรวจ</strong><a href="#about">เกี่ยวกับเรา</a><a href="#how-it-works">วิธีใช้งาน</a></div><div><strong>ความปลอดภัย</strong><a href="#safety">ก่อนเริ่มใช้งาน</a><a href="/LoginPage" onClick={(event) => followAuthLink(event, "login")}>เข้าสู่ระบบ</a></div><div className="landing-footer-cta"><strong>พร้อมเริ่มต้นหรือยัง?</strong><p>เข้าสู่ระบบเพื่อตรวจสิทธิ์และดูข้อมูลรถ</p><a href="#start-riding" onClick={(event) => { event.preventDefault(); document.getElementById("start-riding")?.scrollIntoView({ behavior: "smooth", block: "center" }); }}>เริ่มใช้งาน <ArrowRight size={14}/></a></div></div><div className="landing-footer-bottom"><span>© EV Walailak · โครงการรถจักรยานยนต์ไฟฟ้าต้นแบบ</span><span>ภาพสวนวลัยลักษณ์: <a href="https://collections.wu.ac.th/view.php?id=59" target="_blank" rel="noreferrer">คลังภาพ มหาวิทยาลัยวลัยลักษณ์</a></span></div></footer>
  </div>;
}
