/**
 * Localized strings for the client-facing booking confirmation email.
 * Trainer-facing email is always English (sent to Youssef directly).
 *
 * Placeholders:
 *   {date}, {time} — replaced in subject
 *   {name}         — replaced in greeting
 */

export type ClientEmailI18n = {
  subject: string;
  greeting: string;
  intro: string;
  dateLabel: string;
  timeLabel: string;
  focusLabel: string;
  goalLabel: string;
  packageLabel: string;
  remainingLabel: string;
  expiresLabel: string;
  rulesHeading: string;
  rule1: string;
  rule2: string;
  rule3: string;
  closing: string;
};

export const CLIENT_BOOKING_EMAIL_I18N: Record<string, ClientEmailI18n> = {
  en: {
    subject: "Booking confirmed — {date} at {time}",
    greeting: "Hi {name},",
    intro: "Your training session is booked. Here are your details:",
    dateLabel: "Date",
    timeLabel: "Time",
    focusLabel: "Session Focus",
    goalLabel: "Training Goal",
    packageLabel: "Package",
    remainingLabel: "Sessions remaining after this one",
    expiresLabel: "Package expires",
    rulesHeading: "A few quick reminders",
    rule1: "Each session is 1 hour.",
    rule2: "Cancel or reschedule at least 6 hours in advance.",
    rule3: "Any extra time must be agreed with Youssef in advance.",
    closing: "See you soon,\nYoussef Fitness",
  },
  ar: {
    subject: "تم تأكيد حجزك — {date} الساعة {time}",
    greeting: "مرحباً {name}،",
    intro: "تم تأكيد جلستك التدريبية. إليك التفاصيل:",
    dateLabel: "التاريخ",
    timeLabel: "الوقت",
    focusLabel: "تركيز الجلسة",
    goalLabel: "الهدف التدريبي",
    packageLabel: "الباقة",
    remainingLabel: "الجلسات المتبقية بعد هذه",
    expiresLabel: "تاريخ انتهاء الباقة",
    rulesHeading: "تذكيرات مهمة",
    rule1: "مدة كل جلسة ساعة واحدة.",
    rule2: "يجب الإلغاء أو إعادة الجدولة قبل 6 ساعات على الأقل.",
    rule3: "أي وقت إضافي يجب الاتفاق عليه مسبقاً مع Youssef.",
    closing: "إلى اللقاء قريباً،\nYoussef Fitness",
  },
  fr: {
    subject: "Réservation confirmée — {date} à {time}",
    greeting: "Bonjour {name},",
    intro: "Votre séance d'entraînement est réservée. Voici les détails :",
    dateLabel: "Date",
    timeLabel: "Heure",
    focusLabel: "Focus de la séance",
    goalLabel: "Objectif d'entraînement",
    packageLabel: "Forfait",
    remainingLabel: "Séances restantes après celle-ci",
    expiresLabel: "Expiration du forfait",
    rulesHeading: "Quelques rappels",
    rule1: "Chaque séance dure 1 heure.",
    rule2: "Annulez ou reprogrammez au moins 6 heures à l'avance.",
    rule3: "Tout temps supplémentaire doit être convenu à l'avance avec Youssef.",
    closing: "À bientôt,\nYoussef Fitness",
  },
  es: {
    subject: "Reserva confirmada — {date} a las {time}",
    greeting: "Hola {name},",
    intro: "Tu sesión de entrenamiento está reservada. Estos son los detalles:",
    dateLabel: "Fecha",
    timeLabel: "Hora",
    focusLabel: "Enfoque de la sesión",
    goalLabel: "Objetivo de entrenamiento",
    packageLabel: "Paquete",
    remainingLabel: "Sesiones restantes tras esta",
    expiresLabel: "Vencimiento del paquete",
    rulesHeading: "Recordatorios rápidos",
    rule1: "Cada sesión dura 1 hora.",
    rule2: "Cancela o reprograma con al menos 6 horas de antelación.",
    rule3: "Cualquier tiempo adicional debe acordarse previamente con Youssef.",
    closing: "Hasta pronto,\nYoussef Fitness",
  },
  de: {
    subject: "Buchung bestätigt — {date} um {time}",
    greeting: "Hallo {name},",
    intro: "Deine Trainingseinheit ist gebucht. Hier sind deine Details:",
    dateLabel: "Datum",
    timeLabel: "Uhrzeit",
    focusLabel: "Trainingsfokus",
    goalLabel: "Trainingsziel",
    packageLabel: "Paket",
    remainingLabel: "Verbleibende Sessions nach dieser",
    expiresLabel: "Paket läuft ab",
    rulesHeading: "Kurze Erinnerungen",
    rule1: "Jede Session dauert 1 Stunde.",
    rule2: "Mindestens 6 Stunden vorher absagen oder umplanen.",
    rule3: "Zusatzzeit muss vorab mit Youssef vereinbart werden.",
    closing: "Bis bald,\nYoussef Fitness",
  },
  it: {
    subject: "Prenotazione confermata — {date} alle {time}",
    greeting: "Ciao {name},",
    intro: "La tua sessione di allenamento è prenotata. Ecco i dettagli:",
    dateLabel: "Data",
    timeLabel: "Ora",
    focusLabel: "Focus della sessione",
    goalLabel: "Obiettivo di allenamento",
    packageLabel: "Pacchetto",
    remainingLabel: "Sessioni rimanenti dopo questa",
    expiresLabel: "Scadenza pacchetto",
    rulesHeading: "Promemoria importanti",
    rule1: "Ogni sessione dura 1 ora.",
    rule2: "Annulla o riprogramma almeno 6 ore prima.",
    rule3: "Eventuale tempo aggiuntivo va concordato in anticipo con Youssef.",
    closing: "A presto,\nYoussef Fitness",
  },
  ru: {
    subject: "Бронирование подтверждено — {date} в {time}",
    greeting: "Здравствуйте, {name}!",
    intro: "Ваша тренировка забронирована. Детали:",
    dateLabel: "Дата",
    timeLabel: "Время",
    focusLabel: "Фокус тренировки",
    goalLabel: "Цель тренировки",
    packageLabel: "Пакет",
    remainingLabel: "Осталось сессий после этой",
    expiresLabel: "Срок действия пакета",
    rulesHeading: "Важные напоминания",
    rule1: "Каждая сессия длится 1 час.",
    rule2: "Отмена или перенос — минимум за 6 часов.",
    rule3: "Дополнительное время согласуется с Youssef заранее.",
    closing: "До встречи,\nYoussef Fitness",
  },
  zh: {
    subject: "预约已确认 — {date} {time}",
    greeting: "您好 {name}，",
    intro: "您的训练课程已预约成功。详情如下：",
    dateLabel: "日期",
    timeLabel: "时间",
    focusLabel: "训练重点",
    goalLabel: "训练目标",
    packageLabel: "课程包",
    remainingLabel: "本次之后剩余课时",
    expiresLabel: "课程包到期日",
    rulesHeading: "温馨提示",
    rule1: "每节课时长1小时。",
    rule2: "请至少提前6小时取消或改期。",
    rule3: "如需延长时间，请提前与 Youssef 协商。",
    closing: "期待与您见面，\nYoussef Fitness",
  },
  hi: {
    subject: "बुकिंग कन्फर्म हो गई — {date} को {time} बजे",
    greeting: "नमस्ते {name},",
    intro: "आपका ट्रेनिंग सेशन बुक हो गया है। डिटेल्स यहाँ हैं:",
    dateLabel: "दिनांक",
    timeLabel: "समय",
    focusLabel: "सेशन फोकस",
    goalLabel: "ट्रेनिंग गोल",
    packageLabel: "पैकेज",
    remainingLabel: "इस सेशन के बाद बचे सेशन",
    expiresLabel: "पैकेज समाप्ति",
    rulesHeading: "ज़रूरी रिमाइंडर",
    rule1: "हर सेशन 1 घंटे का होता है।",
    rule2: "कम से कम 6 घंटे पहले कैंसल या रीशेड्यूल करें।",
    rule3: "अतिरिक्त समय के लिए Youssef से पहले से सहमति लें।",
    closing: "जल्द ही मिलते हैं,\nYoussef Fitness",
  },
  tr: {
    subject: "Rezervasyon onaylandı — {date} {time}",
    greeting: "Merhaba {name},",
    intro: "Antrenman seansın onaylandı. Detaylar aşağıda:",
    dateLabel: "Tarih",
    timeLabel: "Saat",
    focusLabel: "Seans odağı",
    goalLabel: "Antrenman hedefi",
    packageLabel: "Paket",
    remainingLabel: "Bu seanstan sonra kalan seanslar",
    expiresLabel: "Paket bitiş tarihi",
    rulesHeading: "Kısa hatırlatmalar",
    rule1: "Her seans 1 saattir.",
    rule2: "En az 6 saat önceden iptal veya yeniden planlama yap.",
    rule3: "Ek süre için önceden Youssef ile anlaş.",
    closing: "Yakında görüşmek üzere,\nYoussef Fitness",
  },
};

export function pickClientEmailI18n(lang: string | undefined | null): ClientEmailI18n {
  const code = (lang || "en").toLowerCase();
  return CLIENT_BOOKING_EMAIL_I18N[code] || CLIENT_BOOKING_EMAIL_I18N.en;
}
