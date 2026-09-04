import LandingHeader from '../components/voice-landing/LandingHeader'
import HeroSection from '../components/voice-landing/HeroSection'
import ClientsSection from '../components/voice-landing/ClientsSection'
import FeaturesShowcase from '../components/voice-landing/FeaturesShowcase'
import TryBotSection from '../components/voice-landing/TryBotSection'
import WhyChooseSection from '../components/voice-landing/WhyChooseSection'
import DeployAnywhereSection from '../components/voice-landing/DeployAnywhereSection'
import UseCasesSection from '../components/voice-landing/UseCasesSection'
import CaseStudiesSection from '../components/voice-landing/CaseStudiesSection'
import CTASection from '../components/voice-landing/CTASection'
import LandingFooter from '../components/voice-landing/LandingFooter'
import VoiceChatFAB from '../components/voice-landing/VoiceChatFAB'

export default function VoiceLanding() {
  return (
    <div className="bg-white">
      <LandingHeader />
      <HeroSection />
      <ClientsSection />
      <FeaturesShowcase />
      <TryBotSection />
      <WhyChooseSection />
      <DeployAnywhereSection />
      <UseCasesSection />
      <CaseStudiesSection />
      <CTASection />
      <LandingFooter />
      <VoiceChatFAB />
    </div>
  )
}
