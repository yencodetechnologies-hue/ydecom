import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Clock3, Mail, ShieldCheck, Sparkles } from 'lucide-react';
import AuthBrandPanel from '../components/auth/AuthBrandPanel';
import AuthCard from '../components/auth/AuthCard';

const STEPS = [
  { key: 'registered', label: 'Account created', hint: 'Details submitted' },
  { key: 'review', label: 'Under review', hint: 'Admin is verifying' },
  { key: 'approved', label: 'Approved', hint: 'Access unlocked' },
  { key: 'login', label: 'Start shopping', hint: 'Sign in anytime' },
];

export default function PendingApprovalPage() {
  const { state } = useLocation();
  const source = state?.source || 'login';
  const name = state?.name?.trim();
  const email = state?.email?.trim();
  const identifier = state?.identifier?.trim();
  const activeStep = source === 'register' ? 1 : 1;

  const headline =
    source === 'register'
      ? name
        ? `You're almost there, ${name.split(' ')[0]}!`
        : 'Registration successful!'
      : 'Your account is pending approval';

  const subtitle =
    source === 'register'
      ? "Thank you for joining YDecom. Our team is reviewing your account — you'll get full access once approved."
      : "Your credentials are valid, but your account hasn't been approved yet. Please check back after admin review.";

  return (
    <AuthCard
      brand={
        <AuthBrandPanel
          title="Your account is in good hands."
          subtitle="Every registration is reviewed by our admin team to keep the marketplace trusted and secure for stockists, distributors, retailers, and customers."
        />
      }
    >
      <div className="w-full">
        <div className="relative mx-auto mb-6 flex h-[88px] w-[88px] items-center justify-center">
          <span
            className="absolute inset-0 animate-pulse rounded-full bg-gradient-to-br from-amber/25 to-rose/20"
            aria-hidden
          />
          <span
            className="absolute inset-2 rounded-full border border-amber/30 bg-gradient-to-br from-[#FFF8EB] to-[#FFFAFB]"
            aria-hidden
          />
          <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber to-[#F59E0B] text-white shadow-[0_10px_24px_-8px_rgba(245,158,11,0.55)]">
            <Clock3 className="h-7 w-7 animate-[spin_8s_linear_infinite]" strokeWidth={2} />
          </span>
          <Sparkles
            className="absolute -right-1 -top-1 h-5 w-5 text-rose"
            strokeWidth={2}
            aria-hidden
          />
        </div>

        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber/25 bg-amber/10 px-3 py-1 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-amber">
          <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2.2} />
          Awaiting admin approval
        </div>

        <h2 className="mt-3 font-display text-[26px] font-semibold leading-tight text-wine sm:text-[28px]">
          {headline}
        </h2>
        <p className="mt-2.5 text-[14px] leading-relaxed text-mauve">{subtitle}</p>

        {(email || identifier) ? (
          <div className="mt-5 flex items-start gap-3 rounded-[14px] border border-blush-line bg-[#FFFAFB] px-4 py-3.5">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-plum shadow-sm">
              <Mail className="h-4 w-4" strokeWidth={2} />
            </span>
            <div className="min-w-0 text-left">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-mauve/80">
                {source === 'register' ? 'Registered with' : 'Sign-in attempt'}
              </p>
              <p className="mt-0.5 truncate text-[14px] font-medium text-wine">
                {email || identifier}
              </p>
              <p className="mt-1 text-[12.5px] text-mauve">
                We'll notify you once your account is approved. No further action needed right now.
              </p>
            </div>
          </div>
        ) : null}

        <div className="mt-7 rounded-[16px] border border-blush-line bg-white p-4 sm:p-5">
          <p className="mb-4 text-[12px] font-semibold uppercase tracking-[0.12em] text-mauve/70">
            What happens next
          </p>
          <ol className="space-y-0">
            {STEPS.map((step, index) => {
              const done = index < activeStep;
              const current = index === activeStep;
              const upcoming = index > activeStep;
              return (
                <li key={step.key} className="relative flex gap-3 pb-5 last:pb-0">
                  {index < STEPS.length - 1 ? (
                    <span
                      className={`absolute left-[15px] top-8 h-[calc(100%-12px)] w-px ${
                        done ? 'bg-emerald-300' : 'bg-blush-line'
                      }`}
                      aria-hidden
                    />
                  ) : null}
                  <span
                    className={`relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold transition-colors ${
                      done
                        ? 'border-emerald-500 bg-emerald-500 text-white'
                        : current
                          ? 'border-amber bg-amber/15 text-amber shadow-[0_0_0_4px_rgba(245,158,11,0.12)]'
                          : 'border-blush-line bg-[#FFFAFB] text-mauve/50'
                    }`}
                  >
                    {done ? <CheckCircle2 className="h-4 w-4" strokeWidth={2.5} /> : index + 1}
                  </span>
                  <div className={`pt-0.5 ${upcoming ? 'opacity-55' : ''}`}>
                    <p
                      className={`text-[13.5px] font-semibold ${
                        current ? 'text-wine' : done ? 'text-emerald-700' : 'text-wine/70'
                      }`}
                    >
                      {step.label}
                      {current ? (
                        <span className="ml-2 inline-flex rounded-full bg-amber/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber">
                          Now
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-[12.5px] text-mauve">{step.hint}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link
            to="/login"
            className="inline-flex items-center justify-center gap-2 rounded-[11px] bg-rose px-4 py-3 text-[14px] font-bold text-white shadow-[0_8px_18px_-8px_rgba(255,62,118,0.55)] transition hover:-translate-y-px hover:bg-rose-deep"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2.2} />
            Back to sign in
          </Link>
          <Link
            to="/register"
            className="inline-flex items-center justify-center rounded-[11px] border border-blush-line bg-white px-4 py-3 text-[14px] font-semibold text-plum transition hover:bg-blush/40"
          >
            Create another account
          </Link>
        </div>

        <p className="mt-5 text-center text-[12.5px] leading-relaxed text-mauve">
          Need help? Contact your administrator or reach out via{' '}
          <a href="#" className="font-semibold text-plum no-underline hover:underline">
            support
          </a>
          .
        </p>
      </div>
    </AuthCard>
  );
}
