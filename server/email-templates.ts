/**
 * ===========================================================================
 * Premium email template system — Youssef Ahmed | Elite Coaching
 * ===========================================================================
 *
 * Centralized, reusable, multi-language, RTL-aware, mobile-first email
 * templates. Every email goes through `shellHtml()` so the brand surface is
 * identical across welcome / booking / reminder / expiry / reset / admin.
 *
 * Design rules:
 *  - Use TABLES for layout (Outlook ignores flex/grid)
 *  - All styles INLINE (Gmail strips <style>)
 *  - max-width: 600px (mobile-first)
 *  - Dark luxury palette + electric blue glow accents
 *  - RTL support via dir="rtl" on root for Arabic / Urdu / Hebrew
 *  - Fallback English for any missing locale string
 *
 * NEVER:
 *  - import this from the client bundle
 *  - throw — every builder returns a complete {subject, html, text}
 */

// ---------------------------------------------------------------------------
// Brand
// ---------------------------------------------------------------------------
export const BRAND = {
  name: "Youssef Ahmed",
  tagline: "Elite Coaching • Dubai",
  trainerName: "Youssef Ahmed",
  whatsapp: "+971505394754",
  // Public website URL — overridden at call time when known
  defaultWebsite: "https://youssef-booking.vercel.app",
} as const;

// TRON Legacy dark luxury palette — Outlook-safe (solid colors, no rgba on
// backgrounds). AMOLED outer with deep navy interior + Tron-cyan accents
// matching the website (#5ee7ff), tuned for email rendering across
// Gmail / Apple Mail / Outlook / Samsung Mail.
const COLOR = {
  bgOuter: "#050505",        // AMOLED page bg — matches the site exactly
  bgCard: "#0a0f1c",         // primary surface (deep night navy)
  bgCardSoft: "#0f1730",     // secondary surface
  bgCardElev: "#13203f",     // elevated surface (badges / metric tiles)
  border: "#1b2746",         // subtle divider
  borderGlow: "#2c4078",     // accent border
  borderCyan: "#1d5e7a",     // tron border (cyan-tinted)
  text: "#f1f5f9",           // primary text
  textMuted: "#9fb1c9",      // secondary text (warmer for legibility)
  textDim: "#64748b",        // tertiary text
  primary: "#5ee7ff",        // TRON cyan — matches site accent
  primaryDark: "#22b8e0",    // gradient stop
  primaryGlow: "#0e6e8a",    // outer glow base
  primaryDeep: "#06324a",    // deepest cyan
  emerald: "#10b981",        // bonus / success
  amber: "#f59e0b",          // warning
  red: "#ef4444",            // danger
  gold: "#facc15",           // VIP / elite accent
} as const;

// ---------------------------------------------------------------------------
// Language pack
// ---------------------------------------------------------------------------
export type EmailLang =
  | "en" | "ar" | "fr" | "de" | "es" | "ru" | "tr" | "zh" | "hi" | "ur" | "pt" | "it";

const RTL_LANGS = new Set<EmailLang>(["ar", "ur"]);

export function isRtl(lang: string | null | undefined): boolean {
  return RTL_LANGS.has(((lang || "en").toLowerCase() as EmailLang));
}

export function normalizeLang(lang: string | null | undefined): EmailLang {
  const c = (lang || "en").toLowerCase().split("-")[0];
  return (STRINGS[c as EmailLang] ? c : "en") as EmailLang;
}

type Strings = {
  // Brand / shell
  brandTagline: string;
  greeting: string;             // "Hi {name},"
  signoff: string;              // "See you soon,"
  signoffName: string;          // "Coach Youssef Ahmed"
  questionsCta: string;         // "Have a question? Message me on WhatsApp."
  footerNote: string;           // "Sent automatically by Youssef Ahmed | Elite Coaching."
  footerUnsubNote: string;      // "You're receiving this because you have an active account."
  ctaDashboard: string;         // "Open my dashboard"
  ctaWhatsapp: string;          // "Message Coach on WhatsApp"

  // Welcome
  welcomeSubject: string;       // "Welcome to Youssef Ahmed | Elite Coaching"
  welcomeHero: string;          // "Welcome aboard, {name}"
  welcomeBody: string;          // "Your account is live..."
  welcomeFeatBookT: string;
  welcomeFeatBookB: string;
  welcomeFeatInbodyT: string;
  welcomeFeatInbodyB: string;
  welcomeFeatContactT: string;
  welcomeFeatContactB: string;
  welcomeCtaBook: string;
  welcomeCtaInbody: string;
  welcomeCtaContact: string;
  welcomeRulesHeading: string;
  welcomeRule1: string;
  welcomeRule2: string;
  welcomeRule3: string;

  // Booking confirmation
  bookingSubject: string;       // "Session confirmed — {date} at {time}"
  bookingHero: string;          // "Your session is confirmed"
  bookingBody: string;          // "Everything is locked in. Here are your details:"
  bookingDate: string;
  bookingTime: string;
  bookingFocus: string;
  bookingGoal: string;
  bookingType: string;
  bookingLocation: string;
  bookingLocationValue: string;
  bookingPackage: string;
  bookingRemaining: string;
  bookingExpires: string;
  bookingRulesHeading: string;
  bookingRule1: string;
  bookingRule2: string;
  bookingRule3: string;

  // Reminders
  reminder24Subject: string;    // "Tomorrow at {time} — see you soon"
  reminder24Hero: string;       // "Your session is tomorrow"
  reminder24Body: string;
  reminder1Subject: string;     // "Starting in 1 hour — {time}"
  reminder1Hero: string;        // "1 hour to go"
  reminder1Body: string;

  // Package expiring soon
  expiringSubject: string;      // "Your package is running low"
  expiringHero: string;         // "Heads up — package expiring soon"
  expiringBodyLow: string;      // "{n} sessions remaining."
  expiringBodyDays: string;     // "Your package expires in {n} days."
  expiringCta: string;          // "Renew with Coach"

  // Package finished
  finishedSubject: string;      // "Time to go again — your package is complete"
  finishedHero: string;         // "Incredible work, {name}"
  finishedBody: string;
  finishedCta: string;          // "Renew my training"

  // Password reset
  resetSubject: string;         // "Reset your password"
  resetHero: string;            // "Reset your password"
  resetBody: string;
  resetCta: string;             // "Reset password"
  resetExpiry: string;          // "This link expires in 30 minutes."
  resetAltLink: string;         // "Or paste this link into your browser:"
  resetDisclaimer: string;      // "If you didn't request this, ignore this email."
};

const en: Strings = {
  brandTagline: "Elite Coaching • Dubai",
  greeting: "Hi {name},",
  signoff: "See you soon,",
  signoffName: "Coach Youssef Ahmed",
  questionsCta: "Have a question? Message Coach Youssef directly on WhatsApp.",
  footerNote: "Sent automatically by Youssef Ahmed | Elite Coaching.",
  footerUnsubNote: "You're receiving this because you have an active account with Youssef Ahmed | Elite Coaching.",
  ctaDashboard: "Open my dashboard",
  ctaWhatsapp: "Message Coach on WhatsApp",

  welcomeSubject: "Welcome to Youssef Ahmed | Elite Coaching",
  welcomeHero: "Welcome aboard, {name}",
  welcomeBody: "Your account is ready. From here you can book sessions, track your InBody progress, and manage your training — all in one place. Coach Youssef will personally review your profile and tailor your programme to your goals.",
  welcomeFeatBookT: "Book your first session",
  welcomeFeatBookB: "Pick any open slot in the calendar — sessions are 1 hour.",
  welcomeFeatInbodyT: "Upload your InBody scan",
  welcomeFeatInbodyB: "We use it to set your starting point and measure progress.",
  welcomeFeatContactT: "Talk to your coach",
  welcomeFeatContactB: "WhatsApp Youssef anytime for questions or scheduling.",
  welcomeCtaBook: "Book a session",
  welcomeCtaInbody: "Upload InBody",
  welcomeCtaContact: "Contact Coach",
  welcomeRulesHeading: "A few quick reminders",
  welcomeRule1: "Each session is 1 hour.",
  welcomeRule2: "Cancel or reschedule at least 6 hours in advance.",
  welcomeRule3: "Late cancellations count as a used session.",

  bookingSubject: "Session confirmed — {date} at {time}",
  bookingHero: "Your session is confirmed",
  bookingBody: "Everything is locked in. Here are your details:",
  bookingDate: "Date",
  bookingTime: "Time",
  bookingFocus: "Session focus",
  bookingGoal: "Training goal",
  bookingType: "Session type",
  bookingLocation: "Location",
  bookingLocationValue: "To be confirmed by Coach",
  bookingPackage: "Package",
  bookingRemaining: "Sessions remaining",
  bookingExpires: "Package expires",
  bookingRulesHeading: "A few quick reminders",
  bookingRule1: "Each session is 1 hour.",
  bookingRule2: "Cancel or reschedule at least 6 hours in advance.",
  bookingRule3: "Any extra time must be agreed with Coach in advance.",

  reminder24Subject: "Tomorrow at {time} — see you soon",
  reminder24Hero: "Your session is tomorrow",
  reminder24Body: "Quick reminder: your training session is scheduled for tomorrow. Hydrate well, eat light beforehand, and bring a water bottle and a small towel.",
  reminder1Subject: "Starting in 1 hour — {time}",
  reminder1Hero: "1 hour to go",
  reminder1Body: "Your session starts in about an hour. See you on the floor — let's make this one count.",

  expiringSubject: "Your package is running low",
  expiringHero: "Heads up — your package is running low",
  expiringBodyLow: "You have {n} session{plural} remaining on your current package. Renew now to keep your training momentum.",
  expiringBodyDays: "Your package expires in {n} day{plural}. Renew now to keep your slots and your momentum.",
  expiringCta: "Renew with Coach",

  finishedSubject: "Your package is complete — time to go again",
  finishedHero: "Incredible work, {name}",
  finishedBody: "You've completed every session in your current package. The next chapter starts now — let's lock in your renewal and keep the progress compounding.",
  finishedCta: "Renew my training",

  resetSubject: "Reset your password",
  resetHero: "Reset your password",
  resetBody: "We received a request to reset the password on your Youssef Ahmed account. Tap the button below to set a new password.",
  resetCta: "Reset password",
  resetExpiry: "This link expires in 30 minutes.",
  resetAltLink: "Or paste this link into your browser:",
  resetDisclaimer: "If you didn't request this, you can safely ignore this email — your password will not change.",
};

const ar: Strings = {
  brandTagline: "تدريب نخبوي • دبي",
  greeting: "مرحباً {name}،",
  signoff: "إلى اللقاء قريباً،",
  signoffName: "الكوتش يوسف أحمد",
  questionsCta: "لديك سؤال؟ راسل الكوتش يوسف مباشرة عبر واتساب.",
  footerNote: "أُرسلت تلقائياً من Youssef Ahmed | Elite Coaching.",
  footerUnsubNote: "تتلقى هذه الرسالة لأن لديك حساباً نشطاً مع Youssef Ahmed | Elite Coaching.",
  ctaDashboard: "افتح لوحة التحكم",
  ctaWhatsapp: "تواصل مع الكوتش عبر واتساب",

  welcomeSubject: "أهلاً بك في Youssef Ahmed | Elite Coaching",
  welcomeHero: "أهلاً بك معنا، {name}",
  welcomeBody: "حسابك جاهز. من هنا يمكنك حجز الجلسات، ومتابعة تقدمك في InBody، وإدارة تدريبك في مكان واحد. سيقوم الكوتش يوسف بمراجعة ملفك شخصياً وتفصيل البرنامج وفقاً لأهدافك.",
  welcomeFeatBookT: "احجز جلستك الأولى",
  welcomeFeatBookB: "اختر أي وقت متاح في التقويم — مدة الجلسة ساعة واحدة.",
  welcomeFeatInbodyT: "ارفع تحليل InBody",
  welcomeFeatInbodyB: "نستخدمه لتحديد نقطة البداية وقياس تقدمك.",
  welcomeFeatContactT: "تواصل مع كوتشك",
  welcomeFeatContactB: "راسل يوسف عبر واتساب في أي وقت للأسئلة أو الجدولة.",
  welcomeCtaBook: "احجز جلسة",
  welcomeCtaInbody: "ارفع InBody",
  welcomeCtaContact: "تواصل مع الكوتش",
  welcomeRulesHeading: "تذكيرات مهمة",
  welcomeRule1: "مدة كل جلسة ساعة واحدة.",
  welcomeRule2: "يجب الإلغاء أو إعادة الجدولة قبل 6 ساعات على الأقل.",
  welcomeRule3: "الإلغاء المتأخر يُحتسب كجلسة مستخدمة.",

  bookingSubject: "تم تأكيد جلستك — {date} الساعة {time}",
  bookingHero: "تم تأكيد جلستك",
  bookingBody: "كل شيء جاهز. إليك التفاصيل:",
  bookingDate: "التاريخ",
  bookingTime: "الوقت",
  bookingFocus: "تركيز الجلسة",
  bookingGoal: "الهدف التدريبي",
  bookingType: "نوع الجلسة",
  bookingLocation: "الموقع",
  bookingLocationValue: "سيتم تأكيده من قِبل الكوتش",
  bookingPackage: "الباقة",
  bookingRemaining: "الجلسات المتبقية",
  bookingExpires: "تاريخ انتهاء الباقة",
  bookingRulesHeading: "تذكيرات سريعة",
  bookingRule1: "مدة كل جلسة ساعة واحدة.",
  bookingRule2: "الإلغاء أو إعادة الجدولة قبل 6 ساعات على الأقل.",
  bookingRule3: "أي وقت إضافي يجب الاتفاق عليه مع الكوتش مسبقاً.",

  reminder24Subject: "غداً الساعة {time} — إلى اللقاء قريباً",
  reminder24Hero: "جلستك غداً",
  reminder24Body: "تذكير سريع: جلستك التدريبية مجدولة غداً. اشرب الماء جيداً، تناول وجبة خفيفة قبلها، وأحضر زجاجة ماء ومنشفة صغيرة.",
  reminder1Subject: "تبدأ خلال ساعة — {time}",
  reminder1Hero: "بقيت ساعة واحدة",
  reminder1Body: "جلستك تبدأ خلال ساعة تقريباً. أراك في الصالة — لنجعل هذه الجلسة تستحق.",

  expiringSubject: "باقتك على وشك الانتهاء",
  expiringHero: "تنبيه — باقتك على وشك الانتهاء",
  expiringBodyLow: "تبقت لديك {n} جلسة في باقتك الحالية. جدّد الآن للحفاظ على زخم تدريبك.",
  expiringBodyDays: "باقتك ستنتهي خلال {n} يوم. جدّد الآن للحفاظ على مواعيدك وزخمك.",
  expiringCta: "جدّد مع الكوتش",

  finishedSubject: "أكملت باقتك — حان وقت التجديد",
  finishedHero: "عمل رائع، {name}",
  finishedBody: "أكملت كل الجلسات في باقتك الحالية. الفصل التالي يبدأ الآن — لنؤكد التجديد ونواصل البناء على نتائجك.",
  finishedCta: "جدّد تدريبي",

  resetSubject: "إعادة تعيين كلمة المرور",
  resetHero: "إعادة تعيين كلمة المرور",
  resetBody: "تلقينا طلباً لإعادة تعيين كلمة المرور لحسابك في Youssef Ahmed. اضغط الزر أدناه لتعيين كلمة مرور جديدة.",
  resetCta: "إعادة تعيين كلمة المرور",
  resetExpiry: "ينتهي هذا الرابط خلال 30 دقيقة.",
  resetAltLink: "أو الصق هذا الرابط في متصفحك:",
  resetDisclaimer: "إذا لم تطلب ذلك، يمكنك تجاهل هذه الرسالة بأمان — لن تتغير كلمة المرور.",
};

const fr: Strings = {
  brandTagline: "Coaching d'élite • Dubaï",
  greeting: "Bonjour {name},",
  signoff: "À très bientôt,",
  signoffName: "Coach Youssef Ahmed",
  questionsCta: "Une question ? Écris directement au Coach Youssef sur WhatsApp.",
  footerNote: "Envoyé automatiquement par Youssef Ahmed | Elite Coaching.",
  footerUnsubNote: "Vous recevez cet email car vous avez un compte actif chez Youssef Ahmed | Elite Coaching.",
  ctaDashboard: "Ouvrir mon tableau de bord",
  ctaWhatsapp: "Écrire au coach sur WhatsApp",
  welcomeSubject: "Bienvenue chez Youssef Ahmed | Elite Coaching",
  welcomeHero: "Bienvenue à bord, {name}",
  welcomeBody: "Votre compte est prêt. Vous pouvez désormais réserver vos séances, suivre votre progression InBody et gérer votre entraînement en un seul endroit. Coach Youssef examinera personnellement votre profil et adaptera votre programme à vos objectifs.",
  welcomeFeatBookT: "Réservez votre première séance",
  welcomeFeatBookB: "Choisissez un créneau libre — chaque séance dure 1 heure.",
  welcomeFeatInbodyT: "Téléversez votre scan InBody",
  welcomeFeatInbodyB: "Il sert de point de départ pour mesurer vos progrès.",
  welcomeFeatContactT: "Parlez à votre coach",
  welcomeFeatContactB: "Écrivez à Youssef sur WhatsApp pour toute question.",
  welcomeCtaBook: "Réserver une séance",
  welcomeCtaInbody: "Téléverser InBody",
  welcomeCtaContact: "Contacter le coach",
  welcomeRulesHeading: "Quelques rappels",
  welcomeRule1: "Chaque séance dure 1 heure.",
  welcomeRule2: "Annulez ou reprogrammez au moins 6 heures à l'avance.",
  welcomeRule3: "Les annulations tardives comptent comme une séance utilisée.",
  bookingSubject: "Séance confirmée — {date} à {time}",
  bookingHero: "Votre séance est confirmée",
  bookingBody: "Tout est validé. Voici vos détails :",
  bookingDate: "Date",
  bookingTime: "Heure",
  bookingFocus: "Focus de la séance",
  bookingGoal: "Objectif",
  bookingType: "Type de séance",
  bookingLocation: "Lieu",
  bookingLocationValue: "À confirmer par le coach",
  bookingPackage: "Forfait",
  bookingRemaining: "Séances restantes",
  bookingExpires: "Expiration du forfait",
  bookingRulesHeading: "Quelques rappels",
  bookingRule1: "Chaque séance dure 1 heure.",
  bookingRule2: "Annulez ou reprogrammez au moins 6 heures à l'avance.",
  bookingRule3: "Tout temps supplémentaire doit être convenu avec le coach.",
  reminder24Subject: "Demain à {time} — à très vite",
  reminder24Hero: "Votre séance est demain",
  reminder24Body: "Petit rappel : votre séance est prévue demain. Hydratez-vous bien, mangez léger avant, et prenez une bouteille d'eau et une petite serviette.",
  reminder1Subject: "Début dans 1 heure — {time}",
  reminder1Hero: "Plus qu'1 heure",
  reminder1Body: "Votre séance commence dans environ une heure. À tout de suite — donnons tout sur celle-ci.",
  expiringSubject: "Votre forfait s'épuise",
  expiringHero: "Attention — votre forfait s'épuise",
  expiringBodyLow: "Il vous reste {n} séances sur votre forfait actuel. Renouvelez maintenant pour garder votre élan.",
  expiringBodyDays: "Votre forfait expire dans {n} jours. Renouvelez maintenant pour garder vos créneaux.",
  expiringCta: "Renouveler avec le coach",
  finishedSubject: "Forfait terminé — il est temps de repartir",
  finishedHero: "Bravo, {name}",
  finishedBody: "Vous avez terminé toutes les séances de votre forfait. Le prochain chapitre commence maintenant — confirmons votre renouvellement et continuons sur cette lancée.",
  finishedCta: "Renouveler mon entraînement",
  resetSubject: "Réinitialiser votre mot de passe",
  resetHero: "Réinitialiser votre mot de passe",
  resetBody: "Nous avons reçu une demande de réinitialisation du mot de passe de votre compte Youssef Ahmed. Cliquez sur le bouton ci-dessous pour en définir un nouveau.",
  resetCta: "Réinitialiser le mot de passe",
  resetExpiry: "Ce lien expire dans 30 minutes.",
  resetAltLink: "Ou collez ce lien dans votre navigateur :",
  resetDisclaimer: "Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet email — votre mot de passe ne changera pas.",
};

const de: Strings = {
  brandTagline: "Elite Coaching • Dubai",
  greeting: "Hallo {name},",
  signoff: "Bis bald,",
  signoffName: "Coach Youssef Ahmed",
  questionsCta: "Fragen? Schreib Coach Youssef direkt auf WhatsApp.",
  footerNote: "Automatisch versendet von Youssef Ahmed | Elite Coaching.",
  footerUnsubNote: "Du erhältst diese E-Mail, weil du ein aktives Konto bei Youssef Ahmed | Elite Coaching hast.",
  ctaDashboard: "Mein Dashboard öffnen",
  ctaWhatsapp: "Coach auf WhatsApp schreiben",
  welcomeSubject: "Willkommen bei Youssef Ahmed | Elite Coaching",
  welcomeHero: "Willkommen an Bord, {name}",
  welcomeBody: "Dein Konto ist bereit. Ab jetzt kannst du Sessions buchen, deinen InBody-Fortschritt verfolgen und dein Training an einem Ort verwalten. Coach Youssef wird dein Profil persönlich prüfen und dein Programm auf deine Ziele zuschneiden.",
  welcomeFeatBookT: "Buche deine erste Session",
  welcomeFeatBookB: "Wähle einen freien Termin im Kalender — jede Session dauert 1 Stunde.",
  welcomeFeatInbodyT: "Lade deinen InBody-Scan hoch",
  welcomeFeatInbodyB: "Damit setzen wir deinen Startpunkt und messen den Fortschritt.",
  welcomeFeatContactT: "Sprich mit deinem Coach",
  welcomeFeatContactB: "Schreib Youssef jederzeit auf WhatsApp.",
  welcomeCtaBook: "Session buchen",
  welcomeCtaInbody: "InBody hochladen",
  welcomeCtaContact: "Coach kontaktieren",
  welcomeRulesHeading: "Kurze Erinnerungen",
  welcomeRule1: "Jede Session dauert 1 Stunde.",
  welcomeRule2: "Mindestens 6 Stunden vorher absagen oder umplanen.",
  welcomeRule3: "Späte Absagen zählen als verbrauchte Session.",
  bookingSubject: "Session bestätigt — {date} um {time}",
  bookingHero: "Deine Session ist bestätigt",
  bookingBody: "Alles ist fixiert. Hier sind deine Details:",
  bookingDate: "Datum",
  bookingTime: "Uhrzeit",
  bookingFocus: "Trainingsfokus",
  bookingGoal: "Trainingsziel",
  bookingType: "Session-Typ",
  bookingLocation: "Ort",
  bookingLocationValue: "Wird vom Coach bestätigt",
  bookingPackage: "Paket",
  bookingRemaining: "Verbleibende Sessions",
  bookingExpires: "Paket läuft ab",
  bookingRulesHeading: "Kurze Erinnerungen",
  bookingRule1: "Jede Session dauert 1 Stunde.",
  bookingRule2: "Mindestens 6 Stunden vorher absagen oder umplanen.",
  bookingRule3: "Zusatzzeit muss vorab mit dem Coach vereinbart werden.",
  reminder24Subject: "Morgen um {time} — bis gleich",
  reminder24Hero: "Deine Session ist morgen",
  reminder24Body: "Kurze Erinnerung: deine Trainingseinheit ist für morgen geplant. Trink genug, iss leicht davor, und bring eine Wasserflasche und ein kleines Handtuch mit.",
  reminder1Subject: "Beginnt in 1 Stunde — {time}",
  reminder1Hero: "Noch 1 Stunde",
  reminder1Body: "Deine Session beginnt in etwa einer Stunde. Bis gleich — lass uns Gas geben.",
  expiringSubject: "Dein Paket geht zur Neige",
  expiringHero: "Achtung — dein Paket geht zur Neige",
  expiringBodyLow: "Du hast noch {n} Sessions in deinem aktuellen Paket. Verlängere jetzt, damit dein Schwung nicht abbricht.",
  expiringBodyDays: "Dein Paket läuft in {n} Tagen ab. Verlängere jetzt, um deine Slots zu sichern.",
  expiringCta: "Mit dem Coach verlängern",
  finishedSubject: "Paket abgeschlossen — Zeit für die nächste Runde",
  finishedHero: "Stark gemacht, {name}",
  finishedBody: "Du hast alle Sessions deines Pakets absolviert. Das nächste Kapitel beginnt jetzt — lass uns die Verlängerung fixieren und am Fortschritt dranbleiben.",
  finishedCta: "Training verlängern",
  resetSubject: "Passwort zurücksetzen",
  resetHero: "Passwort zurücksetzen",
  resetBody: "Wir haben eine Anfrage zum Zurücksetzen deines Youssef-Ahmed-Passworts erhalten. Tippe unten auf den Button, um ein neues festzulegen.",
  resetCta: "Passwort zurücksetzen",
  resetExpiry: "Dieser Link läuft in 30 Minuten ab.",
  resetAltLink: "Oder kopiere diesen Link in deinen Browser:",
  resetDisclaimer: "Wenn du das nicht angefordert hast, ignoriere diese E-Mail einfach — dein Passwort bleibt unverändert.",
};

const es: Strings = {
  brandTagline: "Coaching de élite • Dubái",
  greeting: "Hola {name},",
  signoff: "Hasta pronto,",
  signoffName: "Coach Youssef Ahmed",
  questionsCta: "¿Tienes una pregunta? Escribe al Coach Youssef directamente por WhatsApp.",
  footerNote: "Enviado automáticamente por Youssef Ahmed | Elite Coaching.",
  footerUnsubNote: "Recibes este correo porque tienes una cuenta activa con Youssef Ahmed | Elite Coaching.",
  ctaDashboard: "Abrir mi panel",
  ctaWhatsapp: "Escribir al coach por WhatsApp",
  welcomeSubject: "Bienvenido a Youssef Ahmed | Elite Coaching",
  welcomeHero: "Bienvenido a bordo, {name}",
  welcomeBody: "Tu cuenta está lista. Desde aquí puedes reservar sesiones, seguir tu progreso InBody y gestionar tu entrenamiento en un solo lugar. El Coach Youssef revisará tu perfil personalmente y adaptará tu programa a tus objetivos.",
  welcomeFeatBookT: "Reserva tu primera sesión",
  welcomeFeatBookB: "Elige un hueco libre — cada sesión dura 1 hora.",
  welcomeFeatInbodyT: "Sube tu escaneo InBody",
  welcomeFeatInbodyB: "Lo usamos para fijar tu punto de partida y medir tu progreso.",
  welcomeFeatContactT: "Habla con tu coach",
  welcomeFeatContactB: "Escribe a Youssef por WhatsApp en cualquier momento.",
  welcomeCtaBook: "Reservar sesión",
  welcomeCtaInbody: "Subir InBody",
  welcomeCtaContact: "Contactar al coach",
  welcomeRulesHeading: "Recordatorios rápidos",
  welcomeRule1: "Cada sesión dura 1 hora.",
  welcomeRule2: "Cancela o reprograma con al menos 6 horas de antelación.",
  welcomeRule3: "Las cancelaciones tardías cuentan como sesión usada.",
  bookingSubject: "Sesión confirmada — {date} a las {time}",
  bookingHero: "Tu sesión está confirmada",
  bookingBody: "Todo listo. Estos son tus detalles:",
  bookingDate: "Fecha",
  bookingTime: "Hora",
  bookingFocus: "Enfoque de la sesión",
  bookingGoal: "Objetivo",
  bookingType: "Tipo de sesión",
  bookingLocation: "Ubicación",
  bookingLocationValue: "A confirmar por el coach",
  bookingPackage: "Paquete",
  bookingRemaining: "Sesiones restantes",
  bookingExpires: "Vencimiento del paquete",
  bookingRulesHeading: "Recordatorios rápidos",
  bookingRule1: "Cada sesión dura 1 hora.",
  bookingRule2: "Cancela o reprograma con al menos 6 horas de antelación.",
  bookingRule3: "Cualquier tiempo extra debe acordarse con el coach.",
  reminder24Subject: "Mañana a las {time} — nos vemos pronto",
  reminder24Hero: "Tu sesión es mañana",
  reminder24Body: "Recordatorio rápido: tu sesión está programada para mañana. Hidrátate bien, come ligero antes, y trae una botella de agua y una toalla pequeña.",
  reminder1Subject: "Empieza en 1 hora — {time}",
  reminder1Hero: "Falta 1 hora",
  reminder1Body: "Tu sesión empieza en aproximadamente una hora. Nos vemos en la sala — vamos a darlo todo.",
  expiringSubject: "Tu paquete se está acabando",
  expiringHero: "Atención — tu paquete se está acabando",
  expiringBodyLow: "Te quedan {n} sesiones en tu paquete actual. Renueva ahora para mantener tu impulso.",
  expiringBodyDays: "Tu paquete vence en {n} días. Renueva ahora para conservar tus huecos.",
  expiringCta: "Renovar con el coach",
  finishedSubject: "Paquete completado — hora de seguir",
  finishedHero: "Trabajo increíble, {name}",
  finishedBody: "Has completado todas las sesiones de tu paquete. El próximo capítulo empieza ahora — vamos a confirmar tu renovación y mantener el progreso.",
  finishedCta: "Renovar mi entrenamiento",
  resetSubject: "Restablecer tu contraseña",
  resetHero: "Restablecer tu contraseña",
  resetBody: "Recibimos una solicitud para restablecer la contraseña de tu cuenta Youssef Ahmed. Pulsa el botón para establecer una nueva.",
  resetCta: "Restablecer contraseña",
  resetExpiry: "Este enlace caduca en 30 minutos.",
  resetAltLink: "O pega este enlace en tu navegador:",
  resetDisclaimer: "Si no lo solicitaste, puedes ignorar este correo — tu contraseña no cambiará.",
};

const ru: Strings = {
  brandTagline: "Элитный коучинг • Дубай",
  greeting: "Здравствуйте, {name}!",
  signoff: "До встречи,",
  signoffName: "Тренер Юссеф Ахмед",
  questionsCta: "Есть вопрос? Напишите тренеру Юссефу напрямую в WhatsApp.",
  footerNote: "Отправлено автоматически Youssef Ahmed | Elite Coaching.",
  footerUnsubNote: "Вы получили это письмо, потому что у вас активный аккаунт в Youssef Ahmed | Elite Coaching.",
  ctaDashboard: "Открыть мой кабинет",
  ctaWhatsapp: "Написать тренеру в WhatsApp",
  welcomeSubject: "Добро пожаловать в Youssef Ahmed | Elite Coaching",
  welcomeHero: "Добро пожаловать, {name}",
  welcomeBody: "Ваш аккаунт готов. Здесь вы можете записываться на тренировки, отслеживать прогресс InBody и управлять занятиями в одном месте. Тренер Юссеф лично изучит ваш профиль и адаптирует программу под ваши цели.",
  welcomeFeatBookT: "Запишитесь на первую тренировку",
  welcomeFeatBookB: "Выберите свободное время — каждая сессия длится 1 час.",
  welcomeFeatInbodyT: "Загрузите свой скан InBody",
  welcomeFeatInbodyB: "Он задаёт точку старта и помогает измерять прогресс.",
  welcomeFeatContactT: "Свяжитесь с тренером",
  welcomeFeatContactB: "Пишите Юссефу в WhatsApp в любое время.",
  welcomeCtaBook: "Записаться",
  welcomeCtaInbody: "Загрузить InBody",
  welcomeCtaContact: "Написать тренеру",
  welcomeRulesHeading: "Важные напоминания",
  welcomeRule1: "Каждая сессия длится 1 час.",
  welcomeRule2: "Отмена или перенос — минимум за 6 часов.",
  welcomeRule3: "Поздние отмены засчитываются как использованная сессия.",
  bookingSubject: "Бронирование подтверждено — {date} в {time}",
  bookingHero: "Ваша тренировка подтверждена",
  bookingBody: "Всё зафиксировано. Детали ниже:",
  bookingDate: "Дата",
  bookingTime: "Время",
  bookingFocus: "Фокус тренировки",
  bookingGoal: "Цель",
  bookingType: "Тип тренировки",
  bookingLocation: "Место",
  bookingLocationValue: "Подтвердит тренер",
  bookingPackage: "Пакет",
  bookingRemaining: "Осталось сессий",
  bookingExpires: "Срок действия пакета",
  bookingRulesHeading: "Важные напоминания",
  bookingRule1: "Каждая сессия длится 1 час.",
  bookingRule2: "Отмена или перенос — минимум за 6 часов.",
  bookingRule3: "Дополнительное время согласуется с тренером заранее.",
  reminder24Subject: "Завтра в {time} — до встречи",
  reminder24Hero: "Ваша тренировка завтра",
  reminder24Body: "Напоминание: тренировка запланирована на завтра. Выпейте воды, поешьте лёгкое заранее и возьмите бутылку воды и небольшое полотенце.",
  reminder1Subject: "Начало через 1 час — {time}",
  reminder1Hero: "Остался 1 час",
  reminder1Body: "Тренировка начнётся примерно через час. До встречи в зале — выложимся на полную.",
  expiringSubject: "Ваш пакет подходит к концу",
  expiringHero: "Внимание — пакет подходит к концу",
  expiringBodyLow: "В вашем пакете осталось {n} сессий. Продлите сейчас, чтобы сохранить темп.",
  expiringBodyDays: "Ваш пакет истекает через {n} дней. Продлите сейчас, чтобы сохранить слоты.",
  expiringCta: "Продлить с тренером",
  finishedSubject: "Пакет завершён — пора продолжать",
  finishedHero: "Отличная работа, {name}",
  finishedBody: "Вы прошли все сессии текущего пакета. Следующая глава начинается сейчас — давайте оформим продление и продолжим прогресс.",
  finishedCta: "Продлить тренировки",
  resetSubject: "Сброс пароля",
  resetHero: "Сброс пароля",
  resetBody: "Мы получили запрос на сброс пароля вашей учётной записи Youssef Ahmed. Нажмите кнопку ниже, чтобы задать новый пароль.",
  resetCta: "Сбросить пароль",
  resetExpiry: "Ссылка действует 30 минут.",
  resetAltLink: "Или скопируйте эту ссылку в браузер:",
  resetDisclaimer: "Если вы этого не запрашивали, просто проигнорируйте письмо — пароль не изменится.",
};

const tr: Strings = {
  brandTagline: "Elit Koçluk • Dubai",
  greeting: "Merhaba {name},",
  signoff: "Yakında görüşmek üzere,",
  signoffName: "Koç Youssef Ahmed",
  questionsCta: "Sorun mu var? Koç Youssef'e doğrudan WhatsApp'tan yaz.",
  footerNote: "Youssef Ahmed | Elite Coaching tarafından otomatik gönderildi.",
  footerUnsubNote: "Bu e-postayı Youssef Ahmed | Elite Coaching'de aktif hesabınız olduğu için alıyorsunuz.",
  ctaDashboard: "Panelimi aç",
  ctaWhatsapp: "Koça WhatsApp'tan yaz",
  welcomeSubject: "Youssef Ahmed | Elite Coaching'e hoş geldin",
  welcomeHero: "Aramıza hoş geldin, {name}",
  welcomeBody: "Hesabın hazır. Buradan seans rezervasyonu yapabilir, InBody ilerlemeni takip edebilir ve antrenmanını tek yerden yönetebilirsin. Koç Youssef profilini bizzat inceleyip programını hedeflerine göre düzenleyecek.",
  welcomeFeatBookT: "İlk seansını rezerve et",
  welcomeFeatBookB: "Takvimden uygun bir saat seç — her seans 1 saattir.",
  welcomeFeatInbodyT: "InBody taramanı yükle",
  welcomeFeatInbodyB: "Başlangıç noktanı belirlemek ve ilerlemeni ölçmek için kullanırız.",
  welcomeFeatContactT: "Koçunla konuş",
  welcomeFeatContactB: "İstediğin zaman Youssef'e WhatsApp'tan yaz.",
  welcomeCtaBook: "Seans rezerve et",
  welcomeCtaInbody: "InBody yükle",
  welcomeCtaContact: "Koça yaz",
  welcomeRulesHeading: "Kısa hatırlatmalar",
  welcomeRule1: "Her seans 1 saattir.",
  welcomeRule2: "En az 6 saat önceden iptal veya yeniden planla.",
  welcomeRule3: "Geç iptaller kullanılmış seans sayılır.",
  bookingSubject: "Seans onaylandı — {date} {time}",
  bookingHero: "Seansın onaylandı",
  bookingBody: "Her şey hazır. Detaylar:",
  bookingDate: "Tarih",
  bookingTime: "Saat",
  bookingFocus: "Seans odağı",
  bookingGoal: "Antrenman hedefi",
  bookingType: "Seans türü",
  bookingLocation: "Konum",
  bookingLocationValue: "Koç onaylayacak",
  bookingPackage: "Paket",
  bookingRemaining: "Kalan seanslar",
  bookingExpires: "Paket bitiş tarihi",
  bookingRulesHeading: "Kısa hatırlatmalar",
  bookingRule1: "Her seans 1 saattir.",
  bookingRule2: "En az 6 saat önceden iptal veya yeniden planla.",
  bookingRule3: "Ek süre için önceden Koç ile anlaş.",
  reminder24Subject: "Yarın {time} — yakında görüşürüz",
  reminder24Hero: "Seansın yarın",
  reminder24Body: "Kısa hatırlatma: seansın yarına planlandı. İyi su iç, hafif beslen ve yanına su şişesi ile küçük bir havlu al.",
  reminder1Subject: "1 saate başlıyor — {time}",
  reminder1Hero: "1 saat kaldı",
  reminder1Body: "Seansın yaklaşık bir saate başlıyor. Salonda görüşürüz — verim alalım.",
  expiringSubject: "Paketin bitmek üzere",
  expiringHero: "Dikkat — paketin bitmek üzere",
  expiringBodyLow: "Paketinde {n} seans kaldı. Momentumunu kaybetme — şimdi yenile.",
  expiringBodyDays: "Paketinin {n} gün içinde süresi doluyor. Slotlarını kaybetmemek için şimdi yenile.",
  expiringCta: "Koç ile yenile",
  finishedSubject: "Paketin tamamlandı — devam zamanı",
  finishedHero: "Harikaydın, {name}",
  finishedBody: "Mevcut paketindeki tüm seansları tamamladın. Yeni bölüm şimdi başlıyor — yenilemeyi onaylayıp ilerlemeye devam edelim.",
  finishedCta: "Antrenmanımı yenile",
  resetSubject: "Şifreni sıfırla",
  resetHero: "Şifreni sıfırla",
  resetBody: "Youssef Ahmed hesabın için şifre sıfırlama isteği aldık. Yeni bir şifre belirlemek için aşağıdaki butona dokun.",
  resetCta: "Şifreyi sıfırla",
  resetExpiry: "Bu bağlantı 30 dakika içinde geçerliliğini yitirir.",
  resetAltLink: "Veya bu bağlantıyı tarayıcına yapıştır:",
  resetDisclaimer: "Bu isteği sen yapmadıysan e-postayı yok sayabilirsin — şifren değişmeyecek.",
};

const zh: Strings = {
  brandTagline: "精英教练 • 迪拜",
  greeting: "您好 {name}，",
  signoff: "期待与您见面，",
  signoffName: "教练 Youssef Ahmed",
  questionsCta: "有任何问题？请直接在 WhatsApp 联系 Youssef 教练。",
  footerNote: "由 Youssef Ahmed | Elite Coaching 自动发送。",
  footerUnsubNote: "您收到此邮件是因为您在 Youssef Ahmed | Elite Coaching 拥有有效账户。",
  ctaDashboard: "打开我的面板",
  ctaWhatsapp: "WhatsApp 联系教练",
  welcomeSubject: "欢迎加入 Youssef Ahmed | Elite Coaching",
  welcomeHero: "欢迎加入，{name}",
  welcomeBody: "您的账户已准备就绪。您可以在这里预约课程、查看 InBody 进度，并在一个平台上管理训练。Youssef 教练将亲自审阅您的资料，并根据您的目标定制方案。",
  welcomeFeatBookT: "预约您的第一节课",
  welcomeFeatBookB: "在日历中选择空闲时段 — 每节课 1 小时。",
  welcomeFeatInbodyT: "上传 InBody 扫描",
  welcomeFeatInbodyB: "我们用它确定起点并衡量进步。",
  welcomeFeatContactT: "联系您的教练",
  welcomeFeatContactB: "随时通过 WhatsApp 联系 Youssef。",
  welcomeCtaBook: "预约课程",
  welcomeCtaInbody: "上传 InBody",
  welcomeCtaContact: "联系教练",
  welcomeRulesHeading: "温馨提示",
  welcomeRule1: "每节课时长 1 小时。",
  welcomeRule2: "请至少提前 6 小时取消或改期。",
  welcomeRule3: "迟到取消将计为已使用课时。",
  bookingSubject: "预约已确认 — {date} {time}",
  bookingHero: "您的课程已确认",
  bookingBody: "一切就绪。详情如下：",
  bookingDate: "日期",
  bookingTime: "时间",
  bookingFocus: "训练重点",
  bookingGoal: "训练目标",
  bookingType: "课程类型",
  bookingLocation: "地点",
  bookingLocationValue: "由教练确认",
  bookingPackage: "课程包",
  bookingRemaining: "剩余课时",
  bookingExpires: "课程包到期日",
  bookingRulesHeading: "温馨提示",
  bookingRule1: "每节课 1 小时。",
  bookingRule2: "请至少提前 6 小时取消或改期。",
  bookingRule3: "如需延长时间请提前与教练协商。",
  reminder24Subject: "明天 {time} — 期待见面",
  reminder24Hero: "您的课程在明天",
  reminder24Body: "温馨提醒：您的训练课程定于明天。请充分补水，提前轻食，并带上水壶和小毛巾。",
  reminder1Subject: "1 小时后开始 — {time}",
  reminder1Hero: "还有 1 小时",
  reminder1Body: "您的课程大约 1 小时后开始。健身房见 — 我们一起冲刺。",
  expiringSubject: "您的课程包即将用完",
  expiringHero: "提示 — 您的课程包即将用完",
  expiringBodyLow: "您当前课程包还剩 {n} 节。立即续费，保持训练势头。",
  expiringBodyDays: "您的课程包将于 {n} 天后到期。立即续费，保留您的时段。",
  expiringCta: "与教练续费",
  finishedSubject: "课程包已完成 — 继续前进",
  finishedHero: "出色的努力，{name}",
  finishedBody: "您已完成当前课程包的所有课时。新阶段现在开始 — 让我们确认续费，让进步持续。",
  finishedCta: "续费我的训练",
  resetSubject: "重置您的密码",
  resetHero: "重置您的密码",
  resetBody: "我们收到了重置您 Youssef Ahmed 账户密码的请求。请点击下方按钮设置新密码。",
  resetCta: "重置密码",
  resetExpiry: "此链接将在 30 分钟后失效。",
  resetAltLink: "或将此链接粘贴到浏览器：",
  resetDisclaimer: "如果不是您本人发起，请忽略此邮件 — 您的密码不会变化。",
};

const hi: Strings = {
  brandTagline: "एलीट कोचिंग • दुबई",
  greeting: "नमस्ते {name},",
  signoff: "जल्द ही मिलते हैं,",
  signoffName: "कोच Youssef Ahmed",
  questionsCta: "कोई सवाल है? कोच Youssef को सीधे WhatsApp पर मैसेज करें।",
  footerNote: "Youssef Ahmed | Elite Coaching द्वारा स्वचालित रूप से भेजा गया।",
  footerUnsubNote: "आपको यह ईमेल इसलिए मिल रही है क्योंकि आपका Youssef Ahmed | Elite Coaching में सक्रिय खाता है।",
  ctaDashboard: "मेरा डैशबोर्ड खोलें",
  ctaWhatsapp: "कोच को WhatsApp पर मैसेज करें",
  welcomeSubject: "Youssef Ahmed | Elite Coaching में आपका स्वागत है",
  welcomeHero: "स्वागत है, {name}",
  welcomeBody: "आपका खाता तैयार है। यहाँ से आप सेशन बुक कर सकते हैं, InBody प्रगति देख सकते हैं, और एक ही जगह से ट्रेनिंग मैनेज कर सकते हैं। कोच Youssef आपकी प्रोफाइल खुद रिव्यू करेंगे और प्रोग्राम आपके लक्ष्यों के अनुसार बनाएंगे।",
  welcomeFeatBookT: "अपना पहला सेशन बुक करें",
  welcomeFeatBookB: "कैलेंडर से कोई भी खुला स्लॉट चुनें — हर सेशन 1 घंटे का है।",
  welcomeFeatInbodyT: "अपना InBody स्कैन अपलोड करें",
  welcomeFeatInbodyB: "हम इसका उपयोग आपके शुरुआती बिंदु और प्रगति को मापने के लिए करते हैं।",
  welcomeFeatContactT: "अपने कोच से बात करें",
  welcomeFeatContactB: "Youssef को कभी भी WhatsApp पर मैसेज करें।",
  welcomeCtaBook: "सेशन बुक करें",
  welcomeCtaInbody: "InBody अपलोड करें",
  welcomeCtaContact: "कोच से संपर्क",
  welcomeRulesHeading: "ज़रूरी रिमाइंडर",
  welcomeRule1: "हर सेशन 1 घंटे का है।",
  welcomeRule2: "कम से कम 6 घंटे पहले कैंसल या रीशेड्यूल करें।",
  welcomeRule3: "देर से कैंसल करना उपयोग किए गए सेशन के रूप में गिना जाएगा।",
  bookingSubject: "सेशन कन्फर्म — {date} {time}",
  bookingHero: "आपका सेशन कन्फर्म है",
  bookingBody: "सब तैयार है। यह रहीं डिटेल्स:",
  bookingDate: "दिनांक",
  bookingTime: "समय",
  bookingFocus: "सेशन फोकस",
  bookingGoal: "ट्रेनिंग गोल",
  bookingType: "सेशन प्रकार",
  bookingLocation: "स्थान",
  bookingLocationValue: "कोच द्वारा कन्फर्म किया जाएगा",
  bookingPackage: "पैकेज",
  bookingRemaining: "बचे सेशन",
  bookingExpires: "पैकेज समाप्ति",
  bookingRulesHeading: "ज़रूरी रिमाइंडर",
  bookingRule1: "हर सेशन 1 घंटे का है।",
  bookingRule2: "कम से कम 6 घंटे पहले कैंसल या रीशेड्यूल करें।",
  bookingRule3: "अतिरिक्त समय के लिए कोच से पहले से सहमति लें।",
  reminder24Subject: "कल {time} — जल्द मिलते हैं",
  reminder24Hero: "आपका सेशन कल है",
  reminder24Body: "त्वरित रिमाइंडर: आपका ट्रेनिंग सेशन कल के लिए तय है। अच्छी तरह हाइड्रेट करें, पहले हल्का खाएं, और पानी की बोतल व छोटा तौलिया साथ लाएं।",
  reminder1Subject: "1 घंटे में शुरू — {time}",
  reminder1Hero: "1 घंटा बाकी",
  reminder1Body: "आपका सेशन लगभग 1 घंटे में शुरू होगा। जिम में मिलते हैं — पूरी ताकत लगाएंगे।",
  expiringSubject: "आपका पैकेज खत्म होने वाला है",
  expiringHero: "ध्यान दें — आपका पैकेज खत्म होने वाला है",
  expiringBodyLow: "आपके मौजूदा पैकेज में {n} सेशन बचे हैं। अभी रिन्यू करें ताकि गति न टूटे।",
  expiringBodyDays: "आपका पैकेज {n} दिन में समाप्त हो रहा है। अभी रिन्यू करें और अपने स्लॉट बनाए रखें।",
  expiringCta: "कोच के साथ रिन्यू करें",
  finishedSubject: "पैकेज पूरा — आगे बढ़ने का समय",
  finishedHero: "शानदार काम, {name}",
  finishedBody: "आपने अपने मौजूदा पैकेज के सभी सेशन पूरे कर लिए। अगला अध्याय अब शुरू होता है — रिन्यूअल कन्फर्म करें और प्रगति जारी रखें।",
  finishedCta: "मेरी ट्रेनिंग रिन्यू करें",
  resetSubject: "अपना पासवर्ड रीसेट करें",
  resetHero: "अपना पासवर्ड रीसेट करें",
  resetBody: "हमें आपके Youssef Ahmed खाते का पासवर्ड रीसेट करने का अनुरोध मिला है। नया पासवर्ड सेट करने के लिए नीचे बटन दबाएं।",
  resetCta: "पासवर्ड रीसेट करें",
  resetExpiry: "यह लिंक 30 मिनट में समाप्त हो जाएगा।",
  resetAltLink: "या यह लिंक अपने ब्राउज़र में पेस्ट करें:",
  resetDisclaimer: "यदि आपने अनुरोध नहीं किया, तो इस ईमेल को सुरक्षित रूप से अनदेखा करें — पासवर्ड नहीं बदलेगा।",
};

const ur: Strings = {
  brandTagline: "ایلیٹ کوچنگ • دبئی",
  greeting: "السلام علیکم {name}،",
  signoff: "جلد ملاقات کے انتظار میں،",
  signoffName: "کوچ یوسف احمد",
  questionsCta: "کوئی سوال ہے؟ کوچ یوسف کو براہِ راست واٹس ایپ پر پیغام بھیجیں۔",
  footerNote: "Youssef Ahmed | Elite Coaching کی طرف سے خودکار طور پر بھیجا گیا۔",
  footerUnsubNote: "آپ کو یہ ای میل اس لیے موصول ہو رہی ہے کیونکہ Youssef Ahmed | Elite Coaching میں آپ کا فعال اکاؤنٹ ہے۔",
  ctaDashboard: "میرا ڈیش بورڈ کھولیں",
  ctaWhatsapp: "کوچ کو واٹس ایپ پر پیغام دیں",
  welcomeSubject: "Youssef Ahmed | Elite Coaching میں خوش آمدید",
  welcomeHero: "خوش آمدید، {name}",
  welcomeBody: "آپ کا اکاؤنٹ تیار ہے۔ یہاں سے آپ سیشن بک کر سکتے ہیں، اپنی InBody پیشرفت دیکھ سکتے ہیں، اور ایک ہی جگہ سے اپنی تربیت کا انتظام کر سکتے ہیں۔ کوچ یوسف ذاتی طور پر آپ کی پروفائل کا جائزہ لیں گے اور آپ کے اہداف کے مطابق پروگرام ترتیب دیں گے۔",
  welcomeFeatBookT: "اپنا پہلا سیشن بک کریں",
  welcomeFeatBookB: "کیلنڈر سے کوئی بھی خالی وقت چنیں — ہر سیشن 1 گھنٹے کا ہے۔",
  welcomeFeatInbodyT: "اپنی InBody رپورٹ اپلوڈ کریں",
  welcomeFeatInbodyB: "ہم اسے آپ کے آغاز اور پیشرفت کی پیمائش کے لیے استعمال کرتے ہیں۔",
  welcomeFeatContactT: "اپنے کوچ سے بات کریں",
  welcomeFeatContactB: "یوسف کو کسی بھی وقت واٹس ایپ پر پیغام بھیجیں۔",
  welcomeCtaBook: "سیشن بک کریں",
  welcomeCtaInbody: "InBody اپلوڈ کریں",
  welcomeCtaContact: "کوچ سے رابطہ",
  welcomeRulesHeading: "اہم یاد دہانیاں",
  welcomeRule1: "ہر سیشن 1 گھنٹے کا ہے۔",
  welcomeRule2: "کم از کم 6 گھنٹے پہلے منسوخ یا دوبارہ شیڈول کریں۔",
  welcomeRule3: "تاخیر سے منسوخی استعمال شدہ سیشن کے طور پر شمار ہوگی۔",
  bookingSubject: "سیشن کنفرم — {date} {time}",
  bookingHero: "آپ کا سیشن کنفرم ہے",
  bookingBody: "سب کچھ تیار ہے۔ تفصیلات یہ ہیں:",
  bookingDate: "تاریخ",
  bookingTime: "وقت",
  bookingFocus: "سیشن فوکس",
  bookingGoal: "تربیتی مقصد",
  bookingType: "سیشن کی قسم",
  bookingLocation: "مقام",
  bookingLocationValue: "کوچ کی طرف سے تصدیق کی جائے گی",
  bookingPackage: "پیکیج",
  bookingRemaining: "بقیہ سیشن",
  bookingExpires: "پیکیج کی میعاد",
  bookingRulesHeading: "اہم یاد دہانیاں",
  bookingRule1: "ہر سیشن 1 گھنٹے کا ہے۔",
  bookingRule2: "کم از کم 6 گھنٹے پہلے منسوخ یا دوبارہ شیڈول کریں۔",
  bookingRule3: "اضافی وقت کے لیے کوچ سے پہلے سے اتفاق کریں۔",
  reminder24Subject: "کل {time} — جلد ملاقات",
  reminder24Hero: "آپ کا سیشن کل ہے",
  reminder24Body: "تیز یاد دہانی: آپ کا سیشن کل کے لیے شیڈول ہے۔ اچھی طرح پانی پئیں، پہلے ہلکا کھائیں، اور پانی کی بوتل اور چھوٹا تولیہ ساتھ لائیں۔",
  reminder1Subject: "1 گھنٹے میں شروع — {time}",
  reminder1Hero: "1 گھنٹہ باقی",
  reminder1Body: "آپ کا سیشن تقریباً ایک گھنٹے میں شروع ہوگا۔ جم میں ملتے ہیں — بھرپور محنت کریں گے۔",
  expiringSubject: "آپ کا پیکیج ختم ہونے والا ہے",
  expiringHero: "خبردار — آپ کا پیکیج ختم ہونے والا ہے",
  expiringBodyLow: "آپ کے موجودہ پیکیج میں {n} سیشن باقی ہیں۔ اپنی رفتار برقرار رکھنے کے لیے ابھی تجدید کریں۔",
  expiringBodyDays: "آپ کا پیکیج {n} دن میں ختم ہو رہا ہے۔ اپنے سلاٹ محفوظ رکھنے کے لیے ابھی تجدید کریں۔",
  expiringCta: "کوچ کے ساتھ تجدید کریں",
  finishedSubject: "پیکیج مکمل — اگلا قدم اٹھائیں",
  finishedHero: "زبردست کام، {name}",
  finishedBody: "آپ نے اپنے موجودہ پیکیج کے تمام سیشن مکمل کر لیے۔ اگلا باب اب شروع ہوتا ہے — تجدید کی تصدیق کریں اور پیشرفت جاری رکھیں۔",
  finishedCta: "میری تربیت کی تجدید کریں",
  resetSubject: "اپنا پاس ورڈ ری سیٹ کریں",
  resetHero: "اپنا پاس ورڈ ری سیٹ کریں",
  resetBody: "ہمیں آپ کے Youssef Ahmed اکاؤنٹ کے پاس ورڈ کو ری سیٹ کرنے کی درخواست موصول ہوئی ہے۔ نیا پاس ورڈ سیٹ کرنے کے لیے نیچے بٹن دبائیں۔",
  resetCta: "پاس ورڈ ری سیٹ کریں",
  resetExpiry: "یہ لنک 30 منٹ میں ختم ہو جائے گا۔",
  resetAltLink: "یا یہ لنک اپنے براؤزر میں چسپاں کریں:",
  resetDisclaimer: "اگر آپ نے درخواست نہیں کی، تو اس ای میل کو نظر انداز کریں — آپ کا پاس ورڈ تبدیل نہیں ہوگا۔",
};

const pt: Strings = {
  brandTagline: "Coaching de elite • Dubai",
  greeting: "Olá {name},",
  signoff: "Até breve,",
  signoffName: "Coach Youssef Ahmed",
  questionsCta: "Tem alguma pergunta? Fale diretamente com o Coach Youssef pelo WhatsApp.",
  footerNote: "Enviado automaticamente por Youssef Ahmed | Elite Coaching.",
  footerUnsubNote: "Você recebeu este email porque tem uma conta ativa na Youssef Ahmed | Elite Coaching.",
  ctaDashboard: "Abrir meu painel",
  ctaWhatsapp: "Falar com o coach no WhatsApp",
  welcomeSubject: "Bem-vindo à Youssef Ahmed | Elite Coaching",
  welcomeHero: "Bem-vindo a bordo, {name}",
  welcomeBody: "Sua conta está pronta. Aqui você pode marcar sessões, acompanhar seu progresso InBody e gerenciar todo o treino em um único lugar. O Coach Youssef vai analisar seu perfil pessoalmente e ajustar o programa aos seus objetivos.",
  welcomeFeatBookT: "Marque sua primeira sessão",
  welcomeFeatBookB: "Escolha um horário disponível — cada sessão dura 1 hora.",
  welcomeFeatInbodyT: "Envie seu exame InBody",
  welcomeFeatInbodyB: "Usamos para definir seu ponto de partida e medir progresso.",
  welcomeFeatContactT: "Fale com seu coach",
  welcomeFeatContactB: "Mande mensagem ao Youssef no WhatsApp quando quiser.",
  welcomeCtaBook: "Marcar sessão",
  welcomeCtaInbody: "Enviar InBody",
  welcomeCtaContact: "Contatar coach",
  welcomeRulesHeading: "Lembretes rápidos",
  welcomeRule1: "Cada sessão dura 1 hora.",
  welcomeRule2: "Cancele ou reagende com pelo menos 6 horas de antecedência.",
  welcomeRule3: "Cancelamentos tardios contam como sessão usada.",
  bookingSubject: "Sessão confirmada — {date} às {time}",
  bookingHero: "Sua sessão está confirmada",
  bookingBody: "Tudo pronto. Aqui estão seus detalhes:",
  bookingDate: "Data",
  bookingTime: "Hora",
  bookingFocus: "Foco da sessão",
  bookingGoal: "Objetivo",
  bookingType: "Tipo de sessão",
  bookingLocation: "Local",
  bookingLocationValue: "A confirmar pelo coach",
  bookingPackage: "Pacote",
  bookingRemaining: "Sessões restantes",
  bookingExpires: "Vencimento do pacote",
  bookingRulesHeading: "Lembretes rápidos",
  bookingRule1: "Cada sessão dura 1 hora.",
  bookingRule2: "Cancele ou reagende com pelo menos 6 horas de antecedência.",
  bookingRule3: "Tempo extra deve ser combinado previamente com o coach.",
  reminder24Subject: "Amanhã às {time} — até breve",
  reminder24Hero: "Sua sessão é amanhã",
  reminder24Body: "Lembrete rápido: sua sessão de treino está marcada para amanhã. Hidrate-se bem, coma leve antes, e leve uma garrafa de água e uma toalha pequena.",
  reminder1Subject: "Começa em 1 hora — {time}",
  reminder1Hero: "Falta 1 hora",
  reminder1Body: "Sua sessão começa em cerca de uma hora. Te vejo no salão — vamos com tudo.",
  expiringSubject: "Seu pacote está acabando",
  expiringHero: "Atenção — seu pacote está acabando",
  expiringBodyLow: "Você tem {n} sessões restantes no pacote atual. Renove agora para manter o ritmo.",
  expiringBodyDays: "Seu pacote vence em {n} dias. Renove agora para manter seus horários.",
  expiringCta: "Renovar com o coach",
  finishedSubject: "Pacote completo — hora de continuar",
  finishedHero: "Trabalho incrível, {name}",
  finishedBody: "Você completou todas as sessões do pacote atual. O próximo capítulo começa agora — vamos confirmar a renovação e seguir progredindo.",
  finishedCta: "Renovar meu treino",
  resetSubject: "Redefinir sua senha",
  resetHero: "Redefinir sua senha",
  resetBody: "Recebemos um pedido para redefinir a senha da sua conta Youssef Ahmed. Toque no botão abaixo para definir uma nova.",
  resetCta: "Redefinir senha",
  resetExpiry: "Este link expira em 30 minutos.",
  resetAltLink: "Ou cole este link no seu navegador:",
  resetDisclaimer: "Se você não solicitou, ignore este email — sua senha não será alterada.",
};

const it: Strings = {
  brandTagline: "Elite coaching • Dubai",
  greeting: "Ciao {name},",
  signoff: "A presto,",
  signoffName: "Coach Youssef Ahmed",
  questionsCta: "Hai una domanda? Scrivi direttamente al Coach Youssef su WhatsApp.",
  footerNote: "Inviato automaticamente da Youssef Ahmed | Elite Coaching.",
  footerUnsubNote: "Ricevi questa email perché hai un account attivo su Youssef Ahmed | Elite Coaching.",
  ctaDashboard: "Apri la mia dashboard",
  ctaWhatsapp: "Scrivi al coach su WhatsApp",
  welcomeSubject: "Benvenuto in Youssef Ahmed | Elite Coaching",
  welcomeHero: "Benvenuto a bordo, {name}",
  welcomeBody: "Il tuo account è pronto. Da qui puoi prenotare sessioni, monitorare il progresso InBody e gestire tutto in un unico posto. Coach Youssef esaminerà personalmente il tuo profilo e adatterà il programma ai tuoi obiettivi.",
  welcomeFeatBookT: "Prenota la prima sessione",
  welcomeFeatBookB: "Scegli un orario libero — ogni sessione dura 1 ora.",
  welcomeFeatInbodyT: "Carica la tua scansione InBody",
  welcomeFeatInbodyB: "La usiamo per fissare il punto di partenza e misurare i progressi.",
  welcomeFeatContactT: "Parla con il tuo coach",
  welcomeFeatContactB: "Scrivi a Youssef su WhatsApp quando vuoi.",
  welcomeCtaBook: "Prenota una sessione",
  welcomeCtaInbody: "Carica InBody",
  welcomeCtaContact: "Contatta il coach",
  welcomeRulesHeading: "Promemoria rapidi",
  welcomeRule1: "Ogni sessione dura 1 ora.",
  welcomeRule2: "Cancella o riprogramma almeno 6 ore prima.",
  welcomeRule3: "Le cancellazioni tardive contano come sessione usata.",
  bookingSubject: "Sessione confermata — {date} alle {time}",
  bookingHero: "La tua sessione è confermata",
  bookingBody: "Tutto pronto. Ecco i dettagli:",
  bookingDate: "Data",
  bookingTime: "Ora",
  bookingFocus: "Focus della sessione",
  bookingGoal: "Obiettivo",
  bookingType: "Tipo di sessione",
  bookingLocation: "Luogo",
  bookingLocationValue: "Da confermare dal coach",
  bookingPackage: "Pacchetto",
  bookingRemaining: "Sessioni rimanenti",
  bookingExpires: "Scadenza pacchetto",
  bookingRulesHeading: "Promemoria rapidi",
  bookingRule1: "Ogni sessione dura 1 ora.",
  bookingRule2: "Cancella o riprogramma almeno 6 ore prima.",
  bookingRule3: "Il tempo extra va concordato in anticipo con il coach.",
  reminder24Subject: "Domani alle {time} — a presto",
  reminder24Hero: "La tua sessione è domani",
  reminder24Body: "Promemoria rapido: la sessione è in programma per domani. Idratati bene, mangia leggero prima, e porta una bottiglia d'acqua e un asciugamano piccolo.",
  reminder1Subject: "Inizia tra 1 ora — {time}",
  reminder1Hero: "Manca 1 ora",
  reminder1Body: "La tua sessione inizia tra circa un'ora. Ci vediamo in sala — diamo il massimo.",
  expiringSubject: "Il tuo pacchetto sta finendo",
  expiringHero: "Attenzione — il tuo pacchetto sta finendo",
  expiringBodyLow: "Ti restano {n} sessioni sul pacchetto attuale. Rinnova ora per non perdere lo slancio.",
  expiringBodyDays: "Il tuo pacchetto scade tra {n} giorni. Rinnova ora per mantenere i tuoi slot.",
  expiringCta: "Rinnova col coach",
  finishedSubject: "Pacchetto completato — è il momento di ripartire",
  finishedHero: "Lavoro fantastico, {name}",
  finishedBody: "Hai completato tutte le sessioni del pacchetto. Il prossimo capitolo inizia ora — confermiamo il rinnovo e continuiamo a progredire.",
  finishedCta: "Rinnova il mio training",
  resetSubject: "Reimposta la password",
  resetHero: "Reimposta la password",
  resetBody: "Abbiamo ricevuto una richiesta di reimpostazione della password del tuo account Youssef Ahmed. Tocca il pulsante per impostarne una nuova.",
  resetCta: "Reimposta password",
  resetExpiry: "Questo link scade tra 30 minuti.",
  resetAltLink: "Oppure incolla questo link nel browser:",
  resetDisclaimer: "Se non sei stato tu a richiederlo, ignora pure questa email — la password non verrà modificata.",
};

const STRINGS: Record<EmailLang, Strings> = { en, ar, fr, de, es, ru, tr, zh, hi, ur, pt, it };

export function t(lang: string | null | undefined, key: keyof Strings): string {
  const code = normalizeLang(lang);
  return STRINGS[code][key] ?? STRINGS.en[key];
}

function fill(s: string, vars: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : ""));
}

// ---------------------------------------------------------------------------
// HTML primitives — Outlook-safe (table-based, inline styles)
// ---------------------------------------------------------------------------

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Premium dark-luxury email shell.
 * Wraps body content in a branded table-based layout that renders consistently
 * across Gmail / Outlook / Apple Mail / Android. RTL-aware via `dir`.
 */
export function shellHtml(opts: {
  lang: string | null | undefined;
  previewText: string;
  bodyHtml: string;
  websiteUrl?: string;
}): string {
  const lang = normalizeLang(opts.lang);
  const dir = isRtl(lang) ? "rtl" : "ltr";
  const align = dir === "rtl" ? "right" : "left";
  const website = opts.websiteUrl || BRAND.defaultWebsite;
  const wa = `https://wa.me/${BRAND.whatsapp.replace(/[^0-9]/g, "")}`;

  return `<!doctype html>
<html lang="${lang}" dir="${dir}" style="margin:0;padding:0">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light">
<meta name="supported-color-schemes" content="dark light">
<title>${escapeHtml(BRAND.name)}</title>
<!--[if mso]><style>* { font-family: Arial, Helvetica, sans-serif !important; }</style><![endif]-->
<style>
  /* Mobile polish — collapses card padding, scales hero type, stacks
     metric tiles and CTA to full-width. Honoured by Gmail iOS/Android,
     Apple Mail, Outlook mobile. Desktop clients ignore. */
  @media only screen and (max-width: 480px) {
    .px-shell { padding: 24px 12px !important; }
    .px-card { border-radius: 14px !important; }
    .px-body { padding: 22px 18px !important; font-size: 14.5px !important; line-height: 1.6 !important; }
    .px-header { padding: 22px 18px 16px !important; }
    .px-footer { padding: 16px 18px 20px !important; }
    .px-hero-title { font-size: 24px !important; line-height: 1.18 !important; }
    .px-hero-eyebrow { font-size: 10px !important; letter-spacing: 2px !important; }
    .px-info-row td { padding: 10px 12px !important; font-size: 13px !important; }
    .px-button-cell { padding: 14px 22px !important; font-size: 13px !important; letter-spacing: 1px !important; }
    .px-metric-tile { display: block !important; width: 100% !important; margin: 0 0 8px !important; }
    .px-stack { display: block !important; width: 100% !important; }
  }
  /* Dark-mode hint for clients that honour it (Apple Mail, Outlook.com). */
  @media (prefers-color-scheme: dark) {
    .px-card { background: ${COLOR.bgCard} !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${COLOR.bgOuter};color:${COLOR.text};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased">
<!-- Hidden preview (snippet shown by Gmail/Apple Mail in inbox list) -->
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;color:transparent;line-height:0;font-size:1px;opacity:0">${escapeHtml(opts.previewText)}</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="px-shell" style="background:${COLOR.bgOuter};padding:32px 16px" dir="${dir}">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" class="px-card" style="max-width:600px;width:100%;background:${COLOR.bgCard};border:1px solid ${COLOR.borderCyan};border-radius:18px;overflow:hidden;box-shadow:0 0 0 1px ${COLOR.primaryDeep}, 0 18px 60px -20px ${COLOR.primaryGlow}">

        <!-- TRON top edge — luminous cyan strip + thin reflection line -->
        <tr>
          <td style="background:linear-gradient(90deg, ${COLOR.bgCard} 0%, ${COLOR.primary} 30%, ${COLOR.primary} 70%, ${COLOR.bgCard} 100%);height:2px;line-height:2px;font-size:0">&nbsp;</td>
        </tr>
        <tr>
          <td style="background:${COLOR.bgCard};height:1px;line-height:1px;font-size:0">&nbsp;</td>
        </tr>
        <tr>
          <td style="background:linear-gradient(90deg, ${COLOR.bgCard} 0%, ${COLOR.primaryGlow} 50%, ${COLOR.bgCard} 100%);height:1px;line-height:1px;font-size:0">&nbsp;</td>
        </tr>

        <!-- Header: brand name + tagline + monogram -->
        <tr>
          <td align="${align}" class="px-header" style="padding:30px 32px 22px;background:linear-gradient(180deg, ${COLOR.bgCard} 0%, ${COLOR.bgCardSoft} 100%);border-bottom:1px solid ${COLOR.borderCyan}">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="${align}" style="vertical-align:middle">
                  <div style="font-family:'Times New Roman',Georgia,serif;font-size:24px;font-weight:700;letter-spacing:1.2px;color:${COLOR.text};line-height:1.1;text-transform:uppercase">
                    ${escapeHtml(BRAND.name)}
                  </div>
                  <div style="margin-top:8px;font-size:10.5px;letter-spacing:3px;text-transform:uppercase;color:${COLOR.primary};font-weight:700">
                    ${escapeHtml(t(lang, "brandTagline"))}
                  </div>
                  <div style="margin-top:14px;height:1px;background:linear-gradient(90deg, ${COLOR.primary} 0%, ${COLOR.primaryDeep} 100%);line-height:1px;font-size:0;width:48px">&nbsp;</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body content -->
        <tr>
          <td align="${align}" class="px-body" style="padding:32px;color:${COLOR.text};font-size:15px;line-height:1.65" dir="${dir}">
            ${opts.bodyHtml}
          </td>
        </tr>

        <!-- Premium signature block -->
        <tr>
          <td class="px-signature" style="padding:0 32px 28px;background:${COLOR.bgCard}">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:18px 0 0;border-top:1px solid ${COLOR.border}">
                  <div style="height:1px;width:36px;background:linear-gradient(90deg, ${COLOR.primary} 0%, ${COLOR.primaryDeep} 100%);line-height:1px;font-size:0;${align === "right" ? "margin-left:auto" : ""}">&nbsp;</div>
                </td>
              </tr>
              <tr>
                <td align="${align}" style="padding:14px 0 0" dir="${dir}">
                  <div style="font-family:'Times New Roman',Georgia,serif;font-size:18px;font-weight:700;color:${COLOR.text};letter-spacing:0.4px;line-height:1.2">
                    Youssef Ahmed
                  </div>
                  <div style="margin-top:5px;font-size:10px;letter-spacing:2.6px;text-transform:uppercase;color:${COLOR.primary};font-weight:700">
                    Elite Coaching &nbsp;·&nbsp; Dubai
                  </div>
                  <div style="margin-top:12px;font-size:12.5px;color:${COLOR.textMuted};line-height:1.7">
                    <a href="mailto:youssef.physical@gmail.com" style="color:${COLOR.textMuted};text-decoration:none">youssef.physical@gmail.com</a>
                    &nbsp;<span style="color:${COLOR.borderGlow}">|</span>&nbsp;
                    <a href="${wa}" style="color:${COLOR.textMuted};text-decoration:none">WhatsApp +971 50 539 4754</a>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td class="px-footer" style="padding:20px 32px 24px;border-top:1px solid ${COLOR.border};background:${COLOR.bgCardSoft}">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="${align}" style="font-size:12px;color:${COLOR.textMuted};line-height:1.6" dir="${dir}">
                  <div style="margin-bottom:6px">
                    <a href="${escapeHtml(website)}" style="color:${COLOR.primary};text-decoration:none;font-weight:600">${escapeHtml(BRAND.name)}</a>
                    &nbsp;•&nbsp;
                    <a href="${wa}" style="color:${COLOR.textMuted};text-decoration:none">WhatsApp</a>
                  </div>
                  <div style="font-size:11px;color:${COLOR.textDim};line-height:1.55">
                    ${escapeHtml(t(lang, "footerNote"))}<br>
                    ${escapeHtml(t(lang, "footerUnsubNote"))}
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

/**
 * Premium glow CTA button (table-based for Outlook).
 * Use sparingly — one primary CTA per email.
 */
export function buttonHtml(opts: {
  href: string;
  label: string;
  variant?: "primary" | "secondary";
}): string {
  const isSecondary = opts.variant === "secondary";
  const bg = isSecondary ? COLOR.bgCardElev : COLOR.primary;
  const color = isSecondary ? COLOR.primary : "#06121f";
  const border = isSecondary
    ? `1px solid ${COLOR.borderCyan}`
    : `1px solid ${COLOR.primary}`;
  // Layered Tron-glow shadow — outer halo + tight inner ring. Email clients
  // ignore this; modern web-mail clients (Apple Mail, Gmail web on dark mode)
  // honour it for the cinematic glow effect.
  const shadow = isSecondary
    ? `0 0 0 1px ${COLOR.primaryDeep}`
    : `0 0 0 1px ${COLOR.primary}, 0 0 28px -4px ${COLOR.primary}, 0 0 60px -12px ${COLOR.primaryGlow}`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0">
    <tr><td style="border-radius:14px;background:${bg};box-shadow:${shadow}">
      <a href="${escapeHtml(opts.href)}" style="display:inline-block;padding:14px 30px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:${color};text-decoration:none;border-radius:14px;border:${border}">${escapeHtml(opts.label)}</a>
    </td></tr>
  </table>`;
}

/**
 * Hero block — large title + body intro.
 */
export function heroHtml(opts: {
  title: string;
  body?: string;
  align?: "left" | "right" | "center";
  eyebrow?: string;
}): string {
  const align = opts.align || "left";
  const accentLine = `<div style="margin:0 0 14px;height:1px;width:42px;background:linear-gradient(90deg, ${COLOR.primary} 0%, ${COLOR.primaryDeep} 100%);line-height:1px;font-size:0;${align === "right" ? "margin-left:auto" : align === "center" ? "margin-left:auto;margin-right:auto" : ""}">&nbsp;</div>`;
  const eyebrow = opts.eyebrow
    ? `<div style="margin:0 0 6px;font-size:10.5px;letter-spacing:2.5px;text-transform:uppercase;color:${COLOR.primary};font-weight:700">${escapeHtml(opts.eyebrow)}</div>`
    : "";
  return `<div style="margin:0 0 26px;text-align:${align}">
    ${eyebrow}
    ${accentLine}
    <h1 style="margin:0 0 14px;font-family:'Times New Roman',Georgia,serif;font-size:30px;line-height:1.15;font-weight:700;color:${COLOR.text};letter-spacing:-0.4px">${escapeHtml(opts.title)}</h1>
    ${opts.body ? `<p style="margin:0;font-size:15.5px;line-height:1.7;color:${COLOR.textMuted}">${escapeHtml(opts.body)}</p>` : ""}
  </div>`;
}

/**
 * Detail card — premium info table inside a glass-style panel.
 */
export function infoCardHtml(opts: {
  rows: Array<[string, string | number | null | undefined]>;
  align?: "left" | "right";
}): string {
  const filled = opts.rows.filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (filled.length === 0) return "";
  const align = opts.align || "left";
  const rows = filled
    .map(
      ([k, v], i) => {
        const isLast = i === filled.length - 1;
        const borderStyle = isLast ? "" : `border-bottom:1px solid ${COLOR.border};`;
        return `<tr>
        <td style="padding:13px 0;color:${COLOR.textMuted};font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;vertical-align:top;text-align:${align};${borderStyle}width:42%">${escapeHtml(k)}</td>
        <td style="padding:13px 0;color:${COLOR.text};font-size:14.5px;font-weight:600;text-align:${align === "left" ? "right" : "left"};${borderStyle}">${escapeHtml(String(v))}</td>
      </tr>`;
      },
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 26px;background:${COLOR.bgCardSoft};border:1px solid ${COLOR.borderCyan};border-radius:14px;padding:6px 20px;box-shadow:inset 0 0 0 1px ${COLOR.primaryDeep}">
    <tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table></td></tr>
  </table>`;
}

/**
 * Reminder list — bulleted glass panel.
 */
export function rulesHtml(opts: { heading: string; items: string[]; align?: "left" | "right" }): string {
  const align = opts.align || "left";
  const padSide = align === "right" ? "padding-right" : "padding-left";
  const items = opts.items
    .map(
      (it) =>
        `<li style="margin:6px 0;font-size:13.5px;color:${COLOR.textMuted};line-height:1.55">${escapeHtml(it)}</li>`,
    )
    .join("");
  return `<div style="margin:8px 0 24px;padding:16px 18px;background:${COLOR.bgCardSoft};border:1px solid ${COLOR.border};border-radius:14px;text-align:${align}">
    <div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:${COLOR.primary};font-weight:700;margin-bottom:8px">${escapeHtml(opts.heading)}</div>
    <ul style="margin:0;${padSide}:18px;${align === "right" ? "padding-left:0" : "padding-right:0"}">${items}</ul>
  </div>`;
}

/**
 * Soft note — used for warnings, expiry hints, secondary info.
 */
export function noteHtml(opts: { text: string; tone?: "info" | "warn" | "danger"; align?: "left" | "right" }): string {
  const tone = opts.tone || "info";
  const align = opts.align || "left";
  const accent = tone === "danger" ? COLOR.red : tone === "warn" ? COLOR.amber : COLOR.primary;
  const sideBorder = align === "right" ? "border-right" : "border-left";
  return `<div style="margin:18px 0;padding:12px 16px;background:${COLOR.bgCardSoft};${sideBorder}:3px solid ${accent};border-radius:8px;font-size:13px;color:${COLOR.textMuted};line-height:1.55;text-align:${align}">${escapeHtml(opts.text)}</div>`;
}

export function signoffHtml(opts: { lang: string | null | undefined }): string {
  const lang = normalizeLang(opts.lang);
  return `<div style="margin-top:28px;font-size:14px;color:${COLOR.text};line-height:1.6">
    ${escapeHtml(t(lang, "signoff"))}<br>
    <strong style="color:${COLOR.primary}">${escapeHtml(t(lang, "signoffName"))}</strong>
  </div>`;
}

// ---------------------------------------------------------------------------
// Builders — one per email type
// ---------------------------------------------------------------------------

export type Built = { subject: string; html: string; text: string };

function plain(...lines: Array<string | null | undefined | false>): string {
  return lines.filter(Boolean).join("\n");
}

// ---- 1. Welcome ----
export function buildWelcomeEmail(opts: {
  clientName: string;
  lang?: string | null;
  websiteUrl?: string;
}): Built {
  const lang = normalizeLang(opts.lang);
  const align = isRtl(lang) ? "right" : "left";
  const website = opts.websiteUrl || BRAND.defaultWebsite;
  const wa = `https://wa.me/${BRAND.whatsapp.replace(/[^0-9]/g, "")}`;

  const subject = t(lang, "welcomeSubject");
  const greeting = fill(t(lang, "greeting"), { name: opts.clientName });
  const heroTitle = fill(t(lang, "welcomeHero"), { name: opts.clientName });

  const featureBlock = (title: string, body: string) =>
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px;background:${COLOR.bgCardSoft};border:1px solid ${COLOR.border};border-radius:12px"><tr><td style="padding:14px 16px;text-align:${align}">
      <div style="font-size:14px;font-weight:700;color:${COLOR.text};margin-bottom:4px">${escapeHtml(title)}</div>
      <div style="font-size:13px;color:${COLOR.textMuted};line-height:1.55">${escapeHtml(body)}</div>
    </td></tr></table>`;

  const bodyHtml =
    `<p style="margin:0 0 12px;color:${COLOR.text};font-size:15px">${escapeHtml(greeting)}</p>` +
    heroHtml({ title: heroTitle, body: t(lang, "welcomeBody"), align }) +
    featureBlock(t(lang, "welcomeFeatBookT"), t(lang, "welcomeFeatBookB")) +
    featureBlock(t(lang, "welcomeFeatInbodyT"), t(lang, "welcomeFeatInbodyB")) +
    featureBlock(t(lang, "welcomeFeatContactT"), t(lang, "welcomeFeatContactB")) +
    `<div style="margin:22px 0 8px;text-align:${align}">${buttonHtml({ href: `${website}/booking`, label: t(lang, "welcomeCtaBook") })}</div>` +
    `<div style="margin:0 0 8px;text-align:${align}">${buttonHtml({ href: wa, label: t(lang, "ctaWhatsapp"), variant: "secondary" })}</div>` +
    rulesHtml({
      heading: t(lang, "welcomeRulesHeading"),
      items: [t(lang, "welcomeRule1"), t(lang, "welcomeRule2"), t(lang, "welcomeRule3")],
      align,
    }) +
    signoffHtml({ lang });

  const html = shellHtml({ lang, previewText: heroTitle, bodyHtml, websiteUrl: website });
  const text = plain(
    greeting,
    "",
    heroTitle,
    t(lang, "welcomeBody"),
    "",
    `• ${t(lang, "welcomeFeatBookT")}: ${website}/booking`,
    `• ${t(lang, "welcomeFeatInbodyT")}: ${website}/dashboard`,
    `• ${t(lang, "welcomeFeatContactT")}: ${wa}`,
    "",
    t(lang, "welcomeRulesHeading"),
    `- ${t(lang, "welcomeRule1")}`,
    `- ${t(lang, "welcomeRule2")}`,
    `- ${t(lang, "welcomeRule3")}`,
    "",
    `${t(lang, "signoff")} ${t(lang, "signoffName")}`,
  );
  return { subject, html, text };
}

// ---- 2. Booking confirmation (client) ----
export type BookingDetails = {
  clientName: string;
  date: string;
  time12: string;
  sessionFocusLabel?: string | null;
  trainingGoalLabel?: string | null;
  sessionTypeLabel?: string | null;
  packageName?: string | null;
  remainingSessions?: number | null;
  packageExpiryDate?: string | null;
  // Session number / total for "Session 4 of 30" rendering. Both must be
  // present to render. Falls back silently if either is null.
  currentSessionNumber?: number | null;
  totalSessions?: number | null;
  // Duo partner snapshot (Nov 2026). Only rendered when present —
  // single/package/trial bookings leave these null.
  partnerFullName?: string | null;
  partnerPhone?: string | null;
  partnerEmail?: string | null;
};

export function buildClientBookingConfirmationEmail(opts: {
  data: BookingDetails;
  lang?: string | null;
  websiteUrl?: string;
}): Built {
  const lang = normalizeLang(opts.lang);
  const align = isRtl(lang) ? "right" : "left";
  const website = opts.websiteUrl || BRAND.defaultWebsite;
  const d = opts.data;

  const subject = fill(t(lang, "bookingSubject"), { date: d.date, time: d.time12 });
  const greeting = fill(t(lang, "greeting"), { name: d.clientName });

  const bodyHtml =
    `<p style="margin:0 0 12px;color:${COLOR.text};font-size:15px">${escapeHtml(greeting)}</p>` +
    heroHtml({ title: t(lang, "bookingHero"), body: t(lang, "bookingBody"), align }) +
    infoCardHtml({
      rows: [
        [t(lang, "bookingDate"), d.date],
        [t(lang, "bookingTime"), d.time12],
        [t(lang, "bookingFocus"), d.sessionFocusLabel || null],
        [t(lang, "bookingGoal"), d.trainingGoalLabel || null],
        [t(lang, "bookingType"), d.sessionTypeLabel || null],
        d.partnerFullName ? ["Training partner", d.partnerFullName] : ["", null],
        [t(lang, "bookingLocation"), t(lang, "bookingLocationValue")],
        [t(lang, "bookingPackage"), d.packageName || null],
        d.currentSessionNumber != null && d.totalSessions != null
          ? ["Session", `${d.currentSessionNumber} of ${d.totalSessions}`]
          : ["", null],
        [t(lang, "bookingRemaining"), d.remainingSessions ?? null],
        [t(lang, "bookingExpires"), d.packageExpiryDate || null],
      ],
      align,
    }) +
    `<div style="margin:18px 0 8px;text-align:${align}">${buttonHtml({ href: `${website}/dashboard`, label: t(lang, "ctaDashboard") })}</div>` +
    rulesHtml({
      heading: t(lang, "bookingRulesHeading"),
      items: [t(lang, "bookingRule1"), t(lang, "bookingRule2"), t(lang, "bookingRule3")],
      align,
    }) +
    signoffHtml({ lang });

  const html = shellHtml({ lang, previewText: subject, bodyHtml, websiteUrl: website });
  const text = plain(
    greeting,
    "",
    t(lang, "bookingHero"),
    t(lang, "bookingBody"),
    "",
    `${t(lang, "bookingDate")}: ${d.date}`,
    `${t(lang, "bookingTime")}: ${d.time12}`,
    d.sessionFocusLabel && `${t(lang, "bookingFocus")}: ${d.sessionFocusLabel}`,
    d.trainingGoalLabel && `${t(lang, "bookingGoal")}: ${d.trainingGoalLabel}`,
    d.sessionTypeLabel && `${t(lang, "bookingType")}: ${d.sessionTypeLabel}`,
    d.packageName && `${t(lang, "bookingPackage")}: ${d.packageName}`,
    d.remainingSessions != null && `${t(lang, "bookingRemaining")}: ${d.remainingSessions}`,
    d.packageExpiryDate && `${t(lang, "bookingExpires")}: ${d.packageExpiryDate}`,
    "",
    `- ${t(lang, "bookingRule1")}`,
    `- ${t(lang, "bookingRule2")}`,
    `- ${t(lang, "bookingRule3")}`,
    "",
    `${t(lang, "signoff")} ${t(lang, "signoffName")}`,
  );
  return { subject, html, text };
}

// ---- 3. Session reminder (24h / 1h) ----
export function buildSessionReminderEmail(opts: {
  data: BookingDetails;
  lang?: string | null;
  kind: "24h" | "1h";
  websiteUrl?: string;
}): Built {
  const lang = normalizeLang(opts.lang);
  const align = isRtl(lang) ? "right" : "left";
  const website = opts.websiteUrl || BRAND.defaultWebsite;
  const d = opts.data;
  const isOneHour = opts.kind === "1h";

  const subject = fill(
    isOneHour ? t(lang, "reminder1Subject") : t(lang, "reminder24Subject"),
    { time: d.time12, date: d.date },
  );
  const heroTitle = isOneHour ? t(lang, "reminder1Hero") : t(lang, "reminder24Hero");
  const heroBody = isOneHour ? t(lang, "reminder1Body") : t(lang, "reminder24Body");
  const greeting = fill(t(lang, "greeting"), { name: d.clientName });

  const bodyHtml =
    `<p style="margin:0 0 12px;color:${COLOR.text};font-size:15px">${escapeHtml(greeting)}</p>` +
    heroHtml({ title: heroTitle, body: heroBody, align }) +
    infoCardHtml({
      rows: [
        [t(lang, "bookingDate"), d.date],
        [t(lang, "bookingTime"), d.time12],
        [t(lang, "bookingFocus"), d.sessionFocusLabel || null],
        [t(lang, "bookingGoal"), d.trainingGoalLabel || null],
      ],
      align,
    }) +
    `<div style="margin:18px 0 8px;text-align:${align}">${buttonHtml({ href: `${website}/dashboard`, label: t(lang, "ctaDashboard") })}</div>` +
    signoffHtml({ lang });

  const html = shellHtml({ lang, previewText: subject, bodyHtml, websiteUrl: website });
  const text = plain(greeting, "", heroTitle, heroBody, "", `${d.date} • ${d.time12}`, "", `${t(lang, "signoff")} ${t(lang, "signoffName")}`);
  return { subject, html, text };
}

// ---- 4. Package expiring soon ----
export function buildPackageExpiringEmail(opts: {
  clientName: string;
  lang?: string | null;
  remainingSessions?: number | null;
  daysUntilExpiry?: number | null;
  packageName?: string | null;
  websiteUrl?: string;
}): Built {
  const lang = normalizeLang(opts.lang);
  const align = isRtl(lang) ? "right" : "left";
  const website = opts.websiteUrl || BRAND.defaultWebsite;
  const wa = `https://wa.me/${BRAND.whatsapp.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(`Hi Coach, I'd like to renew my package${opts.packageName ? ` (${opts.packageName})` : ""}.`)}`;

  const subject = t(lang, "expiringSubject");
  const greeting = fill(t(lang, "greeting"), { name: opts.clientName });

  // Pick the most-urgent message: prefer "low sessions" when remaining is low,
  // otherwise fall back to days-until-expiry.
  let body: string;
  if (opts.remainingSessions != null && opts.remainingSessions <= 3) {
    body = fill(t(lang, "expiringBodyLow"), {
      n: opts.remainingSessions,
      plural: opts.remainingSessions === 1 ? "" : "s",
    });
  } else if (opts.daysUntilExpiry != null) {
    body = fill(t(lang, "expiringBodyDays"), {
      n: opts.daysUntilExpiry,
      plural: opts.daysUntilExpiry === 1 ? "" : "s",
    });
  } else {
    body = t(lang, "expiringBodyLow");
  }

  const bodyHtml =
    `<p style="margin:0 0 12px;color:${COLOR.text};font-size:15px">${escapeHtml(greeting)}</p>` +
    heroHtml({ title: t(lang, "expiringHero"), body, align }) +
    infoCardHtml({
      rows: [
        [t(lang, "bookingPackage"), opts.packageName || null],
        [t(lang, "bookingRemaining"), opts.remainingSessions ?? null],
      ],
      align,
    }) +
    `<div style="margin:18px 0 8px;text-align:${align}">${buttonHtml({ href: wa, label: t(lang, "expiringCta") })}</div>` +
    `<div style="margin:0 0 8px;text-align:${align}">${buttonHtml({ href: `${website}/dashboard`, label: t(lang, "ctaDashboard"), variant: "secondary" })}</div>` +
    signoffHtml({ lang });

  const html = shellHtml({ lang, previewText: subject, bodyHtml, websiteUrl: website });
  const text = plain(greeting, "", t(lang, "expiringHero"), body, "", wa, "", `${t(lang, "signoff")} ${t(lang, "signoffName")}`);
  return { subject, html, text };
}

// ---- 5. Package finished ----
export function buildPackageFinishedEmail(opts: {
  clientName: string;
  lang?: string | null;
  packageName?: string | null;
  websiteUrl?: string;
}): Built {
  const lang = normalizeLang(opts.lang);
  const align = isRtl(lang) ? "right" : "left";
  const website = opts.websiteUrl || BRAND.defaultWebsite;
  const wa = `https://wa.me/${BRAND.whatsapp.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(`Hi Coach, I just finished my package and I'm ready to renew.`)}`;

  const subject = t(lang, "finishedSubject");
  const greeting = fill(t(lang, "greeting"), { name: opts.clientName });
  const heroTitle = fill(t(lang, "finishedHero"), { name: opts.clientName });

  const bodyHtml =
    `<p style="margin:0 0 12px;color:${COLOR.text};font-size:15px">${escapeHtml(greeting)}</p>` +
    heroHtml({ title: heroTitle, body: t(lang, "finishedBody"), align }) +
    `<div style="margin:18px 0 8px;text-align:${align}">${buttonHtml({ href: wa, label: t(lang, "finishedCta") })}</div>` +
    signoffHtml({ lang });

  const html = shellHtml({ lang, previewText: subject, bodyHtml, websiteUrl: website });
  const text = plain(greeting, "", heroTitle, t(lang, "finishedBody"), "", wa, "", `${t(lang, "signoff")} ${t(lang, "signoffName")}`);
  return { subject, html, text };
}

// ---- 6. Password reset ----
export function buildPasswordResetEmail(opts: {
  resetUrl: string;
  lang?: string | null;
  websiteUrl?: string;
}): Built {
  const lang = normalizeLang(opts.lang);
  const align = isRtl(lang) ? "right" : "left";
  const subject = t(lang, "resetSubject");

  const bodyHtml =
    heroHtml({ title: t(lang, "resetHero"), body: t(lang, "resetBody"), align }) +
    `<div style="margin:18px 0 8px;text-align:${align}">${buttonHtml({ href: opts.resetUrl, label: t(lang, "resetCta") })}</div>` +
    noteHtml({ text: t(lang, "resetExpiry"), tone: "warn", align }) +
    `<div style="margin:0 0 8px;font-size:12px;color:${COLOR.textMuted};text-align:${align}">${escapeHtml(t(lang, "resetAltLink"))}</div>` +
    `<div style="margin:0 0 18px;font-size:12px;color:${COLOR.textDim};word-break:break-all;text-align:${align}"><a href="${escapeHtml(opts.resetUrl)}" style="color:${COLOR.primary};text-decoration:none">${escapeHtml(opts.resetUrl)}</a></div>` +
    noteHtml({ text: t(lang, "resetDisclaimer"), tone: "info", align });

  const html = shellHtml({ lang, previewText: subject, bodyHtml, websiteUrl: opts.websiteUrl });
  const text = plain(t(lang, "resetHero"), "", t(lang, "resetBody"), "", opts.resetUrl, "", t(lang, "resetExpiry"), "", t(lang, "resetDisclaimer"));
  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// Admin notification emails — ALWAYS English, sent to the trainer mailbox.
// Premium dark surface, rich detail, optimised for at-a-glance scanning.
// ---------------------------------------------------------------------------

function adminShell(opts: { previewText: string; bodyHtml: string }): string {
  return shellHtml({ lang: "en", previewText: opts.previewText, bodyHtml: opts.bodyHtml });
}

export function buildAdminNewClientEmail(opts: {
  clientName: string;
  email?: string | null;
  phone?: string | null;
  primaryGoal?: string | null;
  weeklyFrequency?: number | null;
  area?: string | null;
  packageName?: string | null;
  packagePrice?: number | null;
  websiteUrl?: string;
}): Built {
  const subject = `New client signup — ${opts.clientName}`;
  const website = opts.websiteUrl || BRAND.defaultWebsite;
  const bodyHtml =
    heroHtml({ title: "New client signup", body: `${opts.clientName} just registered.${opts.packageName ? " A package was selected — confirm payment when received." : ""}` }) +
    infoCardHtml({
      rows: [
        ["Name", opts.clientName],
        ["Email", opts.email ?? null],
        ["Phone", opts.phone ?? null],
        ["Area", opts.area ?? null],
        ["Primary goal", opts.primaryGoal ?? null],
        ["Weekly frequency", opts.weeklyFrequency != null ? `${opts.weeklyFrequency}× / week` : null],
        ["Package selected", opts.packageName ?? null],
        ["Package price", opts.packagePrice != null ? `${opts.packagePrice} AED` : null],
      ],
    }) +
    `<div style="margin:18px 0 8px">${buttonHtml({ href: `${website}/admin/clients`, label: "Open admin panel" })}</div>`;
  const html = adminShell({ previewText: subject, bodyHtml });
  const text = plain(
    "New client signup",
    "",
    `Name: ${opts.clientName}`,
    opts.email && `Email: ${opts.email}`,
    opts.phone && `Phone: ${opts.phone}`,
    opts.area && `Area: ${opts.area}`,
    opts.primaryGoal && `Primary goal: ${opts.primaryGoal}`,
    opts.weeklyFrequency != null && `Weekly frequency: ${opts.weeklyFrequency}×/week`,
    opts.packageName && `Package: ${opts.packageName}`,
    opts.packagePrice != null && `Price: ${opts.packagePrice} AED`,
  );
  return { subject, html, text };
}

export function buildAdminBookingEmail(opts: {
  d: BookingDetails;
  clientEmail?: string | null;
  clientPhone?: string | null;
  clientNotes?: string | null;
  websiteUrl?: string;
}): Built {
  const d = opts.d;
  const subject = `New booking — ${d.clientName} | ${d.date} at ${d.time12}`;
  const website = opts.websiteUrl || BRAND.defaultWebsite;
  const bodyHtml =
    heroHtml({ title: "New session booking", body: `${d.clientName} booked a session.` }) +
    infoCardHtml({
      rows: [
        ["Client", d.clientName],
        ["Email", opts.clientEmail ?? null],
        ["Phone", opts.clientPhone ?? null],
        ["Date", d.date],
        ["Time (Dubai)", `${d.time12} · GST (UTC+4)`],
        ["Focus", d.sessionFocusLabel ?? null],
        ["Goal", d.trainingGoalLabel ?? null],
        ["Type", d.sessionTypeLabel ?? null],
        d.partnerFullName ? ["Training partner", d.partnerFullName] : ["", null],
        d.partnerPhone ? ["Partner phone", d.partnerPhone] : ["", null],
        d.partnerEmail ? ["Partner email", d.partnerEmail] : ["", null],
        ["Package", d.packageName ?? null],
        d.currentSessionNumber != null && d.totalSessions != null
          ? ["Session", `${d.currentSessionNumber} of ${d.totalSessions}`]
          : ["", null],
        ["Remaining after this", d.remainingSessions ?? null],
        ["Package expires", d.packageExpiryDate ?? null],
      ],
    }) +
    (opts.clientNotes ? noteHtml({ text: `Client notes: ${opts.clientNotes}`, tone: "warn" }) : "") +
    `<div style="margin:18px 0 8px">${buttonHtml({ href: `${website}/admin/bookings`, label: "Open admin bookings" })}</div>`;
  const html = adminShell({ previewText: subject, bodyHtml });
  const text = plain(
    `New booking — ${d.clientName}`,
    "",
    `Date: ${d.date}`,
    `Time: ${d.time12}`,
    opts.clientEmail && `Email: ${opts.clientEmail}`,
    opts.clientPhone && `Phone: ${opts.clientPhone}`,
    d.sessionFocusLabel && `Focus: ${d.sessionFocusLabel}`,
    d.trainingGoalLabel && `Goal: ${d.trainingGoalLabel}`,
    d.sessionTypeLabel && `Type: ${d.sessionTypeLabel}`,
    d.packageName && `Package: ${d.packageName}`,
    d.remainingSessions != null && `Remaining after this: ${d.remainingSessions}`,
    opts.clientNotes && `\nClient notes:\n${opts.clientNotes}`,
  );
  return { subject, html, text };
}

export function buildAdminBookingChangeEmail(opts: {
  kind: "cancellation" | "reschedule";
  clientName: string;
  date: string;
  time12: string;
  fromDate?: string | null;
  fromTime12?: string | null;
  reason?: string | null;
  websiteUrl?: string;
}): Built {
  const isResched = opts.kind === "reschedule";
  const subject = isResched
    ? `Booking rescheduled — ${opts.clientName} → ${opts.date} ${opts.time12}`
    : `Booking cancelled — ${opts.clientName} | ${opts.date} ${opts.time12}`;
  const website = opts.websiteUrl || BRAND.defaultWebsite;
  const heroTitle = isResched ? "Booking rescheduled" : "Booking cancelled";
  const bodyHtml =
    heroHtml({ title: heroTitle, body: `${opts.clientName}` }) +
    infoCardHtml({
      rows: isResched
        ? [
            ["Client", opts.clientName],
            ["From", opts.fromDate && opts.fromTime12 ? `${opts.fromDate} ${opts.fromTime12}` : null],
            ["To", `${opts.date} ${opts.time12}`],
          ]
        : [
            ["Client", opts.clientName],
            ["Date", opts.date],
            ["Time", opts.time12],
          ],
    }) +
    (opts.reason ? noteHtml({ text: `Reason: ${opts.reason}`, tone: "warn" }) : "") +
    `<div style="margin:18px 0 8px">${buttonHtml({ href: `${website}/admin/bookings`, label: "Open admin bookings" })}</div>`;
  const html = adminShell({ previewText: subject, bodyHtml });
  const text = plain(
    heroTitle,
    `Client: ${opts.clientName}`,
    isResched && opts.fromDate && opts.fromTime12 && `From: ${opts.fromDate} ${opts.fromTime12}`,
    `${isResched ? "To" : "When"}: ${opts.date} ${opts.time12}`,
    opts.reason && `Reason: ${opts.reason}`,
  );
  return { subject, html, text };
}

export function buildAdminInbodyEmail(opts: {
  clientName: string;
  recordedDate?: string | null;
  websiteUrl?: string;
}): Built {
  const subject = `InBody uploaded — ${opts.clientName}`;
  const website = opts.websiteUrl || BRAND.defaultWebsite;
  const bodyHtml =
    heroHtml({ title: "New InBody scan uploaded", body: `${opts.clientName} added a new InBody record.` }) +
    infoCardHtml({
      rows: [
        ["Client", opts.clientName],
        ["Date", opts.recordedDate ?? null],
      ],
    }) +
    `<div style="margin:18px 0 8px">${buttonHtml({ href: `${website}/admin/clients`, label: "Open client profile" })}</div>`;
  const html = adminShell({ previewText: subject, bodyHtml });
  const text = plain("New InBody uploaded", `Client: ${opts.clientName}`, opts.recordedDate && `Date: ${opts.recordedDate}`);
  return { subject, html, text };
}

export function buildAdminPackageExpiringEmail(opts: {
  clientName: string;
  packageName?: string | null;
  remainingSessions?: number | null;
  daysUntilExpiry?: number | null;
  websiteUrl?: string;
}): Built {
  const subject = `Package running low — ${opts.clientName}`;
  const website = opts.websiteUrl || BRAND.defaultWebsite;
  const detail =
    opts.remainingSessions != null && opts.remainingSessions <= 3
      ? `${opts.remainingSessions} session${opts.remainingSessions === 1 ? "" : "s"} remaining`
      : opts.daysUntilExpiry != null
        ? `Expires in ${opts.daysUntilExpiry} day${opts.daysUntilExpiry === 1 ? "" : "s"}`
        : "Approaching renewal threshold";
  const bodyHtml =
    heroHtml({ title: "Client renewal likely needed", body: `${opts.clientName}'s package is running low.` }) +
    infoCardHtml({
      rows: [
        ["Client", opts.clientName],
        ["Package", opts.packageName ?? null],
        ["Status", detail],
      ],
    }) +
    `<div style="margin:18px 0 8px">${buttonHtml({ href: `${website}/admin/clients`, label: "Open client profile" })}</div>`;
  const html = adminShell({ previewText: subject, bodyHtml });
  const text = plain(`Client renewal likely needed — ${opts.clientName}`, opts.packageName && `Package: ${opts.packageName}`, detail);
  return { subject, html, text };
}

// ===========================================================================
// PREMIUM HELPERS — TRON status badges, divider rails, metric tiles, AED card
// ===========================================================================

type BadgeTone =
  | "info"
  | "success"
  | "warn"
  | "danger"
  | "vip"
  | "neutral"
  | "tron";

/**
 * Pill-shaped status badge — high-contrast, uppercase, letter-spaced.
 * Use at the top of the body to communicate the email's primary intent
 * (NEW BOOKING / CANCELLED / RESCHEDULED / PROTECTED / PAID / EXPIRED / VIP).
 */
export function statusBadgeHtml(opts: { label: string; tone?: BadgeTone }): string {
  const tone = opts.tone || "tron";
  const palette: Record<BadgeTone, { bg: string; fg: string; border: string }> = {
    info:    { bg: COLOR.bgCardElev, fg: COLOR.primary,  border: COLOR.borderCyan },
    tron:    { bg: COLOR.primaryDeep, fg: COLOR.primary, border: COLOR.primary },
    success: { bg: "#06251a",         fg: COLOR.emerald, border: "#127a55" },
    warn:    { bg: "#2a1d05",         fg: COLOR.amber,   border: "#8a5b0a" },
    danger:  { bg: "#2a0a0a",         fg: COLOR.red,     border: "#8a1a1a" },
    vip:     { bg: "#1f1805",         fg: COLOR.gold,    border: "#a37510" },
    neutral: { bg: COLOR.bgCardSoft,  fg: COLOR.textMuted, border: COLOR.border },
  };
  const p = palette[tone];
  return `<span style="display:inline-block;padding:6px 12px;background:${p.bg};border:1px solid ${p.border};border-radius:999px;color:${p.fg};font-size:10.5px;font-weight:800;letter-spacing:2.2px;text-transform:uppercase;line-height:1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">${escapeHtml(opts.label)}</span>`;
}

/**
 * TRON divider rail — thin glowing horizontal line with center fade.
 * Use to separate sections inside the body without heavy visual weight.
 */
export function dividerHtml(): string {
  return `<div style="margin:22px 0;height:1px;background:linear-gradient(90deg, transparent 0%, ${COLOR.borderCyan} 30%, ${COLOR.primary} 50%, ${COLOR.borderCyan} 70%, transparent 100%);line-height:1px;font-size:0">&nbsp;</div>`;
}

/**
 * Metric tile grid — 2-column layout for InBody / body metrics / KPIs.
 * Each tile shows a label + a large numeric value + optional unit.
 */
export function metricGridHtml(opts: {
  metrics: Array<{ label: string; value: string | number | null | undefined; unit?: string; tone?: "primary" | "success" | "warn" | "danger" }>;
}): string {
  const cells = opts.metrics
    .filter((m) => m.value !== null && m.value !== undefined && m.value !== "")
    .map((m) => {
      const fg =
        m.tone === "success" ? COLOR.emerald :
        m.tone === "warn"    ? COLOR.amber :
        m.tone === "danger"  ? COLOR.red :
        COLOR.primary;
      return `<td width="50%" style="padding:6px;vertical-align:top">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLOR.bgCardElev};border:1px solid ${COLOR.borderCyan};border-radius:12px;box-shadow:inset 0 0 0 1px ${COLOR.primaryDeep}">
          <tr><td style="padding:14px 16px">
            <div style="font-size:10px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;color:${COLOR.textMuted};margin:0 0 8px">${escapeHtml(m.label)}</div>
            <div style="font-family:'Times New Roman',Georgia,serif;font-size:24px;font-weight:700;color:${fg};line-height:1">${escapeHtml(String(m.value))}${m.unit ? `<span style="font-size:13px;font-weight:600;color:${COLOR.textMuted};margin-left:4px;letter-spacing:0.5px">${escapeHtml(m.unit)}</span>` : ""}</div>
          </td></tr>
        </table>
      </td>`;
    });
  if (cells.length === 0) return "";
  // Pad to even count for clean 2-column grid
  if (cells.length % 2 === 1) cells.push(`<td width="50%" style="padding:6px">&nbsp;</td>`);
  const rows: string[] = [];
  for (let i = 0; i < cells.length; i += 2) {
    rows.push(`<tr>${cells[i]}${cells[i + 1]}</tr>`);
  }
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px -6px 22px">
    ${rows.join("")}
  </table>`;
}

/**
 * AED price card — premium currency display for payment / package emails.
 * Renders the amount with a luminous TRON cyan accent and AED label.
 */
export function priceCardHtml(opts: {
  label: string;
  amountAed: number;
  sublabel?: string;
  tone?: "primary" | "success" | "warn";
}): string {
  const fg =
    opts.tone === "success" ? COLOR.emerald :
    opts.tone === "warn"    ? COLOR.amber :
    COLOR.primary;
  const formatted = new Intl.NumberFormat("en-US").format(Math.round(opts.amountAed));
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 22px;background:${COLOR.bgCardSoft};border:1px solid ${COLOR.borderCyan};border-radius:14px;box-shadow:inset 0 0 0 1px ${COLOR.primaryDeep}, 0 0 24px -8px ${COLOR.primaryGlow}">
    <tr><td style="padding:20px 24px">
      <div style="font-size:10.5px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${COLOR.textMuted};margin:0 0 10px">${escapeHtml(opts.label)}</div>
      <div style="font-family:'Times New Roman',Georgia,serif;color:${fg};line-height:1">
        <span style="font-size:14px;font-weight:600;letter-spacing:2px;color:${COLOR.textMuted};margin-right:8px;vertical-align:middle">AED</span><span style="font-size:32px;font-weight:700;letter-spacing:-0.5px;vertical-align:middle">${escapeHtml(formatted)}</span>
      </div>
      ${opts.sublabel ? `<div style="margin-top:8px;font-size:13px;color:${COLOR.textMuted}">${escapeHtml(opts.sublabel)}</div>` : ""}
    </td></tr>
  </table>`;
}

// ===========================================================================
// NEW ADMIN EMAIL BUILDERS — operational coverage for every important event
// ===========================================================================

/**
 * Admin notification when an attendance status is recorded against a booking
 * (attended / no_show / late_cancel_charged / late_cancel_free). Distinct
 * subjects per state so the inbox is glanceable.
 */
export function buildAdminAttendanceEmail(opts: {
  attendance: "attended" | "no_show" | "late_cancel_charged" | "late_cancel_free";
  clientName: string;
  date: string;
  time12: string;
  packageName?: string | null;
  remainingSessions?: number | null;
  reason?: string | null;
  websiteUrl?: string;
}): Built {
  const website = opts.websiteUrl || BRAND.defaultWebsite;
  const cfg = (() => {
    switch (opts.attendance) {
      case "attended":
        return { subject: `Session attended — ${opts.clientName}`, badge: "Attended", tone: "success" as BadgeTone, eyebrow: "Attendance recorded", title: "Session attended", body: `${opts.clientName} completed their session on ${opts.date} at ${opts.time12}.` };
      case "no_show":
        return { subject: `No-show — ${opts.clientName} | ${opts.date} ${opts.time12}`, badge: "No-show", tone: "danger" as BadgeTone, eyebrow: "Attendance flagged", title: "Client did not attend", body: `${opts.clientName} did not arrive for the ${opts.date} session at ${opts.time12}. The session has been counted from their package.` };
      case "late_cancel_charged":
        return { subject: `Late cancel (charged) — ${opts.clientName} | ${opts.date} ${opts.time12}`, badge: "Late Cancel", tone: "warn" as BadgeTone, eyebrow: "Attendance recorded", title: "Late cancellation — session charged", body: `${opts.clientName} cancelled the ${opts.date} session at ${opts.time12} inside the cutoff window. The session has been deducted.` };
      case "late_cancel_free":
        return { subject: `Late cancel (free) — ${opts.clientName} | ${opts.date} ${opts.time12}`, badge: "Cancelled", tone: "neutral" as BadgeTone, eyebrow: "Attendance recorded", title: "Late cancellation — waived", body: `${opts.clientName}'s ${opts.date} session at ${opts.time12} was cancelled and not deducted from their package.` };
    }
  })();
  const bodyHtml =
    `<div style="margin:0 0 18px">${statusBadgeHtml({ label: cfg.badge, tone: cfg.tone })}</div>` +
    heroHtml({ title: cfg.title, body: cfg.body, eyebrow: cfg.eyebrow }) +
    infoCardHtml({
      rows: [
        ["Client", opts.clientName],
        ["Date", opts.date],
        ["Time (Dubai)", `${opts.time12} · GST (UTC+4)`],
        ["Package", opts.packageName ?? null],
        ["Remaining sessions", opts.remainingSessions ?? null],
        ["Reason / note", opts.reason ?? null],
      ],
    }) +
    dividerHtml() +
    `<div style="margin:8px 0">${buttonHtml({ href: `${website}/admin/bookings`, label: "Open admin bookings" })}</div>`;
  const html = adminShell({ previewText: cfg.subject, bodyHtml });
  const text = plain(
    cfg.title,
    `Client: ${opts.clientName}`,
    `When: ${opts.date} at ${opts.time12} (Dubai)`,
    opts.packageName && `Package: ${opts.packageName}`,
    opts.remainingSessions != null && `Remaining: ${opts.remainingSessions}`,
    opts.reason && `Reason: ${opts.reason}`,
  );
  return { subject: cfg.subject, html, text };
}

/**
 * Admin notification specifically for protected / emergency cancellations —
 * distinct subject + badge so it stands apart from regular cancellations.
 */
export function buildAdminEmergencyCancelEmail(opts: {
  clientName: string;
  date: string;
  time12: string;
  monthlyQuotaUsed?: number | null;
  monthlyQuotaTotal?: number | null;
  reason?: string | null;
  websiteUrl?: string;
}): Built {
  const subject = `Protected cancellation — ${opts.clientName} | ${opts.date} ${opts.time12}`;
  const website = opts.websiteUrl || BRAND.defaultWebsite;
  const quotaLine =
    opts.monthlyQuotaUsed != null && opts.monthlyQuotaTotal != null
      ? `${opts.monthlyQuotaUsed} of ${opts.monthlyQuotaTotal} used this month`
      : null;
  const bodyHtml =
    `<div style="margin:0 0 18px">${statusBadgeHtml({ label: "Protected · No charge", tone: "vip" })}</div>` +
    heroHtml({
      eyebrow: "Premium cancellation used",
      title: "Protected cancellation",
      body: `${opts.clientName} used a Protected Cancellation for the ${opts.date} session at ${opts.time12}. The session was not deducted.`,
    }) +
    infoCardHtml({
      rows: [
        ["Client", opts.clientName],
        ["Date", opts.date],
        ["Time (Dubai)", `${opts.time12} · GST (UTC+4)`],
        ["Monthly quota", quotaLine],
        ["Note", opts.reason ?? null],
      ],
    }) +
    dividerHtml() +
    `<div style="margin:8px 0">${buttonHtml({ href: `${website}/admin/clients`, label: "Open client profile" })}</div>`;
  const html = adminShell({ previewText: subject, bodyHtml });
  const text = plain(
    "Protected cancellation",
    `Client: ${opts.clientName}`,
    `When: ${opts.date} at ${opts.time12} (Dubai)`,
    quotaLine && `Monthly quota: ${quotaLine}`,
    opts.reason && `Note: ${opts.reason}`,
  );
  return { subject, html, text };
}

/**
 * Admin notification when a payment is recorded / status changed
 * (paid in full, partial receipt, complimentary, refund-pending, etc.).
 */
export function buildAdminPaymentEmail(opts: {
  clientName: string;
  packageName?: string | null;
  paymentStatus: string;
  amountReceived?: number | null;     // delta this transaction (for add-payment)
  amountPaidTotal?: number | null;    // running total
  packageTotal?: number | null;
  note?: string | null;
  websiteUrl?: string;
}): Built {
  const websiteUrl = opts.websiteUrl || BRAND.defaultWebsite;
  const isPaid = opts.paymentStatus === "paid";
  const isPartial = opts.paymentStatus === "partially_paid";
  const isComp = opts.paymentStatus === "complimentary";
  const badge = isPaid ? "Paid in full" : isPartial ? "Partial payment" : isComp ? "Complimentary" : opts.paymentStatus;
  const tone: BadgeTone = isPaid ? "success" : isPartial ? "tron" : isComp ? "vip" : "warn";
  const title = isPaid
    ? "Package paid in full"
    : isPartial
      ? "Partial payment received"
      : isComp
        ? "Package marked complimentary"
        : "Payment status updated";
  const subject = `${title} — ${opts.clientName}${opts.packageName ? ` · ${opts.packageName}` : ""}`;
  const remaining =
    opts.amountPaidTotal != null && opts.packageTotal != null
      ? Math.max(0, opts.packageTotal - opts.amountPaidTotal)
      : null;
  const bodyHtml =
    `<div style="margin:0 0 18px">${statusBadgeHtml({ label: badge, tone })}</div>` +
    heroHtml({
      eyebrow: "Payment update",
      title,
      body: `${opts.clientName}${opts.packageName ? ` — ${opts.packageName}` : ""}`,
    }) +
    (opts.amountReceived != null && opts.amountReceived > 0
      ? priceCardHtml({
          label: "Amount received",
          amountAed: opts.amountReceived,
          sublabel:
            opts.amountPaidTotal != null && opts.packageTotal != null
              ? `Total paid AED ${new Intl.NumberFormat("en-US").format(Math.round(opts.amountPaidTotal))} of AED ${new Intl.NumberFormat("en-US").format(Math.round(opts.packageTotal))}`
              : undefined,
          tone: "success",
        })
      : opts.amountPaidTotal != null && isPaid
        ? priceCardHtml({
            label: "Package total paid",
            amountAed: opts.amountPaidTotal,
            tone: "success",
          })
        : "") +
    infoCardHtml({
      rows: [
        ["Client", opts.clientName],
        ["Package", opts.packageName ?? null],
        ["Status", badge],
        opts.amountPaidTotal != null ? ["Total paid", `AED ${new Intl.NumberFormat("en-US").format(Math.round(opts.amountPaidTotal))}`] : ["", null],
        opts.packageTotal != null ? ["Package value", `AED ${new Intl.NumberFormat("en-US").format(Math.round(opts.packageTotal))}`] : ["", null],
        remaining != null && remaining > 0 ? ["Outstanding", `AED ${new Intl.NumberFormat("en-US").format(Math.round(remaining))}`] : ["", null],
        ["Note", opts.note ?? null],
      ],
    }) +
    dividerHtml() +
    `<div style="margin:8px 0">${buttonHtml({ href: `${websiteUrl}/admin/clients`, label: "Open client profile" })}</div>`;
  const html = adminShell({ previewText: subject, bodyHtml });
  const text = plain(
    title,
    `Client: ${opts.clientName}`,
    opts.packageName && `Package: ${opts.packageName}`,
    `Status: ${badge}`,
    opts.amountReceived != null && opts.amountReceived > 0 && `Received: AED ${opts.amountReceived}`,
    opts.amountPaidTotal != null && `Total paid: AED ${opts.amountPaidTotal}`,
    opts.packageTotal != null && `Package value: AED ${opts.packageTotal}`,
    remaining != null && remaining > 0 && `Outstanding: AED ${remaining}`,
    opts.note && `Note: ${opts.note}`,
  );
  return { subject, html, text };
}

/**
 * Admin notification when a package is activated — newly created, approved,
 * or converted from a trial. Snapshots package economics.
 */
export function buildAdminPackageActivatedEmail(opts: {
  clientName: string;
  packageName: string;
  totalSessions?: number | null;
  paidSessions?: number | null;
  bonusSessions?: number | null;
  totalPrice?: number | null;
  startDate?: string | null;
  expiryDate?: string | null;
  paymentStatus?: string | null;
  source?: "new" | "approved" | "converted_trial";
  websiteUrl?: string;
}): Built {
  const website = opts.websiteUrl || BRAND.defaultWebsite;
  const verb = opts.source === "approved" ? "approved" : opts.source === "converted_trial" ? "activated from trial" : "created";
  const subject = `Package ${verb} — ${opts.clientName} · ${opts.packageName}`;
  const bodyHtml =
    `<div style="margin:0 0 18px">${statusBadgeHtml({ label: "Package live", tone: "success" })}</div>` +
    heroHtml({
      eyebrow: "Client onboarding",
      title: "Package is live",
      body: `${opts.clientName}'s ${opts.packageName} has been ${verb} and is now active.`,
    }) +
    (opts.totalPrice != null && opts.totalPrice > 0
      ? priceCardHtml({ label: "Package value", amountAed: opts.totalPrice, sublabel: opts.paymentStatus ? `Payment status — ${opts.paymentStatus}` : undefined })
      : "") +
    infoCardHtml({
      rows: [
        ["Client", opts.clientName],
        ["Package", opts.packageName],
        opts.totalSessions != null ? ["Total sessions", `${opts.totalSessions}${opts.bonusSessions ? ` (incl. ${opts.bonusSessions} bonus)` : ""}`] : ["", null],
        opts.paidSessions != null ? ["Paid sessions", opts.paidSessions] : ["", null],
        ["Start date", opts.startDate ?? null],
        ["Expires", opts.expiryDate ?? null],
        ["Payment status", opts.paymentStatus ?? null],
      ],
    }) +
    dividerHtml() +
    `<div style="margin:8px 0">${buttonHtml({ href: `${website}/admin/clients`, label: "Open client profile" })}</div>`;
  const html = adminShell({ previewText: subject, bodyHtml });
  const text = plain(
    `Package ${verb} — ${opts.clientName}`,
    `Package: ${opts.packageName}`,
    opts.totalSessions != null && `Total sessions: ${opts.totalSessions}`,
    opts.totalPrice != null && `Value: AED ${opts.totalPrice}`,
    opts.startDate && `Start: ${opts.startDate}`,
    opts.expiryDate && `Expires: ${opts.expiryDate}`,
    opts.paymentStatus && `Payment: ${opts.paymentStatus}`,
  );
  return { subject, html, text };
}

/**
 * Admin notification when a package expires (sessions exhausted OR expiry
 * date passed). Distinct from "expiring soon" — this is the terminal state.
 */
export function buildAdminPackageExpiredEmail(opts: {
  clientName: string;
  packageName: string;
  reason: "sessions_exhausted" | "date_expired";
  totalSessions?: number | null;
  expiryDate?: string | null;
  websiteUrl?: string;
}): Built {
  const website = opts.websiteUrl || BRAND.defaultWebsite;
  const detail =
    opts.reason === "sessions_exhausted"
      ? "All sessions have been used."
      : "The package window has closed.";
  const subject = `Package finished — ${opts.clientName} · ${opts.packageName}`;
  const bodyHtml =
    `<div style="margin:0 0 18px">${statusBadgeHtml({ label: "Renewal needed", tone: "warn" })}</div>` +
    heroHtml({
      eyebrow: "Renewal moment",
      title: "Package complete — renewal opportunity",
      body: `${opts.clientName}'s ${opts.packageName} is finished. ${detail} Reach out before the rhythm breaks.`,
    }) +
    infoCardHtml({
      rows: [
        ["Client", opts.clientName],
        ["Package", opts.packageName],
        ["Reason", opts.reason === "sessions_exhausted" ? "Sessions exhausted" : "Date expired"],
        opts.totalSessions != null ? ["Total sessions", opts.totalSessions] : ["", null],
        ["Expired on", opts.expiryDate ?? null],
      ],
    }) +
    noteHtml({ text: "Tip: a same-day check-in often converts renewals. The momentum is yours to keep alive.", tone: "info" }) +
    dividerHtml() +
    `<div style="margin:8px 0">${buttonHtml({ href: `${website}/admin/clients`, label: "Open client profile" })}</div>`;
  const html = adminShell({ previewText: subject, bodyHtml });
  const text = plain(
    `Package finished — ${opts.clientName}`,
    `Package: ${opts.packageName}`,
    `Reason: ${opts.reason === "sessions_exhausted" ? "Sessions exhausted" : "Date expired"}`,
    opts.expiryDate && `Expired on: ${opts.expiryDate}`,
  );
  return { subject, html, text };
}

/**
 * Admin notification when a package is extended (admin-granted or
 * client-request approved). Captures old + new expiry.
 */
export function buildAdminPackageExtendedEmail(opts: {
  clientName: string;
  packageName: string;
  daysAdded: number;
  previousExpiry?: string | null;
  newExpiry: string;
  reason?: string | null;
  websiteUrl?: string;
}): Built {
  const website = opts.websiteUrl || BRAND.defaultWebsite;
  const subject = `Package extended — ${opts.clientName} · +${opts.daysAdded}d`;
  const bodyHtml =
    `<div style="margin:0 0 18px">${statusBadgeHtml({ label: `+${opts.daysAdded} days`, tone: "tron" })}</div>` +
    heroHtml({
      eyebrow: "Package extension",
      title: "Package window extended",
      body: `${opts.clientName}'s ${opts.packageName} expiry has been pushed forward by ${opts.daysAdded} day${opts.daysAdded === 1 ? "" : "s"}.`,
    }) +
    infoCardHtml({
      rows: [
        ["Client", opts.clientName],
        ["Package", opts.packageName],
        ["Days added", `+${opts.daysAdded}`],
        ["Previous expiry", opts.previousExpiry ?? null],
        ["New expiry", opts.newExpiry],
        ["Reason", opts.reason ?? null],
      ],
    }) +
    dividerHtml() +
    `<div style="margin:8px 0">${buttonHtml({ href: `${website}/admin/clients`, label: "Open client profile" })}</div>`;
  const html = adminShell({ previewText: subject, bodyHtml });
  const text = plain(
    `Package extended — ${opts.clientName}`,
    `Package: ${opts.packageName}`,
    `+${opts.daysAdded} days`,
    opts.previousExpiry && `From: ${opts.previousExpiry}`,
    `New expiry: ${opts.newExpiry}`,
    opts.reason && `Reason: ${opts.reason}`,
  );
  return { subject, html, text };
}

/**
 * Admin notification when a client makes a meaningful profile change
 * (avatar updated, contact info changed, training goal updated). Aggregates
 * the diff into a single concise email so the inbox doesn't fill with noise.
 */
export function buildAdminProfileUpdateEmail(opts: {
  clientName: string;
  changes: Array<[string, string | null]>;  // [field, new-value]
  websiteUrl?: string;
}): Built {
  const website = opts.websiteUrl || BRAND.defaultWebsite;
  const subject = `Profile updated — ${opts.clientName}`;
  const bodyHtml =
    `<div style="margin:0 0 18px">${statusBadgeHtml({ label: "Profile updated", tone: "info" })}</div>` +
    heroHtml({
      eyebrow: "Client activity",
      title: "Profile updated",
      body: `${opts.clientName} just updated their profile.`,
    }) +
    infoCardHtml({
      rows: [["Client", opts.clientName], ...opts.changes],
    }) +
    dividerHtml() +
    `<div style="margin:8px 0">${buttonHtml({ href: `${website}/admin/clients`, label: "Open client profile" })}</div>`;
  const html = adminShell({ previewText: subject, bodyHtml });
  const text = plain(
    `Profile updated — ${opts.clientName}`,
    ...opts.changes.map(([k, v]) => `${k}: ${v ?? "—"}`),
  );
  return { subject, html, text };
}
