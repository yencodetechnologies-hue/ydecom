import { Lock, User } from 'lucide-react';

export default function AuthBrandPanel({
  title = 'Multi‑role commerce for stockists, distributors, retailers & customers.',
  subtitle = 'One marketplace, four vantage points — with pricing and permissions the admin controls end to end.',
}) {
  return (
    <div
      className="flex h-full min-h-full flex-col justify-between px-10 py-11 text-[#F9EDF1] lg:px-12"
      style={{
        background:
          'radial-gradient(circle at 85% 88%, rgba(255,62,118,0.16), transparent 55%), linear-gradient(160deg, #3D0E28 0%, #280A1A 100%)',
      }}
    >
      <div>
        <div className="flex items-center gap-[11px]">
          <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] bg-rose font-display text-lg font-bold text-white">
            Y
          </span>
          <span className="font-display text-[19px] font-semibold tracking-[0.2px]">YDecom</span>
        </div>

        <div className="mt-[34px]">
          <h1 className="m-0 font-display text-[26px] font-medium leading-[1.28]">
            {title}
          </h1>
          <p className="mt-3 text-[13.5px] leading-[1.6] text-[rgba(249,237,241,0.62)]">
            {subtitle}
          </p>
        </div>

        <div className="mt-10">
          <div className="mb-4 text-[10.5px] font-semibold tracking-[1.4px] text-[rgba(249,237,241,0.4)] uppercase">
            Order flow, one network
          </div>
          <svg viewBox="0 0 300 92" fill="none" className="block h-auto w-full overflow-visible">
            <path
              d="M20,55 C60,20 100,20 140,30 C170,38 190,50 220,62 C240,70 260,45 280,26"
              stroke="rgba(249,237,241,0.22)"
              strokeWidth="1.5"
              strokeDasharray="1 7"
              strokeLinecap="round"
            />
            <circle r="3.5" fill="#FF3E76">
              <animateMotion
                dur="4.5s"
                repeatCount="indefinite"
                path="M20,55 C60,20 100,20 140,30 C170,38 190,50 220,62 C240,70 260,45 280,26"
              />
            </circle>
            <circle cx="20" cy="55" r="5.5" fill="#3D0E28" stroke="#FF3E76" strokeWidth="1.4" />
            <text x="20" y="76" fill="rgba(249,237,241,0.55)" fontSize="8.5" textAnchor="middle">
              Stockist
            </text>
            <circle cx="140" cy="30" r="5.5" fill="#3D0E28" stroke="#FF3E76" strokeWidth="1.4" />
            <text x="140" y="14" fill="rgba(249,237,241,0.55)" fontSize="8.5" textAnchor="middle">
              Distributor
            </text>
            <circle cx="220" cy="62" r="5.5" fill="#3D0E28" stroke="#FF3E76" strokeWidth="1.4" />
            <text x="220" y="83" fill="rgba(249,237,241,0.55)" fontSize="8.5" textAnchor="middle">
              Retailer
            </text>
            <circle cx="280" cy="26" r="5.5" fill="#FF3E76" stroke="#FF3E76" strokeWidth="1.4" />
            <text x="272" y="14" fill="#FF3E76" fontSize="8.5" textAnchor="end">
              Customer
            </text>
          </svg>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        <div className="flex items-center gap-1.5 rounded-full border border-white/15 px-2.5 py-1.5 text-[11px] text-[rgba(249,237,241,0.72)]">
          <Lock className="h-3 w-3 shrink-0" strokeWidth={2} />
          Secure JWT auth
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-white/15 px-2.5 py-1.5 text-[11px] text-[rgba(249,237,241,0.72)]">
          <User className="h-3 w-3 shrink-0" strokeWidth={2} />
          Role‑based pricing
        </div>
      </div>
    </div>
  );
}
