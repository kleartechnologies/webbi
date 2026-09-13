const ITEMS = ["One description in, one website out", "English & Bahasa Melayu", "WhatsApp as your front door", "Published on webbi.online"];

export function CapabilityStrip() {
  return (
    <div className="relative z-[1] bg-ink px-4 pt-5 pb-14">
      <ul className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-center gap-x-7 gap-y-[10px] text-[14px] font-semibold text-white/78">
        {ITEMS.map((item, i) => (
          <li key={item} className="flex items-center gap-7">
            {i > 0 ? <span aria-hidden className="hidden text-sun sm:inline">·</span> : null}
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
