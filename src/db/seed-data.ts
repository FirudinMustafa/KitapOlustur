export const NICE_TO_HAVE_DEFAULTS = [
  {
    key: "cefr_alignment",
    label: "CEFR seviye uyumu",
    description:
      "Her ünite ve alıştırma, açıkça belirtilmiş bir CEFR seviyesine (A1-C2) hizalanır ve seviye içinde tutarlı zorluk ilerlemesi sağlanır.",
    sortOrder: 1,
    isDefaultSelected: true,
  },
  {
    key: "skill_balance",
    label: "Dört beceri dengesi",
    description:
      "Dinleme, konuşma, okuma ve yazma alıştırmaları her ünitede dengeli biçimde dağıtılır; hiçbir beceri ihmal edilmez.",
    sortOrder: 2,
    isDefaultSelected: true,
  },
  {
    key: "spaced_review",
    label: "Düzenli tekrar üniteleri",
    description:
      "Her 3-4 ünitede bir, önceki ünitelerin kelime ve dilbilgisini pekiştiren bir review/tekrar ünitesi eklenir.",
    sortOrder: 3,
    isDefaultSelected: true,
  },
  {
    key: "answer_key",
    label: "Workbook cevap anahtarı",
    description: "Workbook'un sonunda tüm alıştırmalar için bir cevap anahtarı bölümü bulunur.",
    sortOrder: 4,
    isDefaultSelected: true,
  },
  {
    key: "vocabulary_glossary",
    label: "Kelime bilgisi sözlüğü",
    description:
      "Her ünitenin sonunda o ünitede geçen yeni kelimelerin İngilizce tanımları ve örnek cümlelerle listelendiği bir sözlük bölümü eklenir.",
    sortOrder: 5,
    isDefaultSelected: true,
  },
  {
    key: "real_life_context",
    label: "Gerçek hayat bağlamlı diyaloglar",
    description:
      "Alıştırma ve okuma parçaları, öğrencinin günlük hayatta karşılaşabileceği gerçekçi senaryolar ve diyaloglar üzerine kurulur.",
    sortOrder: 6,
    isDefaultSelected: true,
  },
  {
    key: "teacher_notes",
    label: "Öğretmen notları",
    description:
      "Her ünitede öğretmenler için kısa uygulama önerileri, zamanlama tahminleri ve yaygın öğrenci hatalarına dair notlar eklenir.",
    sortOrder: 7,
    isDefaultSelected: false,
  },
  {
    key: "extra_practice",
    label: "Ekstra alıştırma seti",
    description:
      "Her ünitenin sonunda, hızlı bitiren veya ek pratiğe ihtiyaç duyan öğrenciler için isteğe bağlı ekstra alıştırmalar eklenir.",
    sortOrder: 8,
    isDefaultSelected: false,
  },
  {
    key: "listening_scripts",
    label: "Dinleme metinleri (audio script)",
    description:
      "Dinleme alıştırmaları için, ileride seslendirilebilecek tam transkript metinleri içerikte hazır bulunur.",
    sortOrder: 9,
    isDefaultSelected: false,
  },
  {
    key: "visual_suggestions",
    label: "Görsel öneriler",
    description:
      "Her sayfa/alıştırma için, tasarımcıya veya görsel üretim aşamasına rehberlik edecek görsel açıklamaları (ne çizilmeli/gösterilmeli) eklenir.",
    sortOrder: 10,
    isDefaultSelected: false,
  },
];
