/**
 * Shared split auth card — equal left/right columns that stretch to the same height.
 */
export default function AuthCard({ brand, children }) {
  return (
    <div className="flex w-full flex-1 items-center justify-center px-4 py-6 font-inter sm:px-6 sm:py-8 lg:px-10">
      <div className="flex w-full max-w-[1100px] overflow-hidden rounded-[22px] bg-white shadow-[0_30px_60px_-20px_rgba(61,14,40,0.25),0_2px_6px_rgba(61,14,40,0.06)] md:min-h-[560px]">
        <div className="hidden w-1/2 shrink-0 self-stretch md:block">{brand}</div>
        <div className="flex w-full flex-col justify-center self-stretch px-6 py-9 sm:px-10 sm:py-11 md:w-1/2 lg:px-12">
          {children}
        </div>
      </div>
    </div>
  );
}
