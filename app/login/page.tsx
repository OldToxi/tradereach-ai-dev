import { Logo } from '@/components/Logo'
import { LoginForm } from '@/components/LoginForm'

export default function LoginPage() {
  return (
    <div className="login">
      <div className="brandside">
        <div className="brand">
          <Logo size={26} />
          <div>
            <b style={{ fontSize: 15 }}>TradeReach AI</b>
            <span
              style={{
                fontSize: 10,
                color: '#7D97A5',
                display: 'block',
                letterSpacing: '.06em',
              }}
            >
              ANWAR GROUP · EXPORT DEVELOPMENT
            </span>
          </div>
        </div>
        <h1>One view of every export conversation.</h1>
        <p>
          Research, qualify, and reach international buyers — with AI doing the reading and
          drafting, and your team keeping the final word.
        </p>
        <ul>
          <li>Research is separated from opinion. Every field carries its source.</li>
          <li>No email leaves the building without a named approver.</li>
          <li>Pricing, credit, MOQ and distributor terms stay with authorised staff.</li>
        </ul>
      </div>
      <div className="formside">
        <LoginForm />
      </div>
    </div>
  )
}
