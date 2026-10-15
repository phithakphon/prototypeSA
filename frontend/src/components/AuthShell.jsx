import { useRef } from 'react'
import BuildingIllustration from './BuildingIllustration'
import BrandLogo from './BrandLogo'
import usePointerEffects from '../hooks/usePointerEffects'

// Shared two-column frame of the Login and Register pages:
// brand panel (logo, heading, building illustration) on the left, the form card on the right.
export default function AuthShell({ eyebrow = 'EMPLOYEE MANAGEMENT SYSTEM', heading, description, children }) {
  const rootRef = useRef(null)
  const cardRef = useRef(null)
  usePointerEffects(rootRef, cardRef)

  return (
    <main className="login-page" ref={rootRef}>
      <div className="bg-left" aria-hidden="true">
        <span className="spot" />
        <span className="orb orb-1" />
        <span className="orb orb-2" />
      </div>
      <div className="bg-right" aria-hidden="true" />
      <div className="cursor-glow" aria-hidden="true" />

      <section className="login-banner" aria-label="ข้อมูลบริษัท">
        <header className="company-brand">
          <BrandLogo size={52} />
          <div>
            <strong>บริษัท ศุภชัยสอบบัญชี</strong>
            <small>SUPACHAI AUDITING CO., LTD.</small>
          </div>
        </header>

        <div className="banner-middle">
          <div className="banner-content">
            <p className="eyebrow">{eyebrow}</p>
            <h1>{heading}</h1>
            <p className="banner-description">{description}</p>
          </div>
          <div className="banner-art">
            <div className="art-parallax">
              <BuildingIllustration />
            </div>
          </div>
        </div>

        <footer className="banner-footer">
          <span>AUDIT</span>
          <span>ASSURANCE</span>
          <span>PEOPLE</span>
        </footer>
      </section>

      <section className="login-panel">
        <div className="login-card" ref={cardRef}>
          {children}
        </div>
        <footer className="panel-footer">© 2026 บริษัท ศุภชัยสอบบัญชี · Employee Management System</footer>
      </section>
    </main>
  )
}
