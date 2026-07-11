// Pre-authored reassuring scripts used by the deterministic fallback engine
// when the AI provider is unavailable. Keeps the demo functional offline.

type Lang =
  | "Spanish"
  | "French"
  | "Arabic"
  | "Portuguese"
  | "Hindi"
  | "German";

export function fallbackScript(lang: Lang, safeGate: string): { en: string; translated: string } {
  const en = `Please come with me — I'll walk you straight to ${safeGate}, where there's a First Aid station, an accessible restroom, and no wait time.`;
  const map: Record<Lang, string> = {
    Spanish: `Por favor, venga conmigo. Le acompañaré directamente a la ${safeGate}, donde hay una estación de primeros auxilios, un baño accesible y no hay espera.`,
    French: `Veuillez me suivre. Je vous accompagne directement à la ${safeGate} : il y a un poste de premiers secours, des toilettes accessibles et aucune attente.`,
    Arabic: `من فضلك تعال معي — سأرافقك مباشرة إلى ${safeGate}، حيث توجد نقطة إسعافات أولية ودورة مياه مهيأة لذوي الاحتياجات، ولا يوجد انتظار.`,
    Portuguese: `Por favor, venha comigo. Vou levá-lo diretamente à ${safeGate}, onde há um posto de primeiros socorros, banheiro acessível e sem espera.`,
    Hindi: `कृपया मेरे साथ आइए — मैं आपको सीधे ${safeGate} तक ले चलता हूँ, वहाँ प्राथमिक चिकित्सा, सुलभ शौचालय है और कोई प्रतीक्षा नहीं है।`,
    German: `Bitte kommen Sie mit — ich bringe Sie direkt zum ${safeGate}. Dort gibt es Erste Hilfe, ein barrierefreies WC und keine Wartezeit.`,
  };
  return { en, translated: map[lang] };
}
