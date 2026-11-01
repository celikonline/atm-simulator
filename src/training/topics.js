import { lazy } from 'react'

// Yeni eğitim konusu eklemek için: src/training/ altına bir sayfa bileşeni yazıp buraya bir satır ekleyin.
// Üst menü ve konu dizini bu listeden (gruplara göre) otomatik oluşur; sayfa içi içindekiler <h2 id="..."> başlıklarından çıkarılır.
export const GROUPS = ['Mesajlaşma standartları', 'ATM cihaz katmanı', 'Sistem mimarisi', 'Yazılım ve veri']

export const TOPICS = [
  {
    id: 'iso8583',
    group: GROUPS[0],
    title: 'ISO 8583',
    summary: 'Kartlı ödeme mesajları: MTI, bitmap, veri alanları, akışlar ve örnek senaryolar',
    minutes: 25,
    Page: lazy(() => import('./Iso8583.jsx')),
  },
  {
    id: 'iso20022',
    group: GROUPS[0],
    title: 'ISO 20022',
    summary: 'XML tabanlı yeni nesil ödeme mesajları: pacs, pain, camt ve ISO 8583 ile karşılaştırma',
    minutes: 20,
    Page: lazy(() => import('./Iso20022.jsx')),
  },
  {
    id: 'emv',
    group: GROUPS[0],
    title: 'EMV',
    summary: 'Çipli kart işlemi: APDU akışı, kriptogramlar, risk yönetimi ve senaryolar',
    minutes: 30,
    Page: lazy(() => import('./Emv.jsx')),
  },
  {
    id: 'xfs',
    group: GROUPS[1],
    title: 'XFS ve versiyonları',
    summary: 'CEN/XFS mimarisi, servis sağlayıcılar, komut/olay modeli ve 3.x sürümleri',
    minutes: 25,
    Page: lazy(() => import('./Xfs.jsx')),
  },
  {
    id: 'suruculer',
    group: GROUPS[1],
    title: 'ATM cihaz sürücüleri',
    summary: 'Kart okuyucu, PIN pad, nakit dağıtıcı ve yazıcı sürücüleri; hata yönetimi ve sürüm uyumu',
    minutes: 20,
    Page: lazy(() => import('./DeviceDrivers.jsx')),
  },
  {
    id: 'switch',
    group: GROUPS[2],
    title: 'Switch uygulaması',
    summary: 'ATM switch’in görevleri: yönlendirme, mesaj dönüşümü, zaman aşımı, SAF ve yüksek erişilebilirlik',
    minutes: 25,
    Page: lazy(() => import('./Switch.jsx')),
  },
  {
    id: 'host',
    group: GROUPS[2],
    title: 'ATM host ve transaction yönetimi',
    summary: 'Host uygulamaları, işlem yaşam döngüsü, iptal, mutabakat ve idempotentlik',
    minutes: 25,
    Page: lazy(() => import('./HostTxn.jsx')),
  },
  {
    id: 'qr',
    group: GROUPS[2],
    title: 'QR ile kartsız işlem (mobil)',
    summary: 'ATM’de QR ile mobilden para çekme ve yatırma: oturum, onay, güvenlik ve hata senaryoları',
    minutes: 20,
    Page: lazy(() => import('./QrCardless.jsx')),
  },
  {
    id: 'oop',
    group: GROUPS[3],
    title: 'Nesne yönelimli programlama (OOP)',
    summary: 'Kapsülleme, soyutlama, kalıtım, çok biçimlilik, SOLID ve ATM yazılımında tasarım desenleri',
    minutes: 25,
    Page: lazy(() => import('./Oop.jsx')),
  },
  {
    id: 'acid',
    group: GROUPS[3],
    title: 'ACID',
    summary: 'Atomiklik, tutarlılık, yalıtım, kalıcılık: bankacılık işlemleri örnekleriyle',
    minutes: 15,
    Page: lazy(() => import('./Acid.jsx')),
  },
  {
    id: 'sdlc',
    group: GROUPS[3],
    title: 'SDLC',
    summary: 'Yazılım geliştirme yaşam döngüsü: ATM ve bankacılık yazılımlarında test, sertifikasyon ve yayın',
    minutes: 15,
    Page: lazy(() => import('./Sdlc.jsx')),
  },
]
