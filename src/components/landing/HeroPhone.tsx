import { Icon } from "@/components/ui";
import { PRESETS, presetStyle } from "@/lib/site/presets";

/**
 * Phone mockup in the landing hero. Shows a compact preview of the demo
 * restaurant site in the "warm" preset. Rendered with the same tokens the
 * public renderer uses, so the marketing preview and the product match.
 */
export function HeroPhone() {
  const preset = PRESETS.warm;
  const dishes = [
    { name: "Nasi Lemak Ayam Berempah", price: "RM 9.50" },
    { name: "Ikan Keli Masak Lemak", price: "RM 12" },
  ];
  return (
    <div
      aria-hidden
      className="relative h-[612px] w-[282px] shrink-0 overflow-hidden rounded-[34px] border-[6px] border-[#1C1C1E] bg-[#1C1C1E] shadow-floating"
    >
      <div className="absolute top-2 left-1/2 z-10 h-[22px] w-[84px] -translate-x-1/2 rounded-pill bg-[#1C1C1E]" />
      <div
        className="flex h-full w-full flex-col overflow-hidden rounded-[28px] bg-site-ground text-site-ink"
        style={presetStyle(preset)}
      >
        <div className="h-[44px] shrink-0" />
        <div className="flex flex-col gap-3 px-3">
          <div className="flex items-center gap-2 rounded-card border border-site-line bg-site-ground/95 px-3 py-2">
            <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-site-accent font-site text-[15px] font-bold text-white">R</span>
            <span className="font-site text-[16px] font-bold">Rasa Kampung</span>
            <Icon name="menu" size={22} className="ml-auto text-site-ink" />
          </div>
          <div className="relative aspect-[4/5] max-h-[250px] overflow-hidden rounded-card bg-[repeating-linear-gradient(135deg,#D9B99B_0_10px,#CFAE8E_10px_20px)]">
            <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_35%,rgba(43,31,22,.88)_100%)]" />
            <div className="absolute right-3 bottom-3 left-3 flex flex-col gap-1 text-white">
              <span className="font-site text-[22px] leading-[1.1] font-bold">Masakan kampung, rasa rumah</span>
              <span className="text-[12px] opacity-90">Kajang · Buka 7am – 3pm</span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-site text-[15px] font-bold">Popular dishes</span>
            <div className="grid grid-cols-2 gap-2">
              {dishes.map((d) => (
                <div key={d.name} className="overflow-hidden rounded-thumb border border-site-line bg-white">
                  <div className="aspect-[4/3] bg-[repeating-linear-gradient(135deg,#D9B99B_0_10px,#CFAE8E_10px_20px)]" />
                  <div className="flex flex-col gap-0.5 px-2 pt-1.5 pb-2">
                    <span className="text-[11px] leading-[1.25] font-semibold">{d.name}</span>
                    <span className="text-[11px] font-bold text-site-accent">{d.price}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-card border border-site-line bg-white px-3 py-2 text-[11px]">
            <Icon name="star" size={14} fill className="text-amber" />
            <span className="font-semibold">4.9</span>
            <span className="text-site-muted">· 120+ reviews on Google</span>
          </div>
        </div>
        <div className="mt-auto flex gap-2 rounded-t-[20px] border-t border-site-line bg-site-ground/95 p-2.5 pb-6">
          <span className="flex h-11 flex-1 items-center justify-center gap-2 rounded-pill bg-whatsapp text-[13px] font-bold text-white">
            <Icon name="chat" size={18} fill />
            Order on WhatsApp
          </span>
          <span className="flex h-11 w-11 items-center justify-center rounded-pill border-[1.5px] border-site-ink text-site-ink">
            <Icon name="call" size={18} />
          </span>
        </div>
      </div>
    </div>
  );
}
