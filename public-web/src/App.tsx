import React, { useState, useEffect, useCallback } from 'react';
import { TopNavBar } from './components/TopNavBar';
import { HeroSection } from './components/HeroSection';
import { DailyProblemsSection } from './components/DailyProblemsSection';
import { WorkflowSection } from './components/WorkflowSection';
import { ChannelsConvergenceSection } from './components/ChannelsConvergenceSection';
import { CapabilitiesSection } from './components/CapabilitiesSection';
import { ReceptionByExceptionSection } from './components/ReceptionByExceptionSection';
import { ImpactSection } from './components/ImpactSection';
import { CompatibilitySection } from './components/CompatibilitySection';
import { PilotFormSection } from './components/PilotFormSection';
import { FooterSection } from './components/FooterSection';
import { CookieBanner } from './components/CookieBanner';
import { LegalModal, type LegalTab } from './components/LegalModal';

export const App: React.FC = () => {
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [activeLegalTab, setActiveLegalTab] = useState<LegalTab>('legal');

  const openLegalModal = useCallback((tab: LegalTab) => {
    setActiveLegalTab(tab);
    setLegalModalOpen(true);
  }, []);

  const closeLegalModal = useCallback(() => {
    setLegalModalOpen(false);
    // If the hash is a legal hash, remove it cleanly without jumping
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash === '#aviso-legal' || hash === '#politica-privacidad' || hash === '#politica-cookies') {
        history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    }
  }, []);

  // Listen to hash changes or initial hash
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;
      if (hash === '#aviso-legal') {
        openLegalModal('legal');
      } else if (hash === '#politica-privacidad') {
        openLegalModal('privacy');
      } else if (hash === '#politica-cookies') {
        openLegalModal('cookies');
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [openLegalModal]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col antialiased">
      <TopNavBar />
      <main className="flex-grow">
        <HeroSection />
        <DailyProblemsSection />
        <WorkflowSection />
        <ChannelsConvergenceSection />
        <CapabilitiesSection />
        <ReceptionByExceptionSection />
        <ImpactSection />
        <CompatibilitySection />
        <PilotFormSection onOpenPrivacy={() => openLegalModal('privacy')} />
      </main>
      <FooterSection onOpenLegal={openLegalModal} />

      <CookieBanner
        onOpenPolicy={() => openLegalModal('cookies')}
      />

      <LegalModal
        isOpen={legalModalOpen}
        activeTab={activeLegalTab}
        onClose={closeLegalModal}
        onTabChange={setActiveLegalTab}
      />
    </div>
  );
};

export default App;
