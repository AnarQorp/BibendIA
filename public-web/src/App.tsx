import React from 'react';
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

export const App: React.FC = () => {
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
        <PilotFormSection />
      </main>
      <FooterSection />
    </div>
  );
};

export default App;
