type TranslationKey =
  | "learningLanguage"
  | "program"
  | "course"
  | "module"
  | "certificate"
  | "viewCertificate"
  | "viewProgramTypeCertificate"
  | "viewProgramDetails"
  | "viewCourseDetails"
  | "emailSettings"
  | "unenroll"
  | "startNoun"
  | "viewNoun"
  | "continue"
  | "youHaveCompleted"
  | "forThisProgram"
  | "completed"
  | "of"
  | "courses"
  | "coreCourses"
  | "electiveCourses"
  | "electivesComplete"
  | "addCertificateFor"
  | "daysRemaining"
  | "dayRemaining"
  | "lessThanDayRemaining"
  | "startsToday"
  | "startsTomorrow"
  | "startsInDays"

const TRANSLATIONS: Record<string, Record<TranslationKey, string>> = {
  en: {
    learningLanguage: "Learning Language:",
    program: "Program",
    course: "Course",
    module: "Module",
    certificate: "Certificate",
    viewCertificate: "View Certificate",
    viewProgramTypeCertificate: "View {programType} Certificate",
    viewProgramDetails: "View Program Details",
    viewCourseDetails: "View Course Details",
    emailSettings: "Email Settings",
    unenroll: "Unenroll",
    startNoun: "Start {noun}",
    viewNoun: "View {noun}",
    continue: "Continue",
    youHaveCompleted: "You have completed",
    forThisProgram: "for this program.",
    completed: "Completed",
    of: "of",
    courses: "courses",
    coreCourses: "Core Courses",
    electiveCourses: "Elective Courses",
    electivesComplete: "Electives (Complete {count})",
    addCertificateFor: "Add a certificate for {price}",
    daysRemaining: "{days} days remaining",
    dayRemaining: "{days} day remaining",
    lessThanDayRemaining: "Less than a day remaining",
    startsToday: "Starts Today",
    startsTomorrow: "Starts Tomorrow",
    startsInDays: "Starts in {days} days",
  },
  ar: {
    learningLanguage: "لغة التعلم:",
    program: "البرنامج",
    course: "الدورة",
    module: "الوحدة",
    certificate: "الشهادة",
    viewCertificate: "عرض الشهادة",
    viewProgramTypeCertificate: "عرض شهادة {programType}",
    viewProgramDetails: "عرض تفاصيل البرنامج",
    viewCourseDetails: "عرض تفاصيل الدورة",
    emailSettings: "إعدادات البريد الإلكتروني",
    unenroll: "إلغاء التسجيل",
    startNoun: "ابدأ {noun}",
    viewNoun: "عرض {noun}",
    continue: "متابعة",
    youHaveCompleted: "لقد أكملت",
    forThisProgram: "لهذا البرنامج.",
    completed: "مكتمل",
    of: "من",
    courses: "دورات",
    coreCourses: "الدورات الأساسية",
    electiveCourses: "الدورات الاختيارية",
    electivesComplete: "الدورات الاختيارية (أكمل {count})",
    addCertificateFor: "أضف شهادة مقابل {price}",
    daysRemaining: "متبقي {days} أيام",
    dayRemaining: "متبقي {days} يوم",
    lessThanDayRemaining: "أقل من يوم متبق",
    startsToday: "يبدأ اليوم",
    startsTomorrow: "يبدأ غدا",
    startsInDays: "يبدأ خلال {days} أيام",
  },
  de: {
    learningLanguage: "Lernsprache:",
    program: "Programm",
    course: "Kurs",
    module: "Modul",
    certificate: "Zertifikat",
    viewCertificate: "Zertifikat ansehen",
    viewProgramTypeCertificate: "{programType}-Zertifikat ansehen",
    viewProgramDetails: "Programmdetails anzeigen",
    viewCourseDetails: "Kursdetails anzeigen",
    emailSettings: "E-Mail-Einstellungen",
    unenroll: "Abmelden",
    startNoun: "{noun} starten",
    viewNoun: "{noun} ansehen",
    continue: "Fortfahren",
    youHaveCompleted: "Sie haben abgeschlossen",
    forThisProgram: "für dieses Programm.",
    completed: "Abgeschlossen",
    of: "von",
    courses: "Kursen",
    coreCourses: "Pflichtkurse",
    electiveCourses: "Wahlkurse",
    electivesComplete: "Wahlkurse (Schließen Sie {count} ab)",
    addCertificateFor: "Zertifikat für {price} hinzufügen",
    daysRemaining: "{days} Tage verbleibend",
    dayRemaining: "{days} Tag verbleibend",
    lessThanDayRemaining: "Weniger als ein Tag verbleibend",
    startsToday: "Startet heute",
    startsTomorrow: "Startet morgen",
    startsInDays: "Startet in {days} Tagen",
  },
  el: {
    learningLanguage: "Γλωσσα μαθησης:",
    program: "Προγραμμα",
    course: "Μαθημα",
    module: "Ενοτητα",
    certificate: "Πιστοποιητικο",
    viewCertificate: "Προβολη πιστοποιητικου",
    viewProgramTypeCertificate: "Προβολη πιστοποιητικου {programType}",
    viewProgramDetails: "Προβολη λεπτομερειων προγραμματος",
    viewCourseDetails: "Προβολη λεπτομερειων μαθηματος",
    emailSettings: "Ρυθμισεις email",
    unenroll: "Ακυρωση εγγραφης",
    startNoun: "Εναρξη {noun}",
    viewNoun: "Προβολη {noun}",
    continue: "Συνεχεια",
    youHaveCompleted: "Εχετε ολοκληρωσει",
    forThisProgram: "για αυτο το προγραμμα.",
    completed: "Ολοκληρωμενα",
    of: "απο",
    courses: "μαθηματα",
    coreCourses: "Βασικα μαθηματα",
    electiveCourses: "Μαθηματα επιλογης",
    electivesComplete: "Μαθηματα επιλογης (Ολοκληρωστε {count})",
    addCertificateFor: "Προσθηκη πιστοποιητικου για {price}",
    daysRemaining: "Απομενουν {days} ημερες",
    dayRemaining: "Απομενει {days} ημερα",
    lessThanDayRemaining: "Απομενει λιγοτερο απο μια ημερα",
    startsToday: "Ξεκινα σημερα",
    startsTomorrow: "Ξεκινα αυριο",
    startsInDays: "Ξεκινα σε {days} ημερες",
  },
  es: {
    learningLanguage: "Idioma de aprendizaje:",
    program: "Programa",
    course: "Curso",
    module: "Módulo",
    certificate: "Certificado",
    viewCertificate: "Ver certificado",
    viewProgramTypeCertificate: "Ver certificado de {programType}",
    viewProgramDetails: "Ver detalles del programa",
    viewCourseDetails: "Ver detalles del curso",
    emailSettings: "Configuración de correo",
    unenroll: "Darse de baja",
    startNoun: "Comenzar {noun}",
    viewNoun: "Ver {noun}",
    continue: "Continuar",
    youHaveCompleted: "Has completado",
    forThisProgram: "para este programa.",
    completed: "Completado",
    of: "de",
    courses: "cursos",
    coreCourses: "Cursos obligatorios",
    electiveCourses: "Cursos optativos",
    electivesComplete: "Optativas (Completa {count})",
    addCertificateFor: "Agregar certificado por {price}",
    daysRemaining: "{days} días restantes",
    dayRemaining: "{days} día restante",
    lessThanDayRemaining: "Menos de un día restante",
    startsToday: "Comienza hoy",
    startsTomorrow: "Comienza mañana",
    startsInDays: "Comienza en {days} días",
  },
  fr: {
    learningLanguage: "Langue d'apprentissage:",
    program: "Programme",
    course: "Cours",
    module: "Module",
    certificate: "Certificat",
    viewCertificate: "Voir le certificat",
    viewProgramTypeCertificate: "Voir le certificat de {programType}",
    viewProgramDetails: "Voir les détails du programme",
    viewCourseDetails: "Voir les détails du cours",
    emailSettings: "Paramètres e-mail",
    unenroll: "Se désinscrire",
    startNoun: "Commencer {noun}",
    viewNoun: "Voir {noun}",
    continue: "Continuer",
    youHaveCompleted: "Vous avez complété",
    forThisProgram: "pour ce programme.",
    completed: "Termine",
    of: "sur",
    courses: "cours",
    coreCourses: "Cours principaux",
    electiveCourses: "Cours optionnels",
    electivesComplete: "Options (Terminer {count})",
    addCertificateFor: "Ajouter un certificat pour {price}",
    daysRemaining: "{days} jours restants",
    dayRemaining: "{days} jour restant",
    lessThanDayRemaining: "Moins d'un jour restant",
    startsToday: "Commence aujourd'hui",
    startsTomorrow: "Commence demain",
    startsInDays: "Commence dans {days} jours",
  },
  pt: {
    learningLanguage: "Idioma de aprendizagem:",
    program: "Programa",
    course: "Curso",
    module: "Módulo",
    certificate: "Certificado",
    viewCertificate: "Ver certificado",
    viewProgramTypeCertificate: "Ver certificado de {programType}",
    viewProgramDetails: "Ver detalhes do programa",
    viewCourseDetails: "Ver detalhes do curso",
    emailSettings: "Configurações de e-mail",
    unenroll: "Cancelar inscrição",
    startNoun: "Iniciar {noun}",
    viewNoun: "Ver {noun}",
    continue: "Continuar",
    youHaveCompleted: "Você concluiu",
    forThisProgram: "para este programa.",
    completed: "Concluído",
    of: "de",
    courses: "cursos",
    coreCourses: "Cursos obrigatórios",
    electiveCourses: "Cursos eletivos",
    electivesComplete: "Eletivos (Concluir {count})",
    addCertificateFor: "Adicionar certificado por {price}",
    daysRemaining: "{days} dias restantes",
    dayRemaining: "{days} dia restante",
    lessThanDayRemaining: "Menos de um dia restante",
    startsToday: "Começa hoje",
    startsTomorrow: "Começa amanhã",
    startsInDays: "Começa em {days} dias",
  },
  ja: {
    learningLanguage: "学習言語:",
    program: "プログラム",
    course: "コース",
    module: "モジュール",
    certificate: "証明書",
    viewCertificate: "証明書を見る",
    viewProgramTypeCertificate: "{programType} 証明書を見る",
    viewProgramDetails: "プログラムの詳細を見る",
    viewCourseDetails: "コースの詳細を見る",
    emailSettings: "メール設定",
    unenroll: "登録解除",
    startNoun: "{noun}を開始",
    viewNoun: "{noun}を見る",
    continue: "続ける",
    youHaveCompleted: "完了済み",
    forThisProgram: "このプログラムに対して。",
    completed: "完了",
    of: "/",
    courses: "コース",
    coreCourses: "必修コース",
    electiveCourses: "選択コース",
    electivesComplete: "選択科目 ({count} 完了)",
    addCertificateFor: "{price}で証明書を追加",
    daysRemaining: "残り {days} 日",
    dayRemaining: "残り {days} 日",
    lessThanDayRemaining: "残り1日未満",
    startsToday: "本日開始",
    startsTomorrow: "明日開始",
    startsInDays: "{days}日後に開始",
  },
  zh: {
    learningLanguage: "学习语言:",
    program: "项目",
    course: "课程",
    module: "模块",
    certificate: "证书",
    viewCertificate: "查看证书",
    viewProgramTypeCertificate: "查看 {programType} 证书",
    viewProgramDetails: "查看项目详情",
    viewCourseDetails: "查看课程详情",
    emailSettings: "邮件设置",
    unenroll: "取消注册",
    startNoun: "开始{noun}",
    viewNoun: "查看{noun}",
    continue: "继续",
    youHaveCompleted: "你已完成",
    forThisProgram: "针对该项目。",
    completed: "已完成",
    of: "共",
    courses: "门课程",
    coreCourses: "核心课程",
    electiveCourses: "选修课程",
    electivesComplete: "选修课（完成 {count} 门）",
    addCertificateFor: "添加证书，价格 {price}",
    daysRemaining: "剩余 {days} 天",
    dayRemaining: "剩余 {days} 天",
    lessThanDayRemaining: "剩余不到一天",
    startsToday: "今天开始",
    startsTomorrow: "明天开始",
    startsInDays: "{days} 天后开始",
  },
}

const normalizeUiLanguageCode = (languageCode?: string | null): string => {
  if (!languageCode) {
    return "en"
  }
  const normalized = languageCode.trim().toLowerCase().replace(/_/g, "-")
  const exact = TRANSLATIONS[normalized]
  if (exact) {
    return normalized
  }
  const base = normalized.split("-")[0]
  return TRANSLATIONS[base] ? base : "en"
}

const interpolate = (
  template: string,
  vars: Record<string, string | number> = {},
): string => {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    return String(vars[key] ?? "")
  })
}

const tDashboard = (
  languageCode: string | undefined,
  key: TranslationKey,
  vars: Record<string, string | number> = {},
): string => {
  const code = normalizeUiLanguageCode(languageCode)
  const template = TRANSLATIONS[code][key] ?? TRANSLATIONS.en[key]
  return interpolate(template, vars)
}

export { tDashboard, normalizeUiLanguageCode }
